import type { Assessment } from "@gca-practice/contracts";
import type {
  AssessmentOracleValidator,
  OracleValidationIssue,
} from "./oracleValidator.js";
import {
  validateAssessment,
  type AssessmentValidationIssue,
} from "./validateAssessment.js";

export type AssessmentImportValidationIssue =
  | AssessmentValidationIssue
  | OracleValidationIssue;

export type AssessmentImportValidationResult =
  | {
      valid: true;
      assessment: Assessment;
      errors: [];
    }
  | {
      valid: false;
      assessment?: never;
      errors: AssessmentImportValidationIssue[];
    };

/** Runs JSON, schema, semantic, then reference-oracle validation in order. */
export async function validateAssessmentWithOracle(
  source: string,
  oracleValidator: AssessmentOracleValidator,
): Promise<AssessmentImportValidationResult> {
  const structuralResult = validateAssessment(source);
  if (!structuralResult.valid) return structuralResult;

  const oracleResult = await oracleValidator.validate(
    structuralResult.assessment,
  );
  if (!oracleResult.valid) {
    return { valid: false, errors: oracleResult.errors };
  }

  return structuralResult;
}
