import type { SessionCode } from "../persistence/repositories/SessionRepository.js";
import type { Language } from "@gca-practice/contracts";
import type { AssessmentRepository } from "../persistence/repositories/AssessmentRepository.js";
import type { SessionRepository } from "../persistence/repositories/SessionRepository.js";
import type { ExecutionService } from "./ExecutionService.js";
import {
  PersistenceNotFoundError,
  SessionStateError,
  type SessionService,
} from "./SessionService.js";
import type { AssessmentResultSummary, ResultsService } from "./ResultsService.js";

export class CompletionService {
  constructor(
    private readonly execution: ExecutionService,
    private readonly assessments: AssessmentRepository,
    private readonly sessions: SessionRepository,
    private readonly sessionService: SessionService,
    private readonly results: ResultsService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async complete(
    sessionId: string,
    snapshots: CompletionCodeSnapshot[] = [],
  ): Promise<AssessmentResultSummary> {
    const session = this.sessions.findById(sessionId);
    if (!session) throw new PersistenceNotFoundError("session", sessionId);
    if (session.status === "completed") {
      return this.results.get(sessionId);
    }
    if (
      (session.status !== "active" && session.status !== "expired") ||
      !session.expiresAt
    ) {
      throw new SessionStateError(
        `Session "${sessionId}" cannot be completed from status ${session.status}.`,
      );
    }

    const assessment = this.assessments.findById(session.assessmentId);
    if (!assessment) {
      throw new PersistenceNotFoundError("assessment", session.assessmentId);
    }
    for (const snapshot of snapshots) {
      this.sessionService.saveCompletionCode({ sessionId, ...snapshot });
    }
    if (session.status === "expired" && snapshots.length === 0) {
      return this.results.get(sessionId);
    }
    const latestCode = latestCodeByProblem(this.sessions.listCode(sessionId));
    for (const problem of assessment.assessment.assessment.problems) {
      const code = latestCode.get(problem.id);
      if (!code) continue;
      await this.execution.executeForCompletion({
        sessionId,
        problemId: problem.id,
        language: code.language,
        source: code.source,
        mode: "submit",
      });
    }

    if (session.status === "expired") {
      // Expiration was already persisted by a racing autosave/resume request.
    } else if (this.now().getTime() >= Date.parse(session.expiresAt)) {
      this.sessionService.expireSession(sessionId);
    } else {
      this.sessionService.finishSession(sessionId);
    }
    return this.results.get(sessionId);
  }
}

export interface CompletionCodeSnapshot {
  problemId: string;
  language: Language;
  source: string;
}

function latestCodeByProblem(code: SessionCode[]): Map<string, SessionCode> {
  const latest = new Map<string, SessionCode>();
  for (const candidate of code) {
    const current = latest.get(candidate.problemId);
    if (!current || candidate.updatedAt > current.updatedAt) {
      latest.set(candidate.problemId, candidate);
    }
  }
  return latest;
}
