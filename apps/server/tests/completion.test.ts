import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Assessment, RunResult } from "@gca-practice/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.ts";
import { openDatabase, type SqliteDatabase } from "../src/persistence/database.ts";
import { AssessmentRepository } from "../src/persistence/repositories/AssessmentRepository.ts";
import { SessionRepository } from "../src/persistence/repositories/SessionRepository.ts";
import { SubmissionRepository } from "../src/persistence/repositories/SubmissionRepository.ts";
import { CompletionService } from "../src/services/CompletionService.ts";
import { ExecutionService } from "../src/services/ExecutionService.ts";
import { ResultsService } from "../src/services/ResultsService.ts";
import { SessionService } from "../src/services/SessionService.ts";

const fixture = JSON.parse(readFileSync(
  new URL("../../../fixtures/assessments/valid-gca.json", import.meta.url),
  "utf8",
)) as Assessment;
const robloxFixture = JSON.parse(readFileSync(
  new URL("../../../fixtures/assessments/valid-roblox.json", import.meta.url),
  "utf8",
)) as Assessment;
const imcFixture = JSON.parse(readFileSync(
  new URL("../../../fixtures/assessments/valid-imc.json", import.meta.url),
  "utf8",
)) as Assessment;

describe("Phase 10 completion and history", () => {
  let directory: string;
  let database: SqliteDatabase;
  let nowMs: number;
  let identifiers: number;
  let assessments: AssessmentRepository;
  let sessions: SessionRepository;
  let submissions: SubmissionRepository;
  let sessionService: SessionService;
  let resultsService: ResultsService;
  let completionService: CompletionService;
  let execute: ReturnType<typeof vi.fn<(request: unknown) => Promise<RunResult>>>;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "gca-completion-"));
    database = openDatabase(join(directory, "practice.sqlite"));
    nowMs = Date.parse("2026-08-16T12:00:00.000Z");
    identifiers = 0;
    const now = () => new Date(nowMs);
    assessments = new AssessmentRepository(database, { now, idFactory: nextId });
    sessions = new SessionRepository(database);
    submissions = new SubmissionRepository(database);
    sessionService = new SessionService(assessments, sessions, submissions, { now, idFactory: nextId });
    resultsService = new ResultsService(assessments, sessions, submissions, sessionService, now);
    execute = vi.fn(async (request: unknown) => acceptedResult(request));
    const executionService = new ExecutionService({ execute }, assessments, sessions, sessionService);
    completionService = new CompletionService(executionService, assessments, sessions, sessionService, resultsService, now);
  });

  afterEach(() => {
    if (database.open) database.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it("judges the latest snapshot, completes, summarizes, and archives a session", async () => {
    const assessment = assessments.save(fixture);
    const session = sessionService.startSession(assessment.id);
    sessionService.saveCode({ sessionId: session.id, problemId: "p1", language: "python", source: "def solution(values): return sum(values)" });

    expect(resultsService.history().unfinished).toHaveLength(1);
    nowMs += 10 * 60 * 1_000;
    const result = await completionService.complete(session.id);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ mode: "submit", language: "python" }));
    expect(result).toMatchObject({
      status: "completed",
      problemsSolved: 1,
      problemCount: 4,
      testsPassed: 2,
      testsTotal: 8,
      timeUsedMs: 10 * 60 * 1_000,
      timeRemainingMs: 60 * 60 * 1_000,
    });
    expect(result.problems[0]).toMatchObject({ verdict: "accepted", passed: 2, total: 2, language: "python" });
    expect(result.problems[1]).toMatchObject({ verdict: "not_attempted", passed: 0, total: 2 });
    expect(resultsService.history()).toMatchObject({ unfinished: [], completed: [result] });

    const analysis = resultsService.analysisExport(session.id);
    expect(analysis).toMatchObject({
      schemaVersion: "1.0",
      kind: "gca_practice_readiness_analysis",
      privacy: {
        hiddenTestDetailsIncluded: false,
        referenceSolutionsIncluded: false,
      },
      assessment: {
        title: "GCA Practice Fixture",
        summary: { problemsSolved: 1, testsPassed: 2, testsTotal: 8 },
        problems: expect.arrayContaining([
          expect.objectContaining({
            problemId: "p1",
            finalCode: expect.objectContaining({
              language: "python",
              source: "def solution(values): return sum(values)",
            }),
            outcome: expect.objectContaining({ verdict: "accepted", passed: 2, total: 2 }),
            context: expect.objectContaining({ testInventory: { visible: 1, hidden: 1, total: 2 } }),
          }),
        ]),
      },
    });
    const serialized = JSON.stringify(analysis);
    expect(serialized).not.toContain("def solution(numbers):\\n    return sum(numbers)");
    expect(serialized).not.toContain('"validation":');
    expect(serialized).not.toContain("p1-h1");
    expect(serialized).not.toContain("[-5,5]");

    const running = await listen(createApp({ resultsService }));
    try {
      const response = await fetch(`${running.origin}/api/sessions/${session.id}/export`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(response.headers.get("content-disposition")).toBe(
        'attachment; filename="gca-practice-fixture-readiness-analysis.json"',
      );
      expect((await response.json()).kind).toBe("gca_practice_readiness_analysis");
    } finally {
      await new Promise<void>((resolve) => running.server.close(() => resolve()));
    }

    await completionService.complete(session.id);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("marks completion at the persisted deadline as expired", async () => {
    const assessment = assessments.save(fixture);
    const session = sessionService.startSession(assessment.id);
    sessionService.saveCode({ sessionId: session.id, problemId: "p2", language: "java", source: "String solution(String text) { return text; }" });
    nowMs += 70 * 60 * 1_000;

    const result = await completionService.complete(session.id);

    expect(result.status).toBe("expired");
    expect(result.timeRemainingMs).toBe(0);
    expect(result.timeUsedMs).toBe(70 * 60 * 1_000);
    expect(sessions.findById(session.id)?.finishedAt).toBe(session.expiresAt);
  });

  it("labels Roblox results, history, and readiness exports with their preset", async () => {
    const assessment = assessments.save(robloxFixture);
    const session = sessionService.startSession(assessment.id);
    nowMs += 5 * 60 * 1_000;

    const result = await completionService.complete(session.id);

    expect(result).toMatchObject({
      assessmentTitle: "Roblox Coding Practice Fixture",
      preset: "roblox",
      problemCount: 2,
    });
    expect(resultsService.history().completed[0]).toMatchObject({
      preset: "roblox",
      problemCount: 2,
    });
    expect(resultsService.analysisExport(session.id)).toMatchObject({
      kind: "roblox_practice_readiness_analysis",
      assessment: { preset: "roblox", summary: { problemCount: 2 } },
      analysisRequest: {
        objective: expect.stringContaining("Roblox Coding Assessment"),
      },
    });
  });

  it("labels IMC results, history, and readiness exports with their preset", async () => {
    const assessment = assessments.save(imcFixture);
    const session = sessionService.startSession(assessment.id);
    nowMs += 5 * 60 * 1_000;

    const result = await completionService.complete(session.id);

    expect(result).toMatchObject({
      assessmentTitle: "IMC SWE Practice Fixture",
      preset: "imc",
      problemCount: 2,
    });
    expect(resultsService.history().completed[0]).toMatchObject({
      preset: "imc",
      problemCount: 2,
    });
    expect(resultsService.analysisExport(session.id)).toMatchObject({
      kind: "imc_practice_readiness_analysis",
      assessment: { preset: "imc", summary: { problemCount: 2 } },
      analysisRequest: {
        objective: expect.stringContaining("IMC Software Engineering Assessment"),
      },
    });
  });

  function nextId(): string { return `id-${++identifiers}`; }
});

async function listen(app: ReturnType<typeof createApp>): Promise<{
  server: Server;
  origin: string;
}> {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

function acceptedResult(request: unknown): RunResult {
  const expected = (request as { visibleTests: Array<{ expected: unknown }> }).visibleTests[0]!.expected as never;
  return {
    verdict: "accepted",
    passed: 2,
    total: 2,
    tests: [
      { visibility: "visible", testId: "visible", verdict: "accepted", executionTimeMs: 1, expected, actual: expected },
      { visibility: "hidden", verdict: "accepted", executionTimeMs: 1 },
    ],
  };
}
