import type { Express } from "express";
import {
  resolveAssessmentPreset,
  type AssessmentPresetId,
} from "@gca-practice/contracts";
import type { AssessmentRepository } from "../persistence/repositories/AssessmentRepository.js";
import type { ProblemCatalogRepository } from "../persistence/repositories/ProblemCatalogRepository.js";
import type { ImportWorkflowService } from "../services/ImportWorkflowService.js";
import { persistedAssessmentToView } from "../services/assessmentView.js";

export interface AssessmentRouteDependencies {
  importWorkflowService?: ImportWorkflowService;
  problemCatalog?: ProblemCatalogRepository;
  assessments?: AssessmentRepository;
}

export function registerAssessmentRoutes(
  app: Express,
  dependencies: AssessmentRouteDependencies,
): void {
  app.get("/api/problem-catalog", (request, response) => {
    const selectedPreset = requestedPreset(request.query.preset);
    const entries = (dependencies.problemCatalog?.listRecent() ?? [])
      .map((entry, index) => {
        const assessment = dependencies.assessments?.findById(entry.assessmentId);
        return {
          entry,
          index,
          preset: assessment
            ? resolveAssessmentPreset(assessment.assessment.assessment).id
            : undefined,
        };
      })
      .sort((left, right) => {
        if (!selectedPreset) return left.index - right.index;
        const leftRank = left.preset === selectedPreset ? 0 : 1;
        const rightRank = right.preset === selectedPreset ? 0 : 1;
        return leftRank - rightRank || left.index - right.index;
      });
    response.json(
      entries.map(({ entry, preset }) => ({
        ...(preset ? { preset } : {}),
        title: entry.title,
        conceptSummary: entry.conceptSummary,
        patternTags: entry.patternTags,
        complexity: entry.complexity,
        signatureShape: entry.signatureShape,
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

function requestedPreset(value: unknown): AssessmentPresetId | undefined {
  return value === "gca" || value === "roblox" ? value : undefined;
}

function property(body: unknown, name: string): unknown {
  return body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)[name]
    : undefined;
}
