import type { Assessment } from "@gca-practice/contracts";
import type { ErrorObject } from "ajv";
import { validateAssessmentSchema } from "./schema.js";
import {
  validateAssessmentSemantics,
  type SemanticValidationIssue,
} from "./semanticValidator.js";

export interface JsonValidationIssue {
  stage: "json";
  code: "invalid_json";
  path: "$";
  message: string;
  line: number;
  column: number;
}

export interface SchemaValidationIssue {
  stage: "schema";
  code: "schema_validation";
  path: string;
  message: string;
}

export type AssessmentValidationIssue =
  | JsonValidationIssue
  | SchemaValidationIssue
  | SemanticValidationIssue;

export type AssessmentValidationResult =
  | {
      valid: true;
      assessment: Assessment;
      errors: [];
    }
  | {
      valid: false;
      assessment?: never;
      errors: AssessmentValidationIssue[];
    };

export function validateAssessment(
  source: string,
): AssessmentValidationResult {
  let value: unknown;

  try {
    value = JSON.parse(source) as unknown;
  } catch (error) {
    return {
      valid: false,
      errors: [createJsonIssue(source, error)],
    };
  }

  const schemaResult = validateAssessmentSchema(value);
  if (!schemaResult.valid) {
    return {
      valid: false,
      errors: schemaResult.errors.map(createSchemaIssue),
    };
  }

  const assessment = value as Assessment;
  const semanticIssues = validateAssessmentSemantics(assessment);
  if (semanticIssues.length > 0) {
    return {
      valid: false,
      errors: semanticIssues,
    };
  }

  return {
    valid: true,
    assessment,
    errors: [],
  };
}

function createJsonIssue(source: string, error: unknown): JsonValidationIssue {
  const errorMessage =
    error instanceof Error ? error.message : "Unknown JSON parsing error";
  const location = findJsonErrorLocation(source, errorMessage);

  return {
    stage: "json",
    code: "invalid_json",
    path: "$",
    line: location.line,
    column: location.column,
    message:
      `Invalid JSON at line ${location.line}, column ${location.column}: ` +
      errorMessage,
  };
}

function findJsonErrorLocation(
  source: string,
  errorMessage: string,
): { line: number; column: number } {
  const explicitLocation = /line (\d+) column (\d+)/i.exec(errorMessage);
  if (explicitLocation?.[1] && explicitLocation[2]) {
    return {
      line: Number.parseInt(explicitLocation[1], 10),
      column: Number.parseInt(explicitLocation[2], 10),
    };
  }

  const positionMatch = /position (\d+)/i.exec(errorMessage);
  const position = positionMatch?.[1]
    ? Number.parseInt(positionMatch[1], 10)
    : source.length;
  const prefix = source.slice(0, position);
  const lines = prefix.split("\n");

  return {
    line: lines.length,
    column: (lines.at(-1)?.length ?? 0) + 1,
  };
}

function createSchemaIssue(error: ErrorObject): SchemaValidationIssue {
  const path = schemaErrorPath(error);

  return {
    stage: "schema",
    code: "schema_validation",
    path,
    message: `${path} ${error.message ?? "is invalid"}`,
  };
}

function schemaErrorPath(error: ErrorObject): string {
  if (error.keyword === "required") {
    const missingProperty = (error.params as { missingProperty: string })
      .missingProperty;
    return `${error.instancePath}/${escapeJsonPointer(missingProperty)}`;
  }

  if (error.keyword === "additionalProperties") {
    const additionalProperty = (
      error.params as { additionalProperty: string }
    ).additionalProperty;
    return `${error.instancePath}/${escapeJsonPointer(additionalProperty)}`;
  }

  return error.instancePath || "/";
}

function escapeJsonPointer(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

