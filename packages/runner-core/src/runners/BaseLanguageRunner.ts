import { readFile, rm, stat, writeFile } from "node:fs/promises";
import type {
  Language,
  SupportedValue,
  TestCase,
} from "@gca-practice/contracts";
import { ProcessRunner } from "../process/ProcessRunner.js";
import { areSupportedValuesEqual } from "../results/compareResults.js";
import { assertValueMatchesType } from "../typeSystem/TypeSpec.js";
import { TempWorkspace } from "../workspace/TempWorkspace.js";
import type {
  LanguageRunner,
  MaterializedTest,
  PreparedProgram,
  PrepareRequest,
  TestExecutionResult,
} from "./LanguageRunner.js";

export const DEFAULT_MAX_SOURCE_BYTES = 1024 * 1024;

export interface RunnerCommand {
  executable: string;
  args: string[];
}

interface StoredTest {
  index: number;
  test: TestCase;
}

interface ProgramState {
  workspace: TempWorkspace;
  request: PrepareRequest;
  tests: Map<string, StoredTest>;
  runCommand: (testIndex: number, resultPath: string) => RunnerCommand;
  queue: Promise<void>;
  closing: boolean;
}

export interface NativePreparation {
  sourceFileName: string;
  harnessSource: string;
  compileCommand: RunnerCommand;
  runCommand: (testIndex: number, resultPath: string) => RunnerCommand;
}

export abstract class BaseLanguageRunner implements LanguageRunner {
  private readonly states = new WeakMap<PreparedProgram, ProgramState>();

  protected constructor(
    readonly language: Language,
    protected readonly processRunner: ProcessRunner,
    private readonly maxSourceBytes = DEFAULT_MAX_SOURCE_BYTES,
  ) {}

  abstract prepare(request: PrepareRequest): Promise<PreparedProgram>;

  protected async prepareNativeProgram(
    request: PrepareRequest,
    preparation: NativePreparation,
  ): Promise<PreparedProgram> {
    if (request.language !== this.language) {
      throw new TypeError(
        `${this.language} runner cannot prepare ${request.language} source.`,
      );
    }
    if (Buffer.byteLength(request.source, "utf8") > this.maxSourceBytes) {
      throw new RangeError(
        `Candidate source exceeds the ${this.maxSourceBytes}-byte limit.`,
      );
    }

    const workspace = await TempWorkspace.create();
    try {
      await writeFile(
        workspace.filePath(preparation.sourceFileName),
        preparation.harnessSource,
        "utf8",
      );

      const compileResult = await this.processRunner.run({
        executable: preparation.compileCommand.executable,
        args: preparation.compileCommand.args,
        cwd: workspace.path,
        timeoutMs: request.limits.compileTimeMs,
        outputLimitBytes: request.limits.outputLimitBytes,
      });
      const preparationVerdict = compileVerdict(compileResult);
      const requestSnapshot = structuredClone(request);
      const program: PreparedProgram = {
        language: this.language,
        workspacePath: workspace.path,
        preparationVerdict,
        compileTimeMs: compileResult.durationMs,
        compileStdout: compileResult.stdout,
        compileStderr: compileDiagnostic(compileResult),
        compileExitCode: compileResult.exitCode,
        compileSignal: compileResult.signal,
        testIds: requestSnapshot.tests.map((test) => test.id),
      };
      Object.freeze(program.testIds);
      Object.freeze(program);
      const tests = new Map<string, StoredTest>();
      requestSnapshot.tests.forEach((test, index) =>
        tests.set(test.id, { index, test }),
      );
      this.states.set(program, {
        workspace,
        request: requestSnapshot,
        tests,
        runCommand: preparation.runCommand,
        queue: Promise.resolve(),
        closing: false,
      });
      return program;
    } catch (error) {
      await workspace.cleanup();
      throw error;
    }
  }

  async runTest(
    program: PreparedProgram,
    test: MaterializedTest,
  ): Promise<TestExecutionResult> {
    const state = this.states.get(program);
    if (!state) {
      return infrastructureFailure(
        test,
        "Prepared program does not belong to this runner or was cleaned up.",
      );
    }
    if (state.closing) {
      return infrastructureFailure(test, "Prepared program is being cleaned up.");
    }

    const storedTest = state.tests.get(test.id);
    if (!storedTest) {
      return infrastructureFailure(
        test,
        `Test ID "${test.id}" was not included during preparation.`,
      );
    }

    const execution = state.queue.then(async () => {
      try {
        return await this.executeStoredTest(program, state, storedTest);
      } catch (error) {
        return infrastructureFailure(
          storedTest.test,
          error instanceof Error
            ? `Runner internal error: ${error.message}`
            : "Runner internal error.",
        );
      }
    });
    state.queue = execution.then(
      () => undefined,
      () => undefined,
    );
    return await execution;
  }

  async cleanup(program: PreparedProgram): Promise<void> {
    const state = this.states.get(program);
    if (!state) return;
    state.closing = true;
    await state.queue;
    await state.workspace.cleanup();
    this.states.delete(program);
  }

  private async executeStoredTest(
    program: PreparedProgram,
    state: ProgramState,
    stored: StoredTest,
  ): Promise<TestExecutionResult> {
    if (program.preparationVerdict !== "accepted") {
      return {
        testId: stored.test.id,
        verdict: program.preparationVerdict,
        executionTimeMs: 0,
        expected: stored.test.expected,
        stdout: program.compileStdout,
        stderr: program.compileStderr,
        exitCode: program.compileExitCode,
        signal: program.compileSignal,
        message:
          program.preparationVerdict === "compile_error"
            ? "Candidate source did not compile."
            : "The compiler could not be executed.",
      };
    }

    const resultPath = state.workspace.filePath(
      `judge-result-${stored.index}.json`,
    );
    await rm(resultPath, { force: true });
    const command = state.runCommand(stored.index, resultPath);

    try {
      const execution = await this.processRunner.run({
        executable: command.executable,
        args: command.args,
        cwd: state.workspace.path,
        timeoutMs: state.request.limits.executionTimeMs,
        outputLimitBytes: state.request.limits.outputLimitBytes,
      });
      const common = {
        testId: stored.test.id,
        executionTimeMs: execution.durationMs,
        expected: stored.test.expected,
        stdout: execution.stdout,
        stderr: execution.stderr,
        exitCode: execution.exitCode,
        signal: execution.signal,
      };

      if (execution.terminationReason === "timeout") {
        return {
          ...common,
          verdict: "time_limit_exceeded",
          message: "Test exceeded the execution time limit.",
        };
      }
      if (
        execution.terminationReason === "stdout_limit" ||
        execution.terminationReason === "stderr_limit"
      ) {
        return {
          ...common,
          verdict: "output_limit_exceeded",
          message: `${execution.outputLimitExceeded} exceeded the output limit.`,
        };
      }
      if (execution.terminationReason === "spawn_error") {
        return {
          ...common,
          verdict: "internal_error",
          message: execution.spawnError?.message ?? "Unable to start program.",
        };
      }
      if (execution.terminationReason === "cancelled") {
        return {
          ...common,
          verdict: "internal_error",
          message: "Test execution was cancelled unexpectedly.",
        };
      }
      if (execution.exitCode !== 0) {
        return {
          ...common,
          verdict: "runtime_error",
          message: `Program exited with code ${execution.exitCode ?? "null"}.`,
        };
      }

      let resultStat;
      try {
        resultStat = await stat(resultPath);
      } catch {
        return {
          ...common,
          verdict: "runtime_error",
          message: "Program exited without producing a judge result.",
        };
      }
      if (resultStat.size > state.request.limits.outputLimitBytes) {
        return {
          ...common,
          verdict: "output_limit_exceeded",
          message: "Judge result exceeded the output limit.",
        };
      }

      let actual: SupportedValue;
      try {
        actual = JSON.parse(await readFile(resultPath, "utf8")) as SupportedValue;
        assertValueMatchesType(
          actual,
          state.request.signature.returnType,
          "judge result",
        );
      } catch (error) {
        return {
          ...common,
          verdict: "runtime_error",
          message:
            error instanceof Error
              ? `Invalid judge result: ${error.message}`
              : "Invalid judge result.",
        };
      }

      return {
        ...common,
        verdict: areSupportedValuesEqual(actual, stored.test.expected)
          ? "accepted"
          : "wrong_answer",
        actual,
      };
    } finally {
      await rm(resultPath, { force: true });
    }
  }
}

function compileVerdict(
  result: Awaited<ReturnType<ProcessRunner["run"]>>,
): PreparedProgram["preparationVerdict"] {
  if (result.terminationReason === "spawn_error") return "internal_error";
  if (result.terminationReason !== "exited" || result.exitCode !== 0) {
    return "compile_error";
  }
  return "accepted";
}

function compileDiagnostic(
  result: Awaited<ReturnType<ProcessRunner["run"]>>,
): string {
  const diagnostics = [result.stderr];
  if (result.terminationReason === "timeout") {
    diagnostics.push("Compilation exceeded the time limit.");
  } else if (
    result.terminationReason === "stdout_limit" ||
    result.terminationReason === "stderr_limit"
  ) {
    diagnostics.push("Compiler output exceeded the output limit.");
  } else if (result.spawnError) {
    diagnostics.push(result.spawnError.message);
  }
  return diagnostics.filter(Boolean).join("\n");
}

function infrastructureFailure(
  test: MaterializedTest,
  message: string,
): TestExecutionResult {
  return {
    testId: test.id,
    verdict: "internal_error",
    executionTimeMs: 0,
    expected: test.expected,
    stdout: "",
    stderr: "",
    exitCode: null,
    signal: null,
    message,
  };
}
