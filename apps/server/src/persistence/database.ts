import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import BetterSqlite3 from "better-sqlite3";
import type Database from "better-sqlite3";
import { applyMigrations } from "./migrations/index.js";

export type SqliteDatabase = Database.Database;

export const defaultDatabasePath = resolve(
  process.cwd(),
  "data",
  "gca-practice.sqlite",
);

export function openDatabase(
  filename = defaultDatabasePath,
): SqliteDatabase {
  if (filename !== ":memory:") {
    mkdirSync(dirname(filename), { recursive: true });
  }

  const database = new BetterSqlite3(filename);
  try {
    database.pragma("foreign_keys = ON");
    database.pragma("busy_timeout = 5000");
    if (filename !== ":memory:") database.pragma("journal_mode = WAL");
    applyMigrations(database);
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}
