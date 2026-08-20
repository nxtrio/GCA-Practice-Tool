import { readFileSync } from "node:fs";
import type { Assessment } from "@gca-practice/contracts";
import { ProcessRunner } from "@gca-practice/runner-core";
import { beforeAll, describe, expect, it } from "vitest";
import {
  ReferenceOracleUnavailableError,
  ReferenceSolutionValidator,
  type AssessmentOracleValidator,
  type OracleValidationIssue,
} from "../src/oracleValidator.ts";
import {
  validateAssessmentWithOracle,
  type AssessmentImportValidationResult,
} from "../src/validateAssessmentWithOracle.ts";

const validFixtureUrl = new URL(
  "../../../fixtures/assessments/valid-gca.json",
  import.meta.url,
);
const validFixtureSource = readFileSync(validFixtureUrl, "utf8");
const validRobloxFixtureSource = readFileSync(
  new URL("../../../fixtures/assessments/valid-roblox.json", import.meta.url),
  "utf8",
);
const validImcFixtureSource = readFileSync(
  new URL("../../../fixtures/assessments/valid-imc.json", import.meta.url),
  "utf8",
);

function fixture(): Assessment {
  return JSON.parse(validFixtureSource) as Assessment;
}

function errorsOf(
  result: AssessmentImportValidationResult,
): OracleValidationIssue[] {
  if (result.valid) throw new Error("Expected oracle validation to fail");
  if (result.errors.some((error) => error.stage !== "oracle")) {
    throw new Error("Expected only oracle validation issues");
  }
  return result.errors as OracleValidationIssue[];
}

describe("ReferenceSolutionValidator", () => {
  let validator: ReferenceSolutionValidator;

  beforeAll(async () => {
    validator = await ReferenceSolutionValidator.create();
  });

  it("accepts the canonical fixture after executing every reference testcase", async () => {
    const result = await validateAssessmentWithOracle(
      validFixtureSource,
      validator,
    );

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.assessment.assessment.problems).toHaveLength(4);
      expect(result.errors).toEqual([]);
    }
  });

  it("accepts the canonical Roblox fixture after executing every reference testcase", async () => {
    const result = await validateAssessmentWithOracle(
      validRobloxFixtureSource,
      validator,
    );

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.assessment.assessment).toMatchObject({
        preset: "roblox",
        durationSeconds: 3_000,
      });
      expect(result.assessment.assessment.problems).toHaveLength(2);
      expect(result.errors).toEqual([]);
    }
  });

  it("accepts the canonical IMC fixture after executing every reference testcase", async () => {
    const result = await validateAssessmentWithOracle(
      validImcFixtureSource,
      validator,
    );

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.assessment.assessment).toMatchObject({
        preset: "imc",
        durationSeconds: 7_200,
      });
      expect(result.assessment.assessment.problems).toHaveLength(2);
      expect(result.errors).toEqual([]);
    }
  });

  it("rejects a wrong hidden expected value at the exact problem and test", async () => {
    const document = fixture();
    document.assessment.problems[2]!.tests.hidden[0]!.expected = -1;

    const errors = errorsOf(
      await validateAssessmentWithOracle(JSON.stringify(document), validator),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      stage: "oracle",
      code: "reference_output_mismatch",
      path: "/assessment/problems/2/tests/hidden/0/expected",
      problemId: "p3",
      problemIndex: 2,
      testId: "p3-h1",
      visibility: "hidden",
      declaredExpected: -1,
      referenceActual: -2,
    });
    expect(errors[0]?.message).toContain("Problem p3, Hidden test p3-h1");
  });

  it("rejects a broken reference solution at its exact source path", async () => {
    const document = fixture();
    document.assessment.problems[1]!.validation.referenceSolution =
      "def solution(text)\n    return text";

    const errors = errorsOf(
      await validateAssessmentWithOracle(JSON.stringify(document), validator),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      stage: "oracle",
      code: "reference_compile_error",
      path: "/assessment/problems/1/validation/referenceSolution",
      problemId: "p2",
      problemIndex: 1,
    });
    expect(errors[0]?.stderr).toMatch(/SyntaxError/);
  });

  it("does not run the oracle when an earlier validation layer fails", async () => {
    const document = fixture();
    document.assessment.problems.pop();
    let calls = 0;
    const oracle: AssessmentOracleValidator = {
      async validate() {
        calls += 1;
        return { valid: true, errors: [] };
      },
    };

    const result = await validateAssessmentWithOracle(
      JSON.stringify(document),
      oracle,
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors[0]).toMatchObject({
        stage: "semantic",
        code: "problem_count",
      });
    }
    expect(calls).toBe(0);
  });

  it("provides an actionable error when Python is unavailable", async () => {
    await expect(
      ReferenceSolutionValidator.create(new ProcessRunner(), { PATH: "" }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ReferenceOracleUnavailableError>>({
        name: "ReferenceOracleUnavailableError",
        installationHint: expect.stringContaining("Python 3"),
      }),
    );
  });
});
