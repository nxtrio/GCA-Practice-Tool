import type { Language, RunRequest, RunResult } from "@gca-practice/contracts";
import {
  DEFAULT_MAX_SOURCE_BYTES,
  RunnerUnavailableError,
} from "@gca-practice/runner-core";
import express, { type NextFunction, type Request, type Response } from "express";
import {
  CustomTestValidationError,
  ExecutionConflictError,
  isSupportedLanguage,
} from "./services/ExecutionService.js";
import {
  PersistenceNotFoundError,
  SessionStateError,
} from "./services/SessionService.js";
import { redactRunResultForApi } from "./routes/execution.js";
import {
  registerAssessmentRoutes,
  type AssessmentRouteDependencies,
} from "./routes/assessments.js";
import {
  registerSessionRoutes,
  type SessionRouteDependencies,
} from "./routes/sessions.js";
import { ValidationTokenError } from "./services/ImportWorkflowService.js";
import {
  registerEnvironmentRoute,
  type EnvironmentRouteDependencies,
} from "./routes/environment.js";

export interface ExecutionHandler {
  execute(request: RunRequest): Promise<RunResult>;
}

export interface AppDependencies
  extends AssessmentRouteDependencies,
    SessionRouteDependencies,
    EnvironmentRouteDependencies {
  executionService?: ExecutionHandler;
  availableLanguages?: Language[];
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();
  const availableLanguages = dependencies.availableLanguages ?? [
    "java",
    "cpp",
    "python",
  ];

  app.disable("x-powered-by");
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok", configuredLanguages: availableLanguages });
  });

  registerAssessmentRoutes(app, dependencies);
  registerSessionRoutes(app, dependencies);
  registerEnvironmentRoute(app, dependencies);

  for (const mode of ["run", "submit", "custom"] as const) {
    app.post(`/api/execution/${mode}`, async (request, response) => {
      if (!dependencies.executionService) {
        response.status(503).json({ error: "Execution service is unavailable." });
        return;
      }
      const validationError = validateExecutionBody(request.body, mode);
      if (validationError) {
        response.status(400).json({ error: validationError });
        return;
      }

      const result = await dependencies.executionService.execute({
        ...request.body,
        mode,
      });
      response.json(redactRunResultForApi(result));
    });
  }

  app.use(
    (
      error: unknown,
      _request: Request,
      response: Response,
      _next: NextFunction,
    ) => {
      const mapped = mapError(error);
      response.status(mapped.status).json({ error: mapped.message });
    },
  );

  return app;
}

export const app = createApp();

function validateExecutionBody(
  body: unknown,
  mode: RunRequest["mode"],
): string | undefined {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Request body must be a JSON object.";
  }
  const value = body as Record<string, unknown>;
  if (typeof value.sessionId !== "string" || value.sessionId.length === 0) {
    return "sessionId must be a nonempty string.";
  }
  if (typeof value.problemId !== "string" || value.problemId.length === 0) {
    return "problemId must be a nonempty string.";
  }
  if (!isSupportedLanguage(value.language)) {
    return "language must be java, cpp, or python.";
  }
  if (typeof value.source !== "string") {
    return "source must be a string.";
  }
  if (Buffer.byteLength(value.source, "utf8") > DEFAULT_MAX_SOURCE_BYTES) {
    return `source exceeds the ${DEFAULT_MAX_SOURCE_BYTES}-byte limit.`;
  }
  if (mode === "custom") {
    if (!isCustomTestInput(value.customTest)) {
      return "customTest must contain a JSON-compatible arguments array and expected value.";
    }
  }
  return undefined;
}

function isCustomTestInput(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  return Array.isArray(input.arguments) &&
    input.arguments.every(isSupportedJsonValue) &&
    isSupportedJsonValue(input.expected);
}

function isSupportedJsonValue(value: unknown): boolean {
  return typeof value === "string" || typeof value === "boolean" ||
    (typeof value === "number" && Number.isSafeInteger(value)) ||
    (Array.isArray(value) && value.every(isSupportedJsonValue));
}

function mapError(error: unknown): { status: number; message: string } {
  if (httpStatus(error) === 413) {
    return { status: 413, message: "Request body exceeds the 2 MB import limit." };
  }
  if (httpStatus(error) === 400) {
    return { status: 400, message: "Request body must be valid JSON." };
  }
  if (error instanceof PersistenceNotFoundError) {
    return { status: 404, message: error.message };
  }
  if (error instanceof CustomTestValidationError) {
    return { status: 400, message: error.message };
  }
  if (
    error instanceof SessionStateError ||
    error instanceof ExecutionConflictError ||
    error instanceof ValidationTokenError
  ) {
    return { status: 409, message: error.message };
  }
  if (error instanceof RunnerUnavailableError) {
    return { status: 503, message: error.message };
  }
  return {
    status: 500,
    message: error instanceof Error ? error.message : "Execution failed.",
  };
}

function httpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}
