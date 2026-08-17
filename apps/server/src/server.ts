import { ReferenceSolutionValidator } from "@gca-practice/assessment-schema";
import {
  ExecutionCoordinator,
  RunnerRegistry,
  startAbandonedWorkspaceCleanup,
} from "@gca-practice/runner-core";
import { createApp } from "./app.js";
import { openDatabase } from "./persistence/database.js";
import { AssessmentRepository } from "./persistence/repositories/AssessmentRepository.js";
import { SessionRepository } from "./persistence/repositories/SessionRepository.js";
import { SubmissionRepository } from "./persistence/repositories/SubmissionRepository.js";
import { ProblemCatalogRepository } from "./persistence/repositories/ProblemCatalogRepository.js";
import { ExecutionService } from "./services/ExecutionService.js";
import { ImportService } from "./services/ImportService.js";
import { ImportWorkflowService } from "./services/ImportWorkflowService.js";
import { SessionService } from "./services/SessionService.js";
import { CompletionService } from "./services/CompletionService.js";
import { ResultsService } from "./services/ResultsService.js";

const port = environmentPort("GCA_API_PORT", process.env.PORT, 3001);
const workspaceCleanup = startAbandonedWorkspaceCleanup({
  olderThanMs: 24 * 60 * 60 * 1_000,
  intervalMs: 6 * 60 * 60 * 1_000,
  onError: (error) => console.warn("Temporary workspace cleanup failed:", error),
});
await workspaceCleanup.runNow().catch((error: unknown) => {
  console.warn("Initial temporary workspace cleanup failed:", error);
});
const database = openDatabase(process.env.GCA_DATABASE_PATH);
const runnerRegistry = await RunnerRegistry.detect();
const assessments = new AssessmentRepository(database);
const sessions = new SessionRepository(database);
const submissions = new SubmissionRepository(database);
const problemCatalog = new ProblemCatalogRepository(database);
const sessionService = new SessionService(assessments, sessions, submissions);
const executionService = new ExecutionService(
  new ExecutionCoordinator(runnerRegistry),
  assessments,
  sessions,
  sessionService,
);
const resultsService = new ResultsService(
  assessments,
  sessions,
  submissions,
  sessionService,
);
const completionService = new CompletionService(
  executionService,
  assessments,
  sessions,
  sessionService,
  resultsService,
);
const pythonRunner = runnerRegistry.get("python");
const importWorkflowService = pythonRunner
  ? new ImportWorkflowService(
      new ImportService(new ReferenceSolutionValidator(pythonRunner), assessments),
      { problemCatalog },
    )
  : undefined;
const app = createApp({
  executionService,
  completionService,
  resultsService,
  ...(importWorkflowService ? { importWorkflowService } : {}),
  problemCatalog,
  sessionService,
  toolchains: runnerRegistry.toolchains,
  availableLanguages: runnerRegistry.availableLanguages(),
});

const server = app.listen(port, "127.0.0.1", () => {
  console.log(`GCA Practice API listening at http://127.0.0.1:${port}`);
});

function shutdown(): void {
  workspaceCleanup.stop();
  server.close(() => {
    database.close();
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

function environmentPort(
  name: string,
  legacyValue: string | undefined,
  fallback: number,
): number {
  const raw = process.env[name] ?? legacyValue;
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > 65_535) {
    throw new Error(`${name} must be an integer between 1 and 65535.`);
  }
  return value;
}
