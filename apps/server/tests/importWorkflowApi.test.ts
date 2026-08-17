import { readFileSync, rmSync, mkdtempSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AssessmentOracleValidator } from "@gca-practice/assessment-schema";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { openDatabase, type SqliteDatabase } from "../src/persistence/database.ts";
import { AssessmentRepository } from "../src/persistence/repositories/AssessmentRepository.ts";
import { ProblemCatalogRepository } from "../src/persistence/repositories/ProblemCatalogRepository.ts";
import { SessionRepository } from "../src/persistence/repositories/SessionRepository.ts";
import { SubmissionRepository } from "../src/persistence/repositories/SubmissionRepository.ts";
import { ImportService } from "../src/services/ImportService.ts";
import { ImportWorkflowService } from "../src/services/ImportWorkflowService.ts";
import { SessionService } from "../src/services/SessionService.ts";

const fixtureSource = readFileSync(
  new URL("../../../fixtures/assessments/valid-gca.json", import.meta.url),
  "utf8",
);
const acceptingOracle: AssessmentOracleValidator = {
  async validate() { return { valid: true, errors: [] }; },
};

describe("Phase 9 import and session API", () => {
  let directory: string;
  let database: SqliteDatabase;
  let server: Server | undefined;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "gca-import-api-"));
    database = openDatabase(join(directory, "practice.sqlite"));
  });

  afterEach(async () => {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    if (database.open) database.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it("validates, imports, starts, resumes, and saves code without exposing secrets", async () => {
    let assessmentIdentifier = 0;
    const assessments = new AssessmentRepository(database, {
      idFactory: () => assessmentIdentifier++ === 0 ? "assessment-1" : `catalog-${assessmentIdentifier}`,
    });
    let validationIdentifier = 0;
    const workflow = new ImportWorkflowService(
      new ImportService(acceptingOracle, assessments),
      {
        idFactory: () => `validation-${++validationIdentifier}`,
        problemCatalog: new ProblemCatalogRepository(database),
      },
    );
    const sessions = new SessionService(
      assessments,
      new SessionRepository(database),
      new SubmissionRepository(database),
      { idFactory: () => "session-1" },
    );
    const running = await listen(createApp({
      importWorkflowService: workflow,
      problemCatalog: new ProblemCatalogRepository(database),
      sessionService: sessions,
    }));
    server = running.server;

    const validationResponse = await post(running.origin, "/api/assessments/validate", { source: fixtureSource });
    expect(validationResponse.status).toBe(200);
    const validation = await validationResponse.json() as Record<string, unknown>;
    expect(validation).toMatchObject({ valid: true, validationId: "validation-1" });
    expect(JSON.stringify(validation)).not.toContain("referenceSolution");
    expect(JSON.stringify(validation)).not.toContain('"hidden"');

    const importResponse = await post(running.origin, "/api/assessments/import", { validationId: "validation-1" });
    expect(importResponse.status).toBe(201);
    const assessment = await importResponse.json() as { id: string };
    expect(assessment.id).toBe("assessment-1");

    const duplicateResponse = await post(running.origin, "/api/assessments/validate", { source: fixtureSource });
    const duplicateValidation = await duplicateResponse.json() as { warnings: string[] };
    expect(duplicateValidation.warnings).toContain(
      "Array Total exactly duplicates a previously imported problem.",
    );

    const sessionResponse = await post(running.origin, "/api/sessions", { assessmentId: assessment.id });
    expect(sessionResponse.status).toBe(201);
    const session = await sessionResponse.json() as { id: string };
    expect(session.id).toBe("session-1");

    const saveResponse = await fetch(`${running.origin}/api/sessions/${session.id}/code`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ problemId: "p1", language: "python", source: "def solution(values): return 8" }),
    });
    expect(saveResponse.status).toBe(200);

    const resumeResponse = await fetch(`${running.origin}/api/sessions/${session.id}`);
    const resumedText = await resumeResponse.text();
    expect(resumeResponse.status).toBe(200);
    expect(resumedText).toContain("def solution(values): return 8");
    expect(resumedText).not.toContain("referenceSolution");
    expect(resumedText).not.toContain('"hidden"');

    const reused = await post(running.origin, "/api/assessments/import", { validationId: "validation-1" });
    expect(reused.status).toBe(409);
  });

  it("reports layered validation errors without persisting the document", async () => {
    const assessments = new AssessmentRepository(database);
    const running = await listen(createApp({
      importWorkflowService: new ImportWorkflowService(new ImportService(acceptingOracle, assessments)),
    }));
    server = running.server;

    const response = await post(running.origin, "/api/assessments/validate", { source: "{bad json" });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      valid: false,
      errors: [{ stage: "json", code: "invalid_json" }],
    });
    expect(assessments.list()).toEqual([]);
  });

  it("enforces the assessment import body limit", async () => {
    const running = await listen(createApp());
    server = running.server;

    const response = await post(running.origin, "/api/assessments/validate", {
      source: "x".repeat(2 * 1024 * 1024),
    });

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      error: "Request body exceeds the 2 MB import limit.",
    });
  });
});

function post(origin: string, path: string, body: unknown): Promise<Response> {
  return fetch(`${origin}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function listen(app: ReturnType<typeof createApp>): Promise<{ server: Server; origin: string }> {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  return { server, origin: `http://127.0.0.1:${address.port}` };
}
