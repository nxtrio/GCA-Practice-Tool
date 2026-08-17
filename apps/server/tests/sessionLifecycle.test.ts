import { readFileSync, rmSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Assessment, RunResult } from "@gca-practice/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  openDatabase,
  type SqliteDatabase,
} from "../src/persistence/database.ts";
import {
  AssessmentRepository,
  type PersistedAssessment,
} from "../src/persistence/repositories/AssessmentRepository.ts";
import { SessionRepository } from "../src/persistence/repositories/SessionRepository.ts";
import { SubmissionRepository } from "../src/persistence/repositories/SubmissionRepository.ts";
import {
  SessionService,
  SessionStateError,
} from "../src/services/SessionService.ts";

const fixture = JSON.parse(
  readFileSync(
    new URL("../../../fixtures/assessments/valid-gca.json", import.meta.url),
    "utf8",
  ),
) as Assessment;

const acceptedResult: RunResult = {
  verdict: "accepted",
  compileTimeMs: 24,
  passed: 2,
  total: 2,
  tests: [
    {
      visibility: "visible",
      testId: "p1-v1",
      verdict: "accepted",
      executionTimeMs: 3,
      expected: 6,
      actual: 6,
      stdout: "debug output",
    },
    {
      visibility: "hidden",
      verdict: "accepted",
      executionTimeMs: 2,
    },
  ],
};

describe("SessionService persistence lifecycle", () => {
  let temporaryDirectory: string;
  let databasePath: string;
  let database: SqliteDatabase;
  let nowMs: number;
  let persistedAssessment: PersistedAssessment;
  let service: SessionService;

  const now = (): Date => new Date(nowMs);

  beforeEach(() => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), "gca-session-test-"));
    databasePath = join(temporaryDirectory, "practice.sqlite");
    database = openDatabase(databasePath);
    nowMs = Date.parse("2026-08-16T12:00:00.000Z");
    const assessments = new AssessmentRepository(database, { now });
    persistedAssessment = assessments.save(fixture);
    service = createService(database, now);
  });

  afterEach(() => {
    if (database.open) database.close();
    rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  it("resumes after a backend restart with code, submissions, and the original timer", () => {
    const session = service.startSession(persistedAssessment.id);
    const originalStartedAt = session.startedAt;
    const originalExpiresAt = session.expiresAt;
    service.saveCode({
      sessionId: session.id,
      problemId: "p1",
      language: "java",
      source: "int solution(int[] numbers) { return 6; }",
    });
    service.saveCode({
      sessionId: session.id,
      problemId: "p1",
      language: "python",
      source: "def solution(numbers):\n    return 6",
    });
    service.saveCode({
      sessionId: session.id,
      problemId: "p1",
      language: "java",
      source: "int solution(int[] numbers) { return numbers.length; }",
    });
    service.submitProblem({
      sessionId: session.id,
      problemId: "p1",
      language: "java",
      result: acceptedResult,
    });

    nowMs += 30 * 60 * 1_000;
    database.close();
    database = openDatabase(databasePath);
    service = createService(database, now);

    const resumed = service.resumeSession(session.id);

    expect(resumed.session).toMatchObject({
      status: "active",
      startedAt: originalStartedAt,
      expiresAt: originalExpiresAt,
    });
    expect(resumed.remainingMs).toBe(40 * 60 * 1_000);
    expect(resumed.code).toEqual([
      expect.objectContaining({
        problemId: "p1",
        language: "java",
        source: "int solution(int[] numbers) { return numbers.length; }",
      }),
      expect.objectContaining({
        problemId: "p1",
        language: "python",
        source: "def solution(numbers):\n    return 6",
      }),
    ]);
    expect(resumed.submissions).toEqual([
      expect.objectContaining({
        problemId: "p1",
        language: "java",
        submissionType: "submit",
        result: acceptedResult,
      }),
    ]);
  });

  it("detects expiration while the backend is closed without resetting time", () => {
    const session = service.startSession(persistedAssessment.id);
    service.saveCode({
      sessionId: session.id,
      problemId: "p2",
      language: "cpp",
      source: "string solution(string text) { return text; }",
    });
    const originalExpiresAt = session.expiresAt;

    database.close();
    nowMs += 70 * 60 * 1_000 + 1;
    database = openDatabase(databasePath);
    service = createService(database, now);

    const resumed = service.resumeSession(session.id);

    expect(resumed.session.status).toBe("expired");
    expect(resumed.session.expiresAt).toBe(originalExpiresAt);
    expect(resumed.session.finishedAt).toBe(originalExpiresAt);
    expect(resumed.remainingMs).toBe(0);
    expect(resumed.code[0]?.source).toBe(
      "string solution(string text) { return text; }",
    );
    expect(() =>
      service.saveCode({
        sessionId: session.id,
        problemId: "p2",
        language: "cpp",
        source: "changed after expiration",
      }),
    ).toThrow(SessionStateError);
  });

  it("finishes manually before expiration and keeps completion durable", () => {
    const session = service.startSession(persistedAssessment.id);
    nowMs += 10 * 60 * 1_000;

    const finished = service.finishSession(session.id);

    expect(finished.status).toBe("completed");
    expect(finished.finishedAt).toBe("2026-08-16T12:10:00.000Z");
    expect(service.finishSession(session.id)).toEqual(finished);

    database.close();
    database = openDatabase(databasePath);
    service = createService(database, now);
    expect(service.resumeSession(session.id)).toMatchObject({
      session: finished,
      remainingMs: 0,
    });
  });

  it("allows explicit expiration only once the persisted deadline is reached", () => {
    const session = service.startSession(persistedAssessment.id);

    expect(() => service.expireSession(session.id)).toThrow(
      /has not reached its expiration time/,
    );
    nowMs += 70 * 60 * 1_000;

    const expired = service.expireSession(session.id);
    expect(expired).toMatchObject({
      status: "expired",
      expiresAt: "2026-08-16T13:10:00.000Z",
      finishedAt: "2026-08-16T13:10:00.000Z",
    });
    expect(service.expireSession(session.id)).toEqual(expired);
  });

  it("rejects code and submissions for problems outside the assessment", () => {
    const session = service.startSession(persistedAssessment.id);

    expect(() =>
      service.saveCode({
        sessionId: session.id,
        problemId: "unknown",
        language: "python",
        source: "pass",
      }),
    ).toThrow(/Problem "unknown"/);
    expect(() =>
      service.submitProblem({
        sessionId: session.id,
        problemId: "unknown",
        language: "python",
        result: acceptedResult,
      }),
    ).toThrow(/Problem "unknown"/);
  });
});

function createService(
  database: SqliteDatabase,
  now: () => Date,
): SessionService {
  return new SessionService(
    new AssessmentRepository(database, { now }),
    new SessionRepository(database),
    new SubmissionRepository(database),
    { now },
  );
}
