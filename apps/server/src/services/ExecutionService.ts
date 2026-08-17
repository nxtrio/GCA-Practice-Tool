import type {
  Language,
  RunRequest,
  RunResult,
} from "@gca-practice/contracts";
import type { ExecutionCoordinator } from "@gca-practice/runner-core";
import { AssessmentRepository } from "../persistence/repositories/AssessmentRepository.js";
import { SessionRepository } from "../persistence/repositories/SessionRepository.js";
import {
  PersistenceNotFoundError,
  SessionService,
} from "./SessionService.js";

export interface JudgeCoordinator {
  execute(
    request: Parameters<ExecutionCoordinator["execute"]>[0],
  ): Promise<RunResult>;
}

export class ExecutionConflictError extends Error {
  constructor(sessionId: string, problemId: string) {
    super(
      `An execution is already active for session "${sessionId}", ` +
        `problem "${problemId}".`,
    );
    this.name = "ExecutionConflictError";
  }
}

export class ExecutionService {
  private readonly activeJobs = new Set<string>();

  constructor(
    private readonly coordinator: JudgeCoordinator,
    private readonly assessments: AssessmentRepository,
    private readonly sessions: SessionRepository,
    private readonly sessionService: SessionService,
  ) {}

  async execute(request: RunRequest): Promise<RunResult> {
    return this.executeInternal(request, false);
  }

  async executeForCompletion(request: RunRequest): Promise<RunResult> {
    return this.executeInternal(request, true);
  }

  private async executeInternal(
    request: RunRequest,
    completion: boolean,
  ): Promise<RunResult> {
    const jobKey = `${request.sessionId}\0${request.problemId}`;
    if (this.activeJobs.has(jobKey)) {
      throw new ExecutionConflictError(request.sessionId, request.problemId);
    }
    this.activeJobs.add(jobKey);

    try {
      const saveCode = completion
        ? this.sessionService.saveCompletionCode.bind(this.sessionService)
        : this.sessionService.saveCode.bind(this.sessionService);
      saveCode({
        sessionId: request.sessionId,
        problemId: request.problemId,
        language: request.language,
        source: request.source,
      });
      const session = this.sessions.findById(request.sessionId);
      if (!session) {
        throw new PersistenceNotFoundError("session", request.sessionId);
      }
      const assessment = this.assessments.findById(session.assessmentId);
      if (!assessment) {
        throw new PersistenceNotFoundError("assessment", session.assessmentId);
      }
      const problem = assessment.assessment.assessment.problems.find(
        ({ id }) => id === request.problemId,
      );
      if (!problem) {
        throw new PersistenceNotFoundError("problem", request.problemId);
      }

      const result = await this.coordinator.execute({
        language: request.language,
        source: request.source,
        signature: problem.signature,
        limits: problem.limits,
        visibleTests: problem.tests.visible,
        hiddenTests: problem.tests.hidden,
        mode: request.mode,
      });
      if (request.mode === "submit") {
        const submit = completion
          ? this.sessionService.submitCompletionProblem.bind(this.sessionService)
          : this.sessionService.submitProblem.bind(this.sessionService);
        submit({
          sessionId: request.sessionId,
          problemId: request.problemId,
          language: request.language,
          result,
        });
      }
      return result;
    } finally {
      this.activeJobs.delete(jobKey);
    }
  }

  isRunning(
    sessionId: string,
    problemId: string,
  ): boolean {
    return this.activeJobs.has(`${sessionId}\0${problemId}`);
  }
}

export function isSupportedLanguage(value: unknown): value is Language {
  return value === "java" || value === "cpp" || value === "python";
}
