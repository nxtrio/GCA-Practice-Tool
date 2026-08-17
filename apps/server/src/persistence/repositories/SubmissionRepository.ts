import type {
  Language,
  RunResult,
  Submission,
} from "@gca-practice/contracts";
import type { SqliteDatabase } from "../database.js";

interface SubmissionRow {
  id: string;
  session_id: string;
  problem_id: string;
  language: Language;
  submission_type: "run" | "submit";
  submitted_at: string;
  passed: number;
  total: number;
  result_json: string;
}

export class SubmissionRepository {
  constructor(private readonly database: SqliteDatabase) {}

  save(submission: Submission): Submission {
    this.database
      .prepare(
        `INSERT INTO submissions (
           id, session_id, problem_id, language, submission_type,
           submitted_at, passed, total, result_json
         ) VALUES (
           @id, @sessionId, @problemId, @language, @submissionType,
           @submittedAt, @passed, @total, @resultJson
         )`,
      )
      .run({
        id: submission.id,
        sessionId: submission.sessionId,
        problemId: submission.problemId,
        language: submission.language,
        submissionType: submission.submissionType,
        submittedAt: submission.submittedAt,
        passed: submission.passed,
        total: submission.total,
        resultJson: JSON.stringify(submission.result),
      });
    return structuredClone(submission);
  }

  listForSession(sessionId: string): Submission[] {
    return this.database
      .prepare<[string], SubmissionRow>(
        `SELECT * FROM submissions
         WHERE session_id = ?
         ORDER BY submitted_at, id`,
      )
      .all(sessionId)
      .map(mapSubmission);
  }
}

function mapSubmission(row: SubmissionRow): Submission {
  return {
    id: row.id,
    sessionId: row.session_id,
    problemId: row.problem_id,
    language: row.language,
    submissionType: row.submission_type,
    submittedAt: row.submitted_at,
    passed: row.passed,
    total: row.total,
    result: JSON.parse(row.result_json) as RunResult,
  };
}
