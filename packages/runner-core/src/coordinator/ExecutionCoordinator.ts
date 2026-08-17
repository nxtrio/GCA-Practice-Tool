import type {
  ExecutionVerdict,
  Language,
  ProblemLimits,
  RunResult,
  TestCase,
  TestResult,
  TestVisibility,
  FunctionSignature,
} from "@gca-practice/contracts";
import type {
  LanguageRunner,
  TestExecutionResult,
} from "../runners/LanguageRunner.js";

export interface RunnerProvider {
  get(language: Language): LanguageRunner | undefined;
}

export interface ExecutionCoordinatorRequest {
  language: Language;
  source: string;
  signature: FunctionSignature;
  limits: ProblemLimits;
  visibleTests: TestCase[];
  hiddenTests: TestCase[];
  mode: "run" | "submit";
}

export class RunnerUnavailableError extends Error {
  constructor(readonly language: Language) {
    super(`The ${language} runner is not available.`);
    this.name = "RunnerUnavailableError";
  }
}

interface LocatedTest {
  test: TestCase;
  visibility: TestVisibility;
}

/** Coordinates compile-once, sequential testcase execution and API redaction. */
export class ExecutionCoordinator {
  constructor(private readonly runners: RunnerProvider) {}

  async execute(request: ExecutionCoordinatorRequest): Promise<RunResult> {
    const runner = this.runners.get(request.language);
    if (!runner) throw new RunnerUnavailableError(request.language);

    const tests = selectedTests(request);
    const program = await runner.prepare({
      language: request.language,
      source: request.source,
      signature: request.signature,
      tests: tests.map(({ test }) => test),
      limits: request.limits,
    });

    try {
      const results: TestResult[] = [];
      for (const located of tests) {
        const result = await runner.runTest(program, located.test);
        results.push(redactResult(located.visibility, result));
      }

      return {
        verdict: aggregateVerdict(results.map(({ verdict }) => verdict)),
        compileTimeMs: program.compileTimeMs,
        passed: results.filter(({ verdict }) => verdict === "accepted").length,
        total: results.length,
        tests: results,
      };
    } finally {
      await runner.cleanup(program);
    }
  }
}

function selectedTests(request: ExecutionCoordinatorRequest): LocatedTest[] {
  const visible = request.visibleTests.map((test) => ({
    test,
    visibility: "visible" as const,
  }));
  if (request.mode === "run") return visible;
  return [
    ...visible,
    ...request.hiddenTests.map((test) => ({
      test,
      visibility: "hidden" as const,
    })),
  ];
}

function redactResult(
  visibility: TestVisibility,
  result: TestExecutionResult,
): TestResult {
  if (visibility === "hidden") {
    return {
      visibility: "hidden",
      verdict: result.verdict,
      executionTimeMs: result.executionTimeMs,
    };
  }

  return {
    visibility: "visible",
    testId: result.testId,
    verdict: result.verdict,
    executionTimeMs: result.executionTimeMs,
    expected: result.expected,
    ...(result.actual === undefined ? {} : { actual: result.actual }),
    ...(result.stdout ? { stdout: result.stdout } : {}),
    ...(result.stderr ? { stderr: result.stderr } : {}),
    ...(result.message ? { message: result.message } : {}),
  };
}

function aggregateVerdict(verdicts: ExecutionVerdict[]): ExecutionVerdict {
  if (verdicts.every((verdict) => verdict === "accepted")) return "accepted";
  const priority: ExecutionVerdict[] = [
    "internal_error",
    "compile_error",
    "time_limit_exceeded",
    "output_limit_exceeded",
    "runtime_error",
    "wrong_answer",
  ];
  return priority.find((verdict) => verdicts.includes(verdict)) ?? "accepted";
}
