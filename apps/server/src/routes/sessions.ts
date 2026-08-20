import type { Express } from "express";
import type { SessionService } from "../services/SessionService.js";
import { isSupportedLanguage } from "../services/ExecutionService.js";
import { persistedAssessmentToView } from "../services/assessmentView.js";
import type { CompletionService } from "../services/CompletionService.js";
import type { ResultsService } from "../services/ResultsService.js";
import type { CompletionCodeSnapshot } from "../services/CompletionService.js";
import { DEFAULT_MAX_SOURCE_BYTES } from "@gca-practice/runner-core";
import { redactRunResultForApi } from "./execution.js";

export interface SessionRouteDependencies {
  sessionService?: SessionService;
  completionService?: CompletionService;
  resultsService?: ResultsService;
}

export function registerSessionRoutes(
  app: Express,
  dependencies: SessionRouteDependencies,
): void {
  app.post("/api/sessions", (request, response) => {
    if (!dependencies.sessionService) {
      response.status(503).json({ error: "Session service is unavailable." });
      return;
    }
    const assessmentId = property(request.body, "assessmentId");
    if (typeof assessmentId !== "string" || assessmentId.length === 0) {
      response.status(400).json({ error: "assessmentId must be a nonempty string." });
      return;
    }
    response.status(201).json(dependencies.sessionService.startSession(assessmentId));
  });

  app.get("/api/sessions/:id", (request, response) => {
    if (!dependencies.sessionService) {
      response.status(503).json({ error: "Session service is unavailable." });
      return;
    }
    const resumed = dependencies.sessionService.resumeSession(request.params.id);
    response.json({
      session: resumed.session,
      assessment: persistedAssessmentToView(resumed.assessment),
      code: resumed.code,
      submissions: resumed.submissions.map((submission) => ({
        problemId: submission.problemId,
        language: submission.language,
        submittedAt: submission.submittedAt,
        result: redactRunResultForApi(submission.result),
      })),
      remainingMs: resumed.remainingMs,
    });
  });

  app.patch("/api/sessions/:id/code", (request, response) => {
    if (!dependencies.sessionService) {
      response.status(503).json({ error: "Session service is unavailable." });
      return;
    }
    const problemId = property(request.body, "problemId");
    const language = property(request.body, "language");
    const source = property(request.body, "source");
    if (typeof problemId !== "string" || problemId.length === 0) {
      response.status(400).json({ error: "problemId must be a nonempty string." });
      return;
    }
    if (!isSupportedLanguage(language)) {
      response.status(400).json({ error: "language must be java, cpp, or python." });
      return;
    }
    if (typeof source !== "string") {
      response.status(400).json({ error: "source must be a string." });
      return;
    }
    if (!sourceWithinLimit(source)) {
      response.status(413).json({ error: `source exceeds the ${DEFAULT_MAX_SOURCE_BYTES}-byte limit.` });
      return;
    }

    response.json(
      dependencies.sessionService.saveCode({
        sessionId: request.params.id,
        problemId,
        language,
        source,
      }),
    );
  });

  app.post("/api/sessions/:id/finish", async (request, response) => {
    if (!dependencies.completionService) {
      response.status(503).json({ error: "Completion service is unavailable." });
      return;
    }
    const code = property(request.body, "code");
    if (!isCompletionCode(code)) {
      response.status(400).json({ error: "code must be an array of final code snapshots." });
      return;
    }
    response.json(await dependencies.completionService.complete(request.params.id, code));
  });

  app.get("/api/sessions/:id/results", (request, response) => {
    if (!dependencies.resultsService) {
      response.status(503).json({ error: "Results service is unavailable." });
      return;
    }
    response.json(dependencies.resultsService.get(request.params.id));
  });

  app.get("/api/sessions/:id/export", (request, response) => {
    if (!dependencies.resultsService) {
      response.status(503).json({ error: "Results service is unavailable." });
      return;
    }
    const analysis = dependencies.resultsService.analysisExport(request.params.id);
    response.setHeader(
      "content-disposition",
      `attachment; filename="${exportFilename(analysis.assessment.title)}"`,
    );
    response.type("application/json").send(JSON.stringify(analysis, null, 2));
  });

  app.get("/api/history", (_request, response) => {
    if (!dependencies.resultsService) {
      response.status(503).json({ error: "History service is unavailable." });
      return;
    }
    response.json(dependencies.resultsService.history());
  });
}

function property(body: unknown, name: string): unknown {
  return body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)[name]
    : undefined;
}

function isCompletionCode(value: unknown): value is CompletionCodeSnapshot[] {
  return Array.isArray(value) && value.length <= 12 && value.every((snapshot) => {
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return false;
    const item = snapshot as Record<string, unknown>;
    return typeof item.problemId === "string" && item.problemId.length > 0 &&
      isSupportedLanguage(item.language) && typeof item.source === "string" &&
      sourceWithinLimit(item.source);
  });
}

function sourceWithinLimit(source: string): boolean {
  return Buffer.byteLength(source, "utf8") <= DEFAULT_MAX_SOURCE_BYTES;
}

function exportFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "assessment";
  return `${slug}-readiness-analysis.json`;
}
