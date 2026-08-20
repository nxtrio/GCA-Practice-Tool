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

  it("accepts explicit GCA and resolves the legacy GCA shape", () => {
    const legacy = fixture();
    expect(legacy.assessment.preset).toBeUndefined();
    expect(validateDocument(legacy).valid).toBe(true);

    legacy.assessment.preset = "gca";
    expect(validateDocument(legacy).valid).toBe(true);
  });

  it("accepts a two-problem 50-minute Roblox assessment", () => {
    const result = validateAssessment(validRobloxFixtureSource);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.assessment.assessment).toMatchObject({
        preset: "roblox",
        durationSeconds: 3_000,
      });
      expect(result.assessment.assessment.problems).toHaveLength(2);
    }
  });

  it("accepts a two-problem 120-minute IMC assessment", () => {
    const result = validateAssessment(validImcFixtureSource);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.assessment.assessment).toMatchObject({
        preset: "imc",
        durationSeconds: 7_200,
      });
      expect(result.assessment.assessment.problems).toHaveLength(2);
    }
  });

  it.each([1, 3])("rejects IMC assessments with %i problem(s)", (count) => {
    const document = JSON.parse(validImcFixtureSource) as Assessment;
    if (count === 1) {
      document.assessment.problems.pop();
    } else {
      const p3 = structuredClone(document.assessment.problems[0]!);
      Object.assign(p3, { id: "p3", slot: 3 });
      document.assessment.problems.push(p3);
    }

    expect(errorsOf(validateDocument(document))).toContainEqual(
      expect.objectContaining({
        stage: "semantic",
        code: "problem_count",
        path: "/assessment/problems",
        message: `IMC Software Engineering Assessment requires exactly 2 problems; received ${count}.`,
      }),
    );
  });

  it.each([3_000, 4_200])("rejects IMC duration %i", (durationSeconds) => {
    const document = JSON.parse(validImcFixtureSource) as Assessment;
    document.assessment.durationSeconds = durationSeconds;

    expect(errorsOf(validateDocument(document))).toContainEqual({
      stage: "semantic",
      code: "invalid_duration",
      path: "/assessment/durationSeconds",
      message: "IMC Software Engineering Assessment must last exactly 7200 seconds (120 minutes).",
    });
  });

  it("rejects IMC assessments unless their slots are exactly 1 and 2", () => {
    const document = JSON.parse(validImcFixtureSource) as Assessment;
    document.assessment.problems[1]!.slot = 3;

    expect(errorsOf(validateDocument(document))).toContainEqual({
      stage: "semantic",
      code: "invalid_slots",
      path: "/assessment/problems",
      message: "IMC Software Engineering Assessment requires problem slots 1 and 2.",
    });
  });

  it("rejects unsupported preset identifiers at the schema boundary", () => {
    const document = JSON.parse(validImcFixtureSource) as Assessment;
    (document.assessment as { preset?: string }).preset = "unsupported";

    expect(errorsOf(validateDocument(document))).toContainEqual(
      expect.objectContaining({
        stage: "schema",
        path: "/assessment/preset",
      }),
    );
  });

  it("rejects Roblox assessments with the wrong problem count", () => {
    const document = JSON.parse(validRobloxFixtureSource) as Assessment;
    const p3 = structuredClone(document.assessment.problems[0]!);
    const p4 = structuredClone(document.assessment.problems[1]!);
    Object.assign(p3, { id: "p3", slot: 3 });
    Object.assign(p4, { id: "p4", slot: 4 });
    document.assessment.problems.push(p3, p4);

    expect(errorsOf(validateDocument(document))).toContainEqual({
      stage: "semantic",
      code: "problem_count",
      path: "/assessment/problems",
      message: "Roblox Coding Assessment requires exactly 2 problems; received 4.",
    });
  });

  it("rejects Roblox assessments with the wrong duration", () => {
    const document = JSON.parse(validRobloxFixtureSource) as Assessment;
    document.assessment.durationSeconds = 4_200;

    expect(errorsOf(validateDocument(document))).toContainEqual({
      stage: "semantic",
      code: "invalid_duration",
      path: "/assessment/durationSeconds",
      message: "Roblox Coding Assessment must last exactly 3000 seconds (50 minutes).",
    });
  });

  it("rejects Roblox assessments unless their slots are exactly 1 and 2", () => {
    const document = JSON.parse(validRobloxFixtureSource) as Assessment;
    document.assessment.problems[1]!.slot = 3;

    expect(errorsOf(validateDocument(document))).toContainEqual({
      stage: "semantic",
      code: "invalid_slots",
      path: "/assessment/problems",
      message: "Roblox Coding Assessment requires problem slots 1 and 2.",
    });
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
        "General Coding Assessment requires exactly 4 problems; received 3.",
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
