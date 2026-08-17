import { readFileSync } from "node:fs";
import type { Assessment } from "@gca-practice/contracts";
import { describe, expect, it } from "vitest";
import {
  validateAssessment,
  type AssessmentValidationIssue,
  type AssessmentValidationResult,
} from "../src/validateAssessment.ts";

const validFixtureUrl = new URL(
  "../../../fixtures/assessments/valid-gca.json",
  import.meta.url,
);
const invalidJsonFixtureUrl = new URL(
  "../../../fixtures/assessments/invalid/invalid-json.json",
  import.meta.url,
);
const validFixtureSource = readFileSync(validFixtureUrl, "utf8");

function fixture(): Assessment {
  return JSON.parse(validFixtureSource) as Assessment;
}

function validateDocument(document: unknown): AssessmentValidationResult {
  return validateAssessment(JSON.stringify(document));
}

function errorsOf(
  result: AssessmentValidationResult,
): AssessmentValidationIssue[] {
  if (result.valid) {
    throw new Error("Expected assessment validation to fail");
  }
  return result.errors;
}

describe("validateAssessment", () => {
  it("accepts the canonical valid fixture", () => {
    const result = validateAssessment(validFixtureSource);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.assessment.assessment.problems).toHaveLength(4);
      expect(result.errors).toEqual([]);
    }
  });

  it("reports malformed JSON with its distinct stage and location", () => {
    const source = readFileSync(invalidJsonFixtureUrl, "utf8");
    const errors = errorsOf(validateAssessment(source));

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      stage: "json",
      code: "invalid_json",
      path: "$",
    });
    expect(errors[0]?.message).toMatch(
      /^Invalid JSON at line \d+, column \d+:/,
    );
  });

  it("reports schema-version failures at a specific path", () => {
    const document = fixture();
    (document as unknown as { schemaVersion: string }).schemaVersion = "2.0";

    const errors = errorsOf(validateDocument(document));

    expect(errors).toContainEqual(
      expect.objectContaining({
        stage: "schema",
        path: "/schemaVersion",
      }),
    );
    expect(errors.every((error) => error.stage === "schema")).toBe(true);
  });

  it("reports missing required fields at the missing field's path", () => {
    const document = fixture();
    const firstProblem = document.assessment.problems[0] as unknown as Record<
      string,
      unknown
    >;
    delete firstProblem.title;

    expect(errorsOf(validateDocument(document))).toContainEqual(
      expect.objectContaining({
        stage: "schema",
        path: "/assessment/problems/0/title",
      }),
    );
  });

  it("rejects unsupported TypeSpec values during schema validation", () => {
    const document = fixture();
    const parameterType = document.assessment.problems[0]?.signature.parameters[0]
      ?.type as unknown as Record<string, unknown>;
    parameterType.kind = "map";
    delete parameterType.items;

    const errors = errorsOf(validateDocument(document));

    expect(errors).toContainEqual(
      expect.objectContaining({
        stage: "schema",
        path: "/assessment/problems/0/signature/parameters/0/type/kind",
      }),
    );
  });

  it("rejects malformed execution limits during schema validation", () => {
    const document = fixture();
    document.assessment.problems[0]!.limits.executionTimeMs = 0;

    expect(errorsOf(validateDocument(document))).toContainEqual(
      expect.objectContaining({
        stage: "schema",
        path: "/assessment/problems/0/limits/executionTimeMs",
      }),
    );
  });

  it("requires exactly four problems", () => {
    const document = fixture();
    document.assessment.problems.pop();

    expect(errorsOf(validateDocument(document))).toContainEqual({
      stage: "semantic",
      code: "problem_count",
      path: "/assessment/problems",
      message:
        "Exactly four problems are required for the default GCA preset; received 3.",
    });
  });

  it("rejects duplicate problem IDs", () => {
    const document = fixture();
    document.assessment.problems[1]!.id =
      document.assessment.problems[0]!.id;

    expect(errorsOf(validateDocument(document))).toContainEqual({
      stage: "semantic",
      code: "duplicate_problem_id",
      path: "/assessment/problems/1/id",
      message:
        'Problem ID "p1" duplicates /assessment/problems/0/id.',
    });
  });

  it("requires visible and hidden tests", () => {
    const document = fixture();
    document.assessment.problems[0]!.tests.visible = [];
    document.assessment.problems[1]!.tests.hidden = [];

    const errors = errorsOf(validateDocument(document));

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "semantic",
          code: "missing_visible_tests",
          path: "/assessment/problems/0/tests/visible",
        }),
        expect.objectContaining({
          stage: "semantic",
          code: "missing_hidden_tests",
          path: "/assessment/problems/1/tests/hidden",
        }),
      ]),
    );
  });

  it("requires portable and unique function parameter identifiers", () => {
    const document = fixture();
    document.assessment.problems[0]!.signature.name = "class";
    document.assessment.problems[0]!.signature.parameters[0]!.name =
      "two words";
    document.assessment.problems[1]!.signature.parameters.push({
      name: "text",
      type: { kind: "string" },
    });

    const errors = errorsOf(validateDocument(document));

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid_function_name",
          path: "/assessment/problems/0/signature/name",
        }),
        expect.objectContaining({
          code: "invalid_parameter_name",
          path: "/assessment/problems/0/signature/parameters/0/name",
        }),
        expect.objectContaining({
          code: "duplicate_parameter_name",
          path: "/assessment/problems/1/signature/parameters/1/name",
        }),
      ]),
    );
  });

  it("requires test IDs to be unique across a problem's test collections", () => {
    const document = fixture();
    document.assessment.problems[0]!.tests.hidden[0]!.id =
      document.assessment.problems[0]!.tests.visible[0]!.id;

    expect(errorsOf(validateDocument(document))).toContainEqual({
      stage: "semantic",
      code: "duplicate_test_id",
      path: "/assessment/problems/0/tests/hidden/0/id",
      message:
        'Test ID "p1-v1" duplicates /assessment/problems/0/tests/visible/0/id.',
    });
  });

  it("rejects incorrect testcase argument counts", () => {
    const document = fixture();
    document.assessment.problems[0]!.tests.visible[0]!.arguments.push(9);

    expect(errorsOf(validateDocument(document))).toContainEqual({
      stage: "semantic",
      code: "argument_count",
      path: "/assessment/problems/0/tests/visible/0/arguments",
      message: "solution() accepts 1 argument; received 2.",
    });
  });

  it("reports the exact nested path for incompatible argument values", () => {
    const document = fixture();
    document.assessment.problems[2]!.tests.hidden[0]!.arguments = [
      [[1], ["not-an-int"]],
    ];

    expect(errorsOf(validateDocument(document))).toContainEqual({
      stage: "semantic",
      code: "argument_type",
      path: "/assessment/problems/2/tests/hidden/0/arguments/0/1/0",
      message:
        "Argument 1 (matrix) must match array<array<int>>; received string.",
    });
  });

  it("rejects testcase expected values that do not match the return type", () => {
    const document = fixture();
    document.assessment.problems[3]!.tests.visible[0]!.expected = "false";

    expect(errorsOf(validateDocument(document))).toContainEqual({
      stage: "semantic",
      code: "expected_type",
      path: "/assessment/problems/3/tests/visible/0/expected",
      message: "Output must match boolean; received string.",
    });
  });

  it("validates example argument counts, values, and outputs", () => {
    const document = fixture();
    document.assessment.problems[0]!.examples[0]!.arguments = [[1], true];
    document.assessment.problems[1]!.examples[0]!.arguments = [false];
    document.assessment.problems[3]!.examples[0]!.output = "false";

    const errors = errorsOf(validateDocument(document));

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "example_argument_count",
          path: "/assessment/problems/0/examples/0/arguments",
        }),
        expect.objectContaining({
          code: "example_argument_type",
          path: "/assessment/problems/1/examples/0/arguments/0",
        }),
        expect.objectContaining({
          code: "example_output_type",
          path: "/assessment/problems/3/examples/0/output",
        }),
      ]),
    );
  });

  it("enforces integer ranges, safe duration/limits, and reference presence", () => {
    const document = fixture();
    document.assessment.durationSeconds = Number.MAX_SAFE_INTEGER + 1;
    document.assessment.problems[0]!.limits.outputLimitBytes =
      Number.MAX_SAFE_INTEGER + 1;
    document.assessment.problems[1]!.limits.executionTimeMs = 10_001;
    document.assessment.problems[0]!.tests.visible[0]!.expected =
      2_147_483_648;
    document.assessment.problems[2]!.tests.hidden[0]!.expected =
      Number.MAX_SAFE_INTEGER + 1;
    document.assessment.problems[0]!.validation.referenceSolution = "   ";

    const errors = errorsOf(validateDocument(document));

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid_duration" }),
        expect.objectContaining({ code: "invalid_limit" }),
        expect.objectContaining({
          code: "invalid_limit",
          path: "/assessment/problems/1/limits/executionTimeMs",
        }),
        expect.objectContaining({
          code: "expected_type",
          path: "/assessment/problems/0/tests/visible/0/expected",
        }),
        expect.objectContaining({
          code: "expected_type",
          path: "/assessment/problems/2/tests/hidden/0/expected",
        }),
        expect.objectContaining({ code: "empty_reference_solution" }),
      ]),
    );
    expect(errors.every((error) => error.stage === "semantic")).toBe(true);
  });

  it("requires the 70-minute default GCA duration", () => {
    const document = fixture();
    document.assessment.durationSeconds = 3600;

    expect(errorsOf(validateDocument(document))).toContainEqual(
      expect.objectContaining({
        stage: "semantic",
        code: "invalid_duration",
        path: "/assessment/durationSeconds",
      }),
    );
  });
});
