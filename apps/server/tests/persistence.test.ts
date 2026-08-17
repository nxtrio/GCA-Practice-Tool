import { readFileSync, rmSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Assessment } from "@gca-practice/contracts";
import type { AssessmentOracleValidator } from "@gca-practice/assessment-schema";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  openDatabase,
  type SqliteDatabase,
} from "../src/persistence/database.ts";
import {
  canonicalJson,
  contentFingerprint,
} from "../src/persistence/fingerprints.ts";
import { AssessmentRepository } from "../src/persistence/repositories/AssessmentRepository.ts";
import { ProblemCatalogRepository } from "../src/persistence/repositories/ProblemCatalogRepository.ts";
import { ImportService } from "../src/services/ImportService.ts";

const fixtureSource = readFileSync(
  new URL("../../../fixtures/assessments/valid-gca.json", import.meta.url),
  "utf8",
);

describe("SQLite assessment persistence", () => {
  let temporaryDirectory: string;
  let databasePath: string;
  let database: SqliteDatabase;

  beforeEach(() => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), "gca-persistence-test-"));
    databasePath = join(temporaryDirectory, "practice.sqlite");
    database = openDatabase(databasePath);
  });

  afterEach(() => {
    if (database.open) database.close();
    rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  it("applies the initial migration idempotently", () => {
    const tableNames = database
      .prepare<[], { name: string }>(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
         ORDER BY name`,
      )
      .all()
      .map(({ name }) => name);

    expect(tableNames).toEqual([
      "assessments",
      "problem_catalog",
      "schema_migrations",
      "session_code",
      "sessions",
      "settings",
      "submissions",
    ]);

    database.close();
    database = openDatabase(databasePath);
    expect(
      database
        .prepare<[], { count: number }>(
          "SELECT COUNT(*) AS count FROM schema_migrations",
        )
        .get()?.count,
    ).toBe(2);
  });

  it("persists only a fully validated import and its problem history", async () => {
    let oracleCalls = 0;
    const oracle: AssessmentOracleValidator = {
      async validate() {
        oracleCalls += 1;
        return { valid: true, errors: [] };
      },
    };
    const assessments = new AssessmentRepository(database, {
      now: () => new Date("2026-08-16T12:00:00.000Z"),
    });
    const importer = new ImportService(oracle, assessments);

    const result = await importer.importAssessment(fixtureSource);

    expect(result.imported).toBe(true);
    expect(oracleCalls).toBe(1);
    if (!result.imported) throw new Error("Expected import to succeed");
    expect(assessments.findById(result.assessment.id)).toEqual(
      result.assessment,
    );

    const history = new ProblemCatalogRepository(database).listForAssessment(
      result.assessment.id,
    );
    expect(history).toHaveLength(4);
    expect(history[0]).toMatchObject({
      assessmentId: result.assessment.id,
      problemId: "p1",
      title: "Array Total",
      conceptSummary: "Sum all integers in an array.",
      patternTags: ["array traversal"],
      complexity: "O(n)",
      signatureShape: "(array<int>) -> int",
    });
    expect(history.every(({ contentHash }) => contentHash.length === 64)).toBe(
      true,
    );
  });

  it("does not persist an import rejected before oracle validation", async () => {
    const document = JSON.parse(fixtureSource) as Assessment;
    document.assessment.problems.pop();
    let oracleCalls = 0;
    const importer = new ImportService(
      {
        async validate() {
          oracleCalls += 1;
          return { valid: true, errors: [] };
        },
      },
      new AssessmentRepository(database),
    );

    const result = await importer.importAssessment(JSON.stringify(document));

    expect(result.imported).toBe(false);
    expect(oracleCalls).toBe(0);
    expect(new AssessmentRepository(database).list()).toEqual([]);
  });

  it("fingerprints normalized object content deterministically", () => {
    const left = { beta: [2, { z: false, a: "value" }], alpha: 1 };
    const right = { alpha: 1, beta: [2, { a: "value", z: false }] };

    expect(canonicalJson(left)).toBe(canonicalJson(right));
    expect(contentFingerprint(left)).toBe(contentFingerprint(right));
    expect(contentFingerprint(left)).toMatch(/^[a-f0-9]{64}$/);
    expect(() => canonicalJson(undefined)).toThrow(/JSON-serializable/);
  });
});
