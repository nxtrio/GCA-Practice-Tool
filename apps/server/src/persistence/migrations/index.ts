import type Database from "better-sqlite3";
import { initialMigration } from "./001_initial.js";
import { problemSignatureShapeMigration } from "./002_problem_signature_shape.js";

const migrations = [initialMigration, problemSignatureShapeMigration] as const;

interface AppliedMigrationRow {
  version: number;
}

export function applyMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    database
      .prepare<[], AppliedMigrationRow>(
        "SELECT version FROM schema_migrations ORDER BY version",
      )
      .all()
      .map(({ version }) => version),
  );
  const recordMigration = database.prepare(
    `INSERT INTO schema_migrations (version, name, applied_at)
     VALUES (@version, @name, @appliedAt)`,
  );

  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;

    database.transaction(() => {
      database.exec(migration.sql);
      recordMigration.run({
        version: migration.version,
        name: migration.name,
        appliedAt: new Date().toISOString(),
      });
    })();
  }
}
