import type { RunResult, TestResult } from "@gca-practice/contracts";

/** Whitelists execution response fields so hidden payloads cannot cross HTTP. */
export function redactRunResultForApi(result: RunResult): RunResult {
  return {
    verdict: result.verdict,
    ...(result.compileTimeMs === undefined
      ? {}
      : { compileTimeMs: result.compileTimeMs }),
    passed: result.passed,
    total: result.total,
    tests: result.tests.map(redactTestResult),
  };
}

function redactTestResult(test: TestResult): TestResult {
  if (test.visibility === "hidden") {
    return {
      visibility: "hidden",
      verdict: test.verdict,
      executionTimeMs: test.executionTimeMs,
    };
  }
  return {
    visibility: "visible",
    testId: test.testId,
    verdict: test.verdict,
    executionTimeMs: test.executionTimeMs,
    expected: test.expected,
    ...(test.actual === undefined ? {} : { actual: test.actual }),
    ...(test.stdout === undefined ? {} : { stdout: test.stdout }),
    ...(test.stderr === undefined ? {} : { stderr: test.stderr }),
    ...(test.message === undefined ? {} : { message: test.message }),
  };
}
