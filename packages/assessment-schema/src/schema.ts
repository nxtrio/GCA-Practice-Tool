import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  Ajv,
  type ErrorObject,
  type ValidateFunction,
} from "ajv";
import type { Assessment } from "@gca-practice/contracts";

export const assessmentSchemaPath = fileURLToPath(
  new URL("../assessment.schema.json", import.meta.url),
);

const assessmentSchema: object = JSON.parse(
  readFileSync(assessmentSchemaPath, "utf8"),
);

const ajv = new Ajv({ allErrors: true, strict: true });
const validate: ValidateFunction<Assessment> =
  ajv.compile<Assessment>(assessmentSchema);

export interface SchemaValidationResult {
  valid: boolean;
  errors: ErrorObject[];
}

export function validateAssessmentSchema(
  value: unknown,
): SchemaValidationResult {
  const valid = validate(value);

  return {
    valid,
    errors: validate.errors ? [...validate.errors] : [],
  };
}
