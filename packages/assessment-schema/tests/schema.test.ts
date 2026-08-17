import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateAssessmentSchema } from "../src/schema.ts";

describe("assessment schema", () => {
  it("accepts the canonical valid GCA fixture", () => {
    const fixturePath = new URL(
      "../../../fixtures/assessments/valid-gca.json",
      import.meta.url,
    );
    const fixture: unknown = JSON.parse(readFileSync(fixturePath, "utf8"));

    expect(validateAssessmentSchema(fixture)).toEqual({
      valid: true,
      errors: [],
    });
  });
});
