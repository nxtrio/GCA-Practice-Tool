import {
  validateAssessmentWithOracle,
  type AssessmentImportValidationIssue,
  type AssessmentImportValidationResult,
  type AssessmentOracleValidator,
} from "@gca-practice/assessment-schema";
import type { Assessment } from "@gca-practice/contracts";
import {
  AssessmentRepository,
  type PersistedAssessment,
} from "../persistence/repositories/AssessmentRepository.js";

export type AssessmentImportResult =
  | {
      imported: true;
      assessment: PersistedAssessment;
      errors: [];
    }
  | {
      imported: false;
      assessment?: never;
      errors: AssessmentImportValidationIssue[];
    };

export class ImportService {
  constructor(
    private readonly validator: AssessmentOracleValidator,
    private readonly assessments: AssessmentRepository,
  ) {}

  async importAssessment(source: string): Promise<AssessmentImportResult> {
    const validation = await this.validateAssessment(source);
    if (!validation.valid) {
      return { imported: false, errors: validation.errors };
    }

    return {
      imported: true,
      assessment: this.persistValidated(validation.assessment),
      errors: [],
    };
  }

  validateAssessment(source: string): Promise<AssessmentImportValidationResult> {
    return validateAssessmentWithOracle(source, this.validator);
  }

  persistValidated(assessment: Assessment): PersistedAssessment {
    return this.assessments.save(assessment);
  }
}
