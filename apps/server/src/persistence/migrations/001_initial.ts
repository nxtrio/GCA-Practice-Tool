export const initialMigration = {
  version: 1,
  name: "initial_persistence",
  sql: `
    CREATE TABLE assessments (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      schema_version TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
      assessment_json TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX assessments_created_at_idx
      ON assessments(created_at DESC);
    CREATE INDEX assessments_content_hash_idx
      ON assessments(content_hash);

    CREATE TABLE problem_catalog (
      id TEXT PRIMARY KEY,
      assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
      problem_id TEXT NOT NULL,
      title TEXT NOT NULL,
      concept_summary TEXT NOT NULL,
      pattern_tags_json TEXT NOT NULL,
      complexity TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (assessment_id, problem_id)
    );

    CREATE INDEX problem_catalog_created_at_idx
      ON problem_catalog(created_at DESC);
    CREATE INDEX problem_catalog_content_hash_idx
      ON problem_catalog(content_hash);

    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      assessment_id TEXT NOT NULL REFERENCES assessments(id),
      status TEXT NOT NULL CHECK (
        status IN ('not_started', 'active', 'completed', 'expired', 'abandoned')
      ),
      started_at TEXT,
      expires_at TEXT,
      finished_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX sessions_assessment_id_idx ON sessions(assessment_id);
    CREATE INDEX sessions_status_idx ON sessions(status);

    CREATE TABLE session_code (
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      problem_id TEXT NOT NULL,
      language TEXT NOT NULL CHECK (language IN ('java', 'cpp', 'python')),
      source TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (session_id, problem_id, language)
    );

    CREATE TABLE submissions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      problem_id TEXT NOT NULL,
      language TEXT NOT NULL CHECK (language IN ('java', 'cpp', 'python')),
      submission_type TEXT NOT NULL CHECK (submission_type IN ('run', 'submit')),
      submitted_at TEXT NOT NULL,
      passed INTEGER NOT NULL CHECK (passed >= 0),
      total INTEGER NOT NULL CHECK (total >= 0 AND passed <= total),
      result_json TEXT NOT NULL
    );

    CREATE INDEX submissions_session_id_idx
      ON submissions(session_id, submitted_at);

    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL
    );
  `,
} as const;
