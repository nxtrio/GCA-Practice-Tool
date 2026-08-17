import type { Express } from "express";
import type { ProblemCatalogRepository } from "../persistence/repositories/ProblemCatalogRepository.js";
import type { ImportWorkflowService } from "../services/ImportWorkflowService.js";
import { persistedAssessmentToView } from "../services/assessmentView.js";

export interface AssessmentRouteDependencies {
  importWorkflowService?: ImportWorkflowService;
  problemCatalog?: ProblemCatalogRepository;
}

export function registerAssessmentRoutes(
  app: Express,
  dependencies: AssessmentRouteDependencies,
): void {
  app.get("/api/problem-catalog", (_request, response) => {
    const entries = dependencies.problemCatalog?.listRecent() ?? [];
    response.json(
      entries.map(({ title, conceptSummary, patternTags, complexity, signatureShape }) => ({
        title,
        conceptSummary,
        patternTags,
        complexity,
        signatureShape,
      })),
    );
  });

  app.post("/api/assessments/validate", async (request, response) => {
    if (!dependencies.importWorkflowService) {
      response.status(503).json({
        error: "Assessment import is unavailable because Python validation is not configured.",
      });
      return;
    }
    const source = property(request.body, "source");
    if (typeof source !== "string") {
      response.status(400).json({ error: "source must be a string." });
      return;
    }

    response.json(
      await dependencies.importWorkflowService.validate(source),
    );
  });

  app.post("/api/assessments/import", (request, response) => {
    if (!dependencies.importWorkflowService) {
      response.status(503).json({ error: "Assessment import is unavailable." });
      return;
    }
    const validationId = property(request.body, "validationId");
    if (typeof validationId !== "string") {
      response.status(400).json({ error: "validationId must be a string." });
      return;
    }

    const assessment = dependencies.importWorkflowService.commit(
      validationId,
    );
    response.status(201).json(persistedAssessmentToView(assessment));
  });
}

function property(body: unknown, name: string): unknown {
  return body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)[name]
    : undefined;
}
