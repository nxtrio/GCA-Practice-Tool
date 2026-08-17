import { randomUUID } from "node:crypto";
import type {
  AssessmentImportValidationIssue,
  AssessmentImportValidationResult,
} from "@gca-practice/assessment-schema";
import type { Assessment } from "@gca-practice/contracts";
import type { PersistedAssessment } from "../persistence/repositories/AssessmentRepository.js";
import type { ProblemCatalogRepository } from "../persistence/repositories/ProblemCatalogRepository.js";
import { contentFingerprint } from "../persistence/fingerprints.js";
import type { ImportService } from "./ImportService.js";
import {
  assessmentDraftToView,
  type SafeAssessmentDraftView,
} from "./assessmentView.js";

const DEFAULT_VALIDATION_TTL_MS = 15 * 60 * 1_000;

interface ImportValidator {
  validateAssessment(source: string): Promise<AssessmentImportValidationResult>;
  persistValidated(assessment: Assessment): PersistedAssessment;
}

interface CachedValidation {
  assessment: Assessment;
  expiresAt: number;
}

export interface ImportWorkflowOptions {
  now?: () => number;
  idFactory?: () => string;
  validationTtlMs?: number;
  problemCatalog?: Pick<ProblemCatalogRepository, "findByContentHash">;
}

export type ImportValidationResponse =
  | {
      valid: false;
      errors: AssessmentImportValidationIssue[];
      warnings: [];
    }
  | {
      valid: true;
      validationId: string;
      assessment: SafeAssessmentDraftView;
      errors: [];
      warnings: string[];
    };

export class ValidationTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationTokenError";
  }
}

/** Holds fully validated authoring documents server-side until import is committed. */
export class ImportWorkflowService {
  private readonly cache = new Map<string, CachedValidation>();
  private readonly now: () => number;
  private readonly idFactory: () => string;
  private readonly validationTtlMs: number;
  private readonly problemCatalog:
    | Pick<ProblemCatalogRepository, "findByContentHash">
    | undefined;

  constructor(
    private readonly importer: ImportValidator | ImportService,
    options: ImportWorkflowOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.idFactory = options.idFactory ?? randomUUID;
    this.validationTtlMs = options.validationTtlMs ?? DEFAULT_VALIDATION_TTL_MS;
    this.problemCatalog = options.problemCatalog;
  }

  async validate(source: string): Promise<ImportValidationResponse> {
    this.removeExpired();
    const result = await this.importer.validateAssessment(source);
    if (!result.valid) {
      return { valid: false, errors: result.errors, warnings: [] };
    }

    const validationId = this.idFactory();
    this.cache.set(validationId, {
      assessment: structuredClone(result.assessment),
      expiresAt: this.now() + this.validationTtlMs,
    });
    return {
      valid: true,
      validationId,
      assessment: assessmentDraftToView(result.assessment),
      errors: [],
      warnings: qualityWarnings(result.assessment, this.problemCatalog),
    };
  }

  commit(validationId: string): PersistedAssessment {
    const cached = this.cache.get(validationId);
    if (!cached) {
      throw new ValidationTokenError(
        "Validation expired or was already used. Paste the JSON again to revalidate it.",
      );
    }
    if (cached.expiresAt <= this.now()) {
      this.cache.delete(validationId);
      throw new ValidationTokenError(
        "Validation expired. Paste the JSON again to revalidate it.",
      );
    }

    this.cache.delete(validationId);
    return this.importer.persistValidated(cached.assessment);
  }

  private removeExpired(): void {
    const now = this.now();
    for (const [id, value] of this.cache) {
      if (value.expiresAt <= now) this.cache.delete(id);
    }
  }
}

function qualityWarnings(
  assessment: Assessment,
  problemCatalog?: Pick<ProblemCatalogRepository, "findByContentHash">,
): string[] {
  const warnings: string[] = [];
  for (const problem of assessment.assessment.problems) {
    if (
      problemCatalog?.findByContentHash(contentFingerprint(problem)).length
    ) {
      warnings.push(
        `${problem.title} exactly duplicates a previously imported problem.`,
      );
    }
    if (problem.tests.hidden.length < 8) {
      warnings.push(
        `${problem.title} contains only ${problem.tests.hidden.length} hidden ${plural(problem.tests.hidden.length)}.`,
      );
    }
    if (problem.tests.visible.length < 2) {
      warnings.push(
        `${problem.title} contains only ${problem.tests.visible.length} visible ${plural(problem.tests.visible.length)}.`,
      );
    }
  }

  const problems = assessment.assessment.problems;
  for (let leftIndex = 0; leftIndex < problems.length; leftIndex += 1) {
    const left = problems[leftIndex]!;
    const leftTags = new Set(left.generationMetadata.patternTags);
    for (let rightIndex = leftIndex + 1; rightIndex < problems.length; rightIndex += 1) {
      const right = problems[rightIndex]!;
      if (right.generationMetadata.patternTags.some((tag) => leftTags.has(tag))) {
        warnings.push(`${left.title} and ${right.title} share pattern tags.`);
      }
    }
  }
  return warnings;
}

function plural(count: number): "test" | "tests" {
  return count === 1 ? "test" : "tests";
}
