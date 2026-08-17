import type {
  Language,
  Session,
  SessionStatus,
} from "@gca-practice/contracts";
import type { SqliteDatabase } from "../database.js";

interface SessionRow {
  id: string;
  assessment_id: string;
  status: SessionStatus;
  started_at: string | null;
  expires_at: string | null;
  finished_at: string | null;
  created_at: string;
}

interface SessionCodeRow {
  session_id: string;
  problem_id: string;
  language: Language;
  source: string;
  updated_at: string;
}

export interface SessionCode {
  sessionId: string;
  problemId: string;
  language: Language;
  source: string;
  updatedAt: string;
}

export class SessionRepository {
  constructor(private readonly database: SqliteDatabase) {}

  createActive(input: {
    id: string;
    assessmentId: string;
    startedAt: string;
    expiresAt: string;
    createdAt: string;
  }): Session {
    this.database
      .prepare(
        `INSERT INTO sessions (
           id, assessment_id, status, started_at, expires_at, finished_at,
           created_at
         ) VALUES (
           @id, @assessmentId, 'active', @startedAt, @expiresAt, NULL,
           @createdAt
         )`,
      )
      .run(input);

    return {
      id: input.id,
      assessmentId: input.assessmentId,
      status: "active",
      startedAt: input.startedAt,
      expiresAt: input.expiresAt,
      finishedAt: null,
      createdAt: input.createdAt,
    };
  }

  findById(id: string): Session | undefined {
    const row = this.database
      .prepare<[string], SessionRow>("SELECT * FROM sessions WHERE id = ?")
      .get(id);
    return row ? mapSession(row) : undefined;
  }

  list(): Session[] {
    return this.database
      .prepare<[], SessionRow>(
        "SELECT * FROM sessions ORDER BY created_at DESC, id DESC",
      )
      .all()
      .map(mapSession);
  }

  setStatus(
    id: string,
    fromStatus: SessionStatus,
    status: SessionStatus,
    finishedAt: string | null,
  ): boolean {
    const result = this.database
      .prepare(
        `UPDATE sessions
         SET status = @status, finished_at = @finishedAt
         WHERE id = @id AND status = @fromStatus`,
      )
      .run({ id, fromStatus, status, finishedAt });
    return result.changes === 1;
  }

  saveCode(input: SessionCode): SessionCode {
    this.database
      .prepare(
        `INSERT INTO session_code (
           session_id, problem_id, language, source, updated_at
         ) VALUES (
           @sessionId, @problemId, @language, @source, @updatedAt
         )
         ON CONFLICT (session_id, problem_id, language) DO UPDATE SET
           source = excluded.source,
           updated_at = excluded.updated_at`,
      )
      .run(input);
    return { ...input };
  }

  findCode(
    sessionId: string,
    problemId: string,
    language: Language,
  ): SessionCode | undefined {
    const row = this.database
      .prepare<[string, string, Language], SessionCodeRow>(
        `SELECT * FROM session_code
         WHERE session_id = ? AND problem_id = ? AND language = ?`,
      )
      .get(sessionId, problemId, language);
    return row ? mapCode(row) : undefined;
  }

  listCode(sessionId: string): SessionCode[] {
    return this.database
      .prepare<[string], SessionCodeRow>(
        `SELECT * FROM session_code
         WHERE session_id = ?
         ORDER BY problem_id, language`,
      )
      .all(sessionId)
      .map(mapCode);
  }
}

function mapSession(row: SessionRow): Session {
  return {
    id: row.id,
    assessmentId: row.assessment_id,
    status: row.status,
    startedAt: row.started_at,
    expiresAt: row.expires_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
  };
}

function mapCode(row: SessionCodeRow): SessionCode {
  return {
    sessionId: row.session_id,
    problemId: row.problem_id,
    language: row.language,
    source: row.source,
    updatedAt: row.updated_at,
  };
}
