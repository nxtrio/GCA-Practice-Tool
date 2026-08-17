import { randomUUID } from "node:crypto";
import type { Assessment, Problem } from "@gca-practice/contracts";
import type { SqliteDatabase } from "../database.js";
import { contentFingerprint } from "../fingerprints.js";

export interface PersistedAssessment {
  id: string;
  title: string;
  schemaVersion: Assessment["schemaVersion"];
  durationSeconds: number;
  assessment: Assessment;
  contentHash: string;
  createdAt: string;
}

interface AssessmentRow {
  id: string;
  title: string;
  schema_version: string;
  duration_seconds: number;
  assessment_json: string;
  content_hash: string;
  created_at: string;
}

export interface AssessmentRepositoryOptions {
  now?: () => Date;
  idFactory?: () => string;
}

export class AssessmentRepository {
  private readonly now: () => Date;
  private readonly idFactory: () => string;

  constructor(
    private readonly database: SqliteDatabase,
    options: AssessmentRepositoryOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.idFactory = options.idFactory ?? randomUUID;
  }

  save(assessment: Assessment): PersistedAssessment {
    const id = this.idFactory();
    const createdAt = this.now().toISOString();
    const assessmentJson = JSON.stringify(assessment);
    const contentHash = contentFingerprint(assessment);

    this.database.transaction(() => {
      this.database
        .prepare(
          `INSERT INTO assessments (
             id, title, schema_version, duration_seconds, assessment_json,
             content_hash, created_at
           ) VALUES (
             @id, @title, @schemaVersion, @durationSeconds, @assessmentJson,
             @contentHash, @createdAt
           )`,
        )
        .run({
          id,
          title: assessment.assessment.title,
          schemaVersion: assessment.schemaVersion,
          durationSeconds: assessment.assessment.durationSeconds,
          assessmentJson,
          contentHash,
          createdAt,
        });

      const insertProblem = this.database.prepare(
         `INSERT INTO problem_catalog (
           id, assessment_id, problem_id, title, concept_summary,
           pattern_tags_json, complexity, signature_shape, content_hash, created_at
         ) VALUES (
           @id, @assessmentId, @problemId, @title, @conceptSummary,
           @patternTagsJson, @complexity, @signatureShape, @contentHash, @createdAt
         )`,
      );
      for (const problem of assessment.assessment.problems) {
        insertProblem.run({
          id: this.idFactory(),
          assessmentId: id,
          problemId: problem.id,
          title: problem.title,
          conceptSummary: problem.generationMetadata.conceptSummary,
          patternTagsJson: JSON.stringify(
            problem.generationMetadata.patternTags,
          ),
          complexity: problem.generationMetadata.expectedComplexity,
          signatureShape: signatureShape(problem.signature),
          contentHash: problemFingerprint(problem),
          createdAt,
        });
      }
    })();

    return {
      id,
      title: assessment.assessment.title,
      schemaVersion: assessment.schemaVersion,
      durationSeconds: assessment.assessment.durationSeconds,
      assessment: structuredClone(assessment),
      contentHash,
      createdAt,
    };
  }

  findById(id: string): PersistedAssessment | undefined {
    const row = this.database
      .prepare<[string], AssessmentRow>(
        "SELECT * FROM assessments WHERE id = ?",
      )
      .get(id);
    return row ? mapAssessment(row) : undefined;
  }

  list(): PersistedAssessment[] {
    return this.database
      .prepare<[], AssessmentRow>(
        "SELECT * FROM assessments ORDER BY created_at DESC, id DESC",
      )
      .all()
      .map(mapAssessment);
  }
}

function signatureShape(signature: Problem["signature"]): string {
  const parameters = signature.parameters
    .map(({ type }) => typeShape(type))
    .join(", ");
  return `(${parameters}) -> ${typeShape(signature.returnType)}`;
}

function typeShape(type: Problem["signature"]["returnType"]): string {
  return type.kind === "array" ? `array<${typeShape(type.items)}>` : type.kind;
}

function mapAssessment(row: AssessmentRow): PersistedAssessment {
  return {
    id: row.id,
    title: row.title,
    schemaVersion: row.schema_version as Assessment["schemaVersion"],
    durationSeconds: row.duration_seconds,
    assessment: JSON.parse(row.assessment_json) as Assessment,
    contentHash: row.content_hash,
    createdAt: row.created_at,
  };
}

function problemFingerprint(problem: Problem): string {
  return contentFingerprint(problem);
}
