import type { SqliteDatabase } from "../database.js";

export interface ProblemCatalogEntry {
  id: string;
  assessmentId: string;
  problemId: string;
  title: string;
  conceptSummary: string;
  patternTags: string[];
  complexity: string;
  signatureShape: string;
  contentHash: string;
  createdAt: string;
}

interface ProblemCatalogRow {
  id: string;
  assessment_id: string;
  problem_id: string;
  title: string;
  concept_summary: string;
  pattern_tags_json: string;
  complexity: string;
  signature_shape: string;
  content_hash: string;
  created_at: string;
}

export class ProblemCatalogRepository {
  constructor(private readonly database: SqliteDatabase) {}

  listForAssessment(assessmentId: string): ProblemCatalogEntry[] {
    return this.database
      .prepare<[string], ProblemCatalogRow>(
        `SELECT * FROM problem_catalog
         WHERE assessment_id = ?
         ORDER BY created_at, problem_id`,
      )
      .all(assessmentId)
      .map(mapProblem);
  }

  findByContentHash(contentHash: string): ProblemCatalogEntry[] {
    return this.database
      .prepare<[string], ProblemCatalogRow>(
        `SELECT * FROM problem_catalog
         WHERE content_hash = ?
         ORDER BY created_at DESC`,
      )
      .all(contentHash)
      .map(mapProblem);
  }

  listRecent(limit = 100): ProblemCatalogEntry[] {
    return this.database
      .prepare<[number], ProblemCatalogRow>(
        `SELECT * FROM problem_catalog
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
      )
      .all(limit)
      .map(mapProblem);
  }
}

function mapProblem(row: ProblemCatalogRow): ProblemCatalogEntry {
  return {
    id: row.id,
    assessmentId: row.assessment_id,
    problemId: row.problem_id,
    title: row.title,
    conceptSummary: row.concept_summary,
    patternTags: JSON.parse(row.pattern_tags_json) as string[],
    complexity: row.complexity,
    signatureShape: row.signature_shape,
    contentHash: row.content_hash,
    createdAt: row.created_at,
  };
}
