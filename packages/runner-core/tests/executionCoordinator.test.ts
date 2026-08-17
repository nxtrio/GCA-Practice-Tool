import type { Language } from "@gca-practice/contracts";
import type {
  PreparedProgram,
  TestExecutionResult,
  LanguageRunner,
} from "../src/runners/LanguageRunner.ts";
import { describe, expect, it, vi } from "vitest";
import {
  ExecutionCoordinator,
  RunnerUnavailableError,
} from "../src/coordinator/ExecutionCoordinator.ts";

const signature = {
  name: "solution",
  parameters: [{ name: "value", type: { kind: "int" as const } }],
  returnType: { kind: "int" as const },
};
const limits = {
  executionTimeMs: 500,
  compileTimeMs: 5_000,
  outputLimitBytes: 4_096,
};
const visible = {
  id: "visible-1",
  arguments: [2],
  expected: 4,
  category: "example",
};
const hidden = {
  id: "hidden-secret-id",
  arguments: [99],
  expected: 198,
  category: "secret-category",
};

describe("ExecutionCoordinator", () => {
  it("runs visible tests only for Run", async () => {
    const runner = fakeRunner({ "visible-1": accepted(visible.id, 4, 4) });
    const result = await new ExecutionCoordinator(provider(runner)).execute({
      language: "python",
      source: "def solution(value): return value * 2",
      signature,
      limits,
      visibleTests: [visible],
      hiddenTests: [hidden],
      mode: "run",
    });

    expect(result).toMatchObject({ verdict: "accepted", passed: 1, total: 1 });
    expect(result.tests).toEqual([
      expect.objectContaining({
        visibility: "visible",
        testId: "visible-1",
        expected: 4,
        actual: 4,
      }),
    ]);
    expect(runner.prepare).toHaveBeenCalledWith(
      expect.objectContaining({ tests: [visible] }),
    );
    expect(runner.cleanup).toHaveBeenCalledOnce();
  });

  it("runs hidden tests on Submit and removes every hidden detail", async () => {
    const runner = fakeRunner({
      "visible-1": accepted(visible.id, 4, 4),
      "hidden-secret-id": {
        ...accepted(hidden.id, hidden.expected, 0),
        verdict: "wrong_answer",
        stdout: "secret stdout",
        stderr: "secret stderr",
        message: "secret message",
      },
    });
    const result = await new ExecutionCoordinator(provider(runner)).execute({
      language: "python",
      source: "def solution(value): return value * 2",
      signature,
      limits,
      visibleTests: [visible],
      hiddenTests: [hidden],
      mode: "submit",
    });

    expect(result).toMatchObject({
      verdict: "wrong_answer",
      passed: 1,
      total: 2,
    });
    expect(result.tests[1]).toEqual({
      visibility: "hidden",
      verdict: "wrong_answer",
      executionTimeMs: 7,
    });
    const serialized = JSON.stringify(result.tests[1]);
    for (const secret of [
      "hidden-secret-id",
      "secret-category",
      "secret stdout",
      "secret stderr",
      "secret message",
      "198",
      "99",
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("preserves useful visible diagnostics and always cleans up", async () => {
    const runner = fakeRunner({
      "visible-1": {
        ...accepted(visible.id, visible.expected, undefined),
        verdict: "compile_error",
        stderr: "line 1: syntax error",
        message: "Candidate source did not compile.",
      },
    });
    const result = await new ExecutionCoordinator(provider(runner)).execute({
      language: "java",
      source: "broken",
      signature,
      limits,
      visibleTests: [visible],
      hiddenTests: [],
      mode: "run",
    });

    expect(result).toMatchObject({
      verdict: "compile_error",
      compileTimeMs: 12,
      tests: [
        {
          visibility: "visible",
          testId: "visible-1",
          verdict: "compile_error",
          executionTimeMs: 7,
          expected: 4,
          stderr: "line 1: syntax error",
          message: "Candidate source did not compile.",
        },
      ],
    });
    expect(runner.cleanup).toHaveBeenCalledOnce();
  });

  it("reports unavailable toolchains", async () => {
    await expect(
      new ExecutionCoordinator({ get: () => undefined }).execute({
        language: "cpp",
        source: "",
        signature,
        limits,
        visibleTests: [visible],
        hiddenTests: [],
        mode: "run",
      }),
    ).rejects.toBeInstanceOf(RunnerUnavailableError);
  });
});

function accepted(
  testId: string,
  expected: number,
  actual: number | undefined,
): TestExecutionResult {
  return {
    testId,
    verdict: "accepted",
    executionTimeMs: 7,
    expected,
    ...(actual === undefined ? {} : { actual }),
    stdout: "",
    stderr: "",
    exitCode: 0,
    signal: null,
  };
}

function fakeRunner(
  results: Record<string, TestExecutionResult>,
): LanguageRunner & {
  prepare: ReturnType<typeof vi.fn<LanguageRunner["prepare"]>>;
  cleanup: ReturnType<typeof vi.fn<LanguageRunner["cleanup"]>>;
} {
  const program: PreparedProgram = {
    language: "python",
    workspacePath: "/tmp/fake",
    preparationVerdict: "accepted",
    compileTimeMs: 12,
    compileStdout: "",
    compileStderr: "",
    compileExitCode: 0,
    compileSignal: null,
    testIds: Object.keys(results),
  };
  return {
    prepare: vi.fn(async () => program),
    runTest: vi.fn(async (_program, test) => results[test.id]!),
    cleanup: vi.fn(async () => undefined),
  };
}

function provider(runner: LanguageRunner): {
  get(language: Language): LanguageRunner | undefined;
} {
  return { get: () => runner };
}
