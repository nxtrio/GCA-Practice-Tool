import type {
  Assessment,
  ExecutionVerdict,
  Problem,
  SupportedValue,
  TestCase,
  TestVisibility,
} from "@gca-practice/contracts";
import {
  detectPython,
  ProcessRunner,
  PythonRunner,
  type LanguageRunner,
  type TestExecutionResult,
} from "@gca-practice/runner-core";

export type OracleValidationCode =
  | "reference_compile_error"
  | "reference_runtime_error"
  | "reference_timeout"
  | "reference_output_limit"
  | "reference_internal_error"
  | "reference_output_mismatch";

export interface OracleValidationIssue {
  stage: "oracle";
  code: OracleValidationCode;
  path: string;
  message: string;
  problemId: string;
  problemIndex: number;
  testId?: string;
  visibility?: TestVisibility;
  declaredExpected?: SupportedValue;
  referenceActual?: SupportedValue;
  stdout?: string;
  stderr?: string;
}

export type OracleValidationResult =
  | { valid: true; errors: [] }
  | { valid: false; errors: OracleValidationIssue[] };

export interface AssessmentOracleValidator {
  validate(assessment: Assessment): Promise<OracleValidationResult>;
}

export class ReferenceOracleUnavailableError extends Error {
  constructor(readonly installationHint: string) {
    super(`Python reference validation is unavailable. ${installationHint}`);
    this.name = "ReferenceOracleUnavailableError";
  }
}

interface LocatedTest {
  test: TestCase;
  visibility: TestVisibility;
  index: number;
}

/** Validates imported expected values by running each problem's Python oracle. */
export class ReferenceSolutionValidator implements AssessmentOracleValidator {
  constructor(private readonly runner: LanguageRunner) {}

  static async create(
    processRunner = new ProcessRunner(),
    env: NodeJS.ProcessEnv = process.env,
  ): Promise<ReferenceSolutionValidator> {
    const toolchain = await detectPython(processRunner, env);
    if (!toolchain.available) {
      throw new ReferenceOracleUnavailableError(toolchain.installationHint);
    }

    return new ReferenceSolutionValidator(
      new PythonRunner(toolchain, processRunner),
    );
  }

  async validate(assessment: Assessment): Promise<OracleValidationResult> {
    const errors: OracleValidationIssue[] = [];

    for (const [problemIndex, problem] of
      assessment.assessment.problems.entries()) {
      errors.push(...(await this.validateProblem(problem, problemIndex)));
    }

    return errors.length === 0
      ? { valid: true, errors: [] }
      : { valid: false, errors };
  }

  private async validateProblem(
    problem: Problem,
    problemIndex: number,
  ): Promise<OracleValidationIssue[]> {
    const locatedTests = locateTests(problem);
    let program;

    try {
      program = await this.runner.prepare({
        language: "python",
        source: problem.validation.referenceSolution,
        signature: problem.signature,
        tests: locatedTests.map(({ test }) => test),
        limits: problem.limits,
      });
    } catch (error) {
      return [
        referenceIssue(problem, problemIndex, {
          code: "reference_internal_error",
          path: referencePath(problemIndex),
          message:
            `Problem ${problem.id}: the Python reference solution could not ` +
            `be prepared: ${errorMessage(error)}`,
        }),
      ];
    }

    try {
      if (program.preparationVerdict !== "accepted") {
        return [
          referenceIssue(problem, problemIndex, {
            code:
              program.preparationVerdict === "compile_error"
                ? "reference_compile_error"
                : "reference_internal_error",
            path: referencePath(problemIndex),
            message:
              `Problem ${problem.id}: the Python reference solution ` +
              (program.preparationVerdict === "compile_error"
                ? "does not compile."
                : "could not be compiled because of an internal runner error."),
            stdout: program.compileStdout,
            stderr: program.compileStderr,
          }),
        ];
      }

      const errors: OracleValidationIssue[] = [];
      for (const locatedTest of locatedTests) {
        const result = await this.runner.runTest(program, locatedTest.test);
        const issue = issueForTestResult(
          problem,
          problemIndex,
          locatedTest,
          result,
        );
        if (issue) errors.push(issue);
      }
      return errors;
    } finally {
      await this.runner.cleanup(program);
    }
  }
}

function locateTests(problem: Problem): LocatedTest[] {
  return (["visible", "hidden"] as const).flatMap((visibility) =>
    problem.tests[visibility].map((test, index) => ({
      test,
      visibility,
      index,
    })),
  );
}

function issueForTestResult(
  problem: Problem,
  problemIndex: number,
  locatedTest: LocatedTest,
  result: TestExecutionResult,
): OracleValidationIssue | undefined {
  if (result.verdict === "accepted") return undefined;

  const testPath =
    `/assessment/problems/${problemIndex}/tests/` +
    `${locatedTest.visibility}/${locatedTest.index}`;
  const location =
    `Problem ${problem.id}, ${capitalize(locatedTest.visibility)} test ` +
    `${locatedTest.test.id}`;
  const common = {
    testId: locatedTest.test.id,
    visibility: locatedTest.visibility,
    stdout: result.stdout,
    stderr: result.stderr,
  };

  if (result.verdict === "wrong_answer") {
    return referenceIssue(problem, problemIndex, {
      ...common,
      code: "reference_output_mismatch",
      path: `${testPath}/expected`,
      message:
        `${location}: declared expected ${serialize(locatedTest.test.expected)}, ` +
        `but the reference solution produced ${serialize(result.actual)}.`,
      declaredExpected: locatedTest.test.expected,
      ...(result.actual === undefined
        ? {}
        : { referenceActual: result.actual }),
    });
  }

  return referenceIssue(problem, problemIndex, {
    ...common,
    code: oracleCode(result.verdict),
    path: testPath,
    message: `${location}: ${oracleFailureMessage(result)}`,
  });
}

function oracleCode(
  verdict: Exclude<ExecutionVerdict, "accepted" | "wrong_answer">,
): OracleValidationCode {
  switch (verdict) {
    case "compile_error":
      return "reference_compile_error";
    case "runtime_error":
      return "reference_runtime_error";
    case "time_limit_exceeded":
      return "reference_timeout";
    case "output_limit_exceeded":
      return "reference_output_limit";
    case "internal_error":
      return "reference_internal_error";
  }
}

function oracleFailureMessage(result: TestExecutionResult): string {
  const fallback: Record<
    Exclude<ExecutionVerdict, "accepted" | "wrong_answer">,
    string
  > = {
    compile_error: "the reference solution does not compile.",
    runtime_error: "the reference solution failed at runtime.",
    time_limit_exceeded: "the reference solution exceeded the time limit.",
    output_limit_exceeded: "the reference solution exceeded the output limit.",
    internal_error: "the reference solution hit an internal runner error.",
  };

  return result.message ?? fallback[result.verdict as keyof typeof fallback];
}

function referenceIssue(
  problem: Problem,
  problemIndex: number,
  issue: Omit<
    OracleValidationIssue,
    "stage" | "problemId" | "problemIndex"
  >,
): OracleValidationIssue {
  return {
    stage: "oracle",
    problemId: problem.id,
    problemIndex,
    ...issue,
  };
}

function referencePath(problemIndex: number): string {
  return `/assessment/problems/${problemIndex}/validation/referenceSolution`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function serialize(value: SupportedValue | undefined): string {
  return value === undefined ? "no value" : JSON.stringify(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown runner error";
}
