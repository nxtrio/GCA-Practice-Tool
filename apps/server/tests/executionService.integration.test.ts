import { readFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Assessment, Language, RunResult } from "@gca-practice/contracts";
import { ExecutionCoordinator, RunnerRegistry } from "@gca-practice/runner-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  openDatabase,
  type SqliteDatabase,
} from "../src/persistence/database.ts";
import { AssessmentRepository } from "../src/persistence/repositories/AssessmentRepository.ts";
import { SessionRepository } from "../src/persistence/repositories/SessionRepository.ts";
import { SubmissionRepository } from "../src/persistence/repositories/SubmissionRepository.ts";
import {
  CustomTestValidationError,
  ExecutionConflictError,
  ExecutionService,
} from "../src/services/ExecutionService.ts";
import { SessionService } from "../src/services/SessionService.ts";

const fixture = JSON.parse(
  readFileSync(
    new URL("../../../fixtures/assessments/valid-gca.json", import.meta.url),
    "utf8",
  ),
) as Assessment;

const correctSources: Record<Language, string> = {
  java:
    "int solution(int[] numbers) { int total = 0; for (int value : numbers) total += value; return total; }",
  cpp:
    "int solution(vector<int> numbers) { return accumulate(numbers.begin(), numbers.end(), 0); }",
  python: "def solution(numbers):\n    return sum(numbers)",
};

describe("ExecutionService native judging", () => {
  let temporaryDirectory: string;
  let database: SqliteDatabase;
  let assessments: AssessmentRepository;
  let sessions: SessionRepository;
  let submissions: SubmissionRepository;
  let sessionService: SessionService;
  let executionService: ExecutionService;
  let sessionId: string;

  beforeAll(async () => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), "gca-execution-test-"));
    database = openDatabase(join(temporaryDirectory, "practice.sqlite"));
    assessments = new AssessmentRepository(database);
    sessions = new SessionRepository(database);
    submissions = new SubmissionRepository(database);
    sessionService = new SessionService(assessments, sessions, submissions);
    const assessment = assessments.save(fixture);
    sessionId = sessionService.startSession(assessment.id).id;
    executionService = new ExecutionService(
      new ExecutionCoordinator(await RunnerRegistry.detect()),
      assessments,
      sessions,
      sessionService,
    );
  });

  afterAll(() => {
    if (database.open) database.close();
    rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  it.each(["java", "cpp", "python"] as const)(
    "submits a correct %s solution through persistence and the native runner",
    async (language) => {
      const result = await executionService.execute({
        sessionId,
        problemId: "p1",
        language,
        source: correctSources[language],
        mode: "submit",
      });

      expect(result).toMatchObject({
        verdict: "accepted",
        passed: 2,
        total: 2,
      });
      expect(result.tests[0]).toMatchObject({
        visibility: "visible",
        testId: "p1-v1",
        expected: 6,
        actual: 6,
      });
      expect(result.tests[1]).toEqual({
        visibility: "hidden",
        verdict: "accepted",
        executionTimeMs: expect.any(Number),
      });
      expect(
        sessions.findCode(sessionId, "p1", language)?.source,
      ).toBe(correctSources[language]);
    },
    30_000,
  );

  it("returns useful visible failures while redacting hidden failures", async () => {
    const result = await executionService.execute({
      sessionId,
      problemId: "p1",
      language: "python",
      source:
        'def solution(numbers):\n    print("visible debug")\n    return -123456',
      mode: "submit",
    });

    expect(result.tests[0]).toMatchObject({
      visibility: "visible",
      verdict: "wrong_answer",
      expected: 6,
      actual: -123456,
      stdout: "visible debug\n",
    });
    expect(result.tests[1]).toEqual({
      visibility: "hidden",
      verdict: "wrong_answer",
      executionTimeMs: expect.any(Number),
    });
    const hiddenJson = JSON.stringify(result.tests[1]);
    expect(hiddenJson).not.toContain("p1-h1");
    expect(hiddenJson).not.toContain("-123456");
    expect(hiddenJson).not.toContain("expected");
    expect(hiddenJson).not.toContain("stdout");
  });

  it("runs only visible tests for Run and does not create a submission", async () => {
    const before = submissions.listForSession(sessionId).length;
    const result = await executionService.execute({
      sessionId,
      problemId: "p1",
      language: "python",
      source: correctSources.python,
      mode: "run",
    });

    expect(result.total).toBe(1);
    expect(result.tests.every((test) => test.visibility === "visible")).toBe(
      true,
    );
    expect(submissions.listForSession(sessionId)).toHaveLength(before);
  });

  it("runs a function-based custom input without creating a submission", async () => {
    const before = submissions.listForSession(sessionId).length;
    const result = await executionService.execute({
      sessionId,
      problemId: "p1",
      language: "python",
      source: correctSources.python,
      mode: "custom",
      customTest: { arguments: [[10, -4, 3]], expected: 9 },
    });

    expect(result).toMatchObject({ verdict: "accepted", passed: 1, total: 1 });
    expect(result.tests[0]).toMatchObject({
      visibility: "visible",
      testId: "__custom__",
      expected: 9,
      actual: 9,
    });
    expect(submissions.listForSession(sessionId)).toHaveLength(before);
  });

  it("rejects custom values that do not match the function signature", async () => {
    await expect(executionService.execute({
      sessionId,
      problemId: "p1",
      language: "python",
      source: correctSources.python,
      mode: "custom",
      customTest: { arguments: ["not-an-array"], expected: 0 },
    })).rejects.toBeInstanceOf(CustomTestValidationError);
  });

  it("allows only one active execution per session and problem", async () => {
    let release!: (result: RunResult) => void;
    const pendingResult = new Promise<RunResult>((resolve) => {
      release = resolve;
    });
    const gatedService = new ExecutionService(
      { execute: async () => await pendingResult },
      assessments,
      sessions,
      sessionService,
    );
    const request = {
      sessionId,
      problemId: "p1",
      language: "python" as const,
      source: correctSources.python,
      mode: "run" as const,
    };

    const first = gatedService.execute(request);
    expect(gatedService.isRunning(sessionId, "p1")).toBe(true);
    await expect(gatedService.execute(request)).rejects.toBeInstanceOf(
      ExecutionConflictError,
    );
    release({
      verdict: "accepted",
      passed: 1,
      total: 1,
      tests: [
        {
          visibility: "visible",
          testId: "p1-v1",
          verdict: "accepted",
          executionTimeMs: 1,
          expected: 6,
          actual: 6,
        },
      ],
    });
    await first;
    expect(gatedService.isRunning(sessionId, "p1")).toBe(false);
  });
});
