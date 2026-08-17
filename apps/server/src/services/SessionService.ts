import { randomUUID } from "node:crypto";
import type {
  Assessment,
  Language,
  RunResult,
  Session,
  Submission,
} from "@gca-practice/contracts";
import {
  AssessmentRepository,
  type PersistedAssessment,
} from "../persistence/repositories/AssessmentRepository.js";
import {
  SessionRepository,
  type SessionCode,
} from "../persistence/repositories/SessionRepository.js";
import { SubmissionRepository } from "../persistence/repositories/SubmissionRepository.js";

export interface SessionServiceOptions {
  now?: () => Date;
  idFactory?: () => string;
}

export interface SaveCodeInput {
  sessionId: string;
  problemId: string;
  language: Language;
  source: string;
}

export interface SubmitProblemInput {
  sessionId: string;
  problemId: string;
  language: Language;
  result: RunResult;
}

export interface ResumedSession {
  session: Session;
  assessment: PersistedAssessment;
  code: SessionCode[];
  submissions: Submission[];
  remainingMs: number;
}

export class PersistenceNotFoundError extends Error {
  constructor(entity: "assessment" | "session" | "problem", id: string) {
    super(`${capitalize(entity)} "${id}" was not found.`);
    this.name = "PersistenceNotFoundError";
  }
}

export class SessionStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionStateError";
  }
}

export class SessionService {
  private readonly now: () => Date;
  private readonly idFactory: () => string;

  constructor(
    private readonly assessments: AssessmentRepository,
    private readonly sessions: SessionRepository,
    private readonly submissions: SubmissionRepository,
    options: SessionServiceOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.idFactory = options.idFactory ?? randomUUID;
  }

  startSession(assessmentId: string): Session {
    const assessment = this.requireAssessment(assessmentId);
    const now = this.now();
    const expiresAt = new Date(
      now.getTime() + assessment.durationSeconds * 1_000,
    );

    return this.sessions.createActive({
      id: this.idFactory(),
      assessmentId,
      startedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString(),
    });
  }

  saveCode(input: SaveCodeInput): SessionCode {
    const now = this.now();
    const session = this.requireActiveSession(input.sessionId, now);
    const assessment = this.requireAssessment(session.assessmentId);
    assertProblemExists(assessment.assessment, input.problemId);

    return this.sessions.saveCode({
      ...input,
      updatedAt: now.toISOString(),
    });
  }

  /** Saves the final browser snapshot even when the persisted deadline just elapsed. */
  saveCompletionCode(input: SaveCodeInput): SessionCode {
    const now = this.now();
    const session = this.requireSession(input.sessionId);
    if (session.status !== "active" && session.status !== "expired") {
      throw new SessionStateError(
        `Session "${input.sessionId}" cannot accept a final snapshot from status ${session.status}.`,
      );
    }
    const assessment = this.requireAssessment(session.assessmentId);
    assertProblemExists(assessment.assessment, input.problemId);
    return this.sessions.saveCode({ ...input, updatedAt: now.toISOString() });
  }

  submitProblem(input: SubmitProblemInput): Submission {
    const now = this.now();
    const session = this.requireActiveSession(input.sessionId, now);
    const assessment = this.requireAssessment(session.assessmentId);
    assertProblemExists(assessment.assessment, input.problemId);
    validateRunResult(input.result);

    return this.submissions.save({
      id: this.idFactory(),
      sessionId: input.sessionId,
      problemId: input.problemId,
      language: input.language,
      submissionType: "submit",
      submittedAt: now.toISOString(),
      passed: input.result.passed,
      total: input.result.total,
      result: input.result,
    });
  }

  /** Records judging performed as part of an active session's completion. */
  submitCompletionProblem(input: SubmitProblemInput): Submission {
    const now = this.now();
    const session = this.requireSession(input.sessionId);
    if (session.status !== "active" && session.status !== "expired") {
      throw new SessionStateError(
        `Session "${input.sessionId}" cannot record final judging from status ${session.status}.`,
      );
    }
    const assessment = this.requireAssessment(session.assessmentId);
    assertProblemExists(assessment.assessment, input.problemId);
    validateRunResult(input.result);
    return this.submissions.save({
      id: this.idFactory(),
      sessionId: input.sessionId,
      problemId: input.problemId,
      language: input.language,
      submissionType: "submit",
      submittedAt: now.toISOString(),
      passed: input.result.passed,
      total: input.result.total,
      result: input.result,
    });
  }

  finishSession(sessionId: string): Session {
    const now = this.now();
    const session = this.refreshExpiration(this.requireSession(sessionId), now);
    if (session.status === "completed" || session.status === "expired") {
      return session;
    }
    if (session.status !== "active") {
      throw new SessionStateError(
        `Session "${sessionId}" cannot finish from status ${session.status}.`,
      );
    }

    this.sessions.setStatus(
      sessionId,
      "active",
      "completed",
      now.toISOString(),
    );
    return this.requireSession(sessionId);
  }

  expireSession(sessionId: string): Session {
    const now = this.now();
    const session = this.requireSession(sessionId);
    if (session.status === "expired") return session;
    if (session.status !== "active") {
      throw new SessionStateError(
        `Session "${sessionId}" cannot expire from status ${session.status}.`,
      );
    }
    if (!hasExpired(session, now)) {
      throw new SessionStateError(
        `Session "${sessionId}" has not reached its expiration time.`,
      );
    }

    return this.markExpired(session);
  }

  resumeSession(sessionId: string): ResumedSession {
    const now = this.now();
    const session = this.refreshExpiration(this.requireSession(sessionId), now);
    const assessment = this.requireAssessment(session.assessmentId);

    return {
      session,
      assessment,
      code: this.sessions.listCode(sessionId),
      submissions: this.submissions.listForSession(sessionId),
      remainingMs: remainingMilliseconds(session, now),
    };
  }

  private requireActiveSession(sessionId: string, now: Date): Session {
    const session = this.refreshExpiration(this.requireSession(sessionId), now);
    if (session.status !== "active") {
      throw new SessionStateError(
        `Session "${sessionId}" is ${session.status}; persisted state is read-only.`,
      );
    }
    return session;
  }

  private refreshExpiration(session: Session, now: Date): Session {
    return session.status === "active" && hasExpired(session, now)
      ? this.markExpired(session)
      : session;
  }

  private markExpired(session: Session): Session {
    if (!session.expiresAt) {
      throw new SessionStateError(
        `Active session "${session.id}" has no expiration time.`,
      );
    }
    this.sessions.setStatus(
      session.id,
      "active",
      "expired",
      session.expiresAt,
    );
    return this.requireSession(session.id);
  }

  private requireAssessment(id: string): PersistedAssessment {
    const assessment = this.assessments.findById(id);
    if (!assessment) throw new PersistenceNotFoundError("assessment", id);
    return assessment;
  }

  private requireSession(id: string): Session {
    const session = this.sessions.findById(id);
    if (!session) throw new PersistenceNotFoundError("session", id);
    return session;
  }
}

function hasExpired(session: Session, now: Date): boolean {
  if (!session.expiresAt) {
    throw new SessionStateError(
      `Active session "${session.id}" has no expiration time.`,
    );
  }
  return now.getTime() >= Date.parse(session.expiresAt);
}

function remainingMilliseconds(session: Session, now: Date): number {
  if (session.status !== "active" || !session.expiresAt) return 0;
  return Math.max(0, Date.parse(session.expiresAt) - now.getTime());
}

function assertProblemExists(
  assessment: Assessment,
  problemId: string,
): void {
  if (
    !assessment.assessment.problems.some((problem) => problem.id === problemId)
  ) {
    throw new PersistenceNotFoundError("problem", problemId);
  }
}

function validateRunResult(result: RunResult): void {
  const acceptedTests = result.tests.filter(
    (test) => test.verdict === "accepted",
  ).length;
  if (
    !Number.isInteger(result.passed) ||
    !Number.isInteger(result.total) ||
    result.passed < 0 ||
    result.total < 0 ||
    result.passed > result.total ||
    result.total !== result.tests.length ||
    result.passed !== acceptedTests
  ) {
    throw new RangeError("Submission pass counts are invalid.");
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
