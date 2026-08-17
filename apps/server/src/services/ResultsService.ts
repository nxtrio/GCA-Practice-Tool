import type {
  Language,
  Problem,
  RunResult,
  Session,
  Submission,
} from "@gca-practice/contracts";
import type { AssessmentRepository } from "../persistence/repositories/AssessmentRepository.js";
import type { SessionRepository } from "../persistence/repositories/SessionRepository.js";
import type { SubmissionRepository } from "../persistence/repositories/SubmissionRepository.js";
import {
  PersistenceNotFoundError,
  SessionStateError,
  type SessionService,
} from "./SessionService.js";

export interface ProblemResultSummary {
  problemId: string;
  slot: number;
  title: string;
  verdict: Submission["result"]["verdict"] | "not_attempted";
  passed: number;
  total: number;
  language?: Language;
}

export interface AssessmentResultSummary {
  sessionId: string;
  assessmentId: string;
  assessmentTitle: string;
  status: Session["status"];
  startedAt: string;
  expiresAt: string;
  finishedAt: string | null;
  problemsSolved: number;
  problemCount: number;
  testsPassed: number;
  testsTotal: number;
  timeUsedMs: number;
  timeRemainingMs: number;
  problems: ProblemResultSummary[];
}

export interface UnfinishedSessionSummary {
  sessionId: string;
  assessmentTitle: string;
  startedAt: string;
  expiresAt: string;
  problemsSolved: number;
  problemCount: number;
}

export interface HistoryView {
  unfinished: UnfinishedSessionSummary[];
  completed: AssessmentResultSummary[];
}

export interface ReadinessAnalysisProblem {
  problemId: string;
  slot: number;
  title: string;
  context: {
    conceptSummary: string;
    skills: string[];
    expectedComplexity: string;
    patternTags: string[];
    description: string;
    constraints: string[];
    signature: Problem["signature"];
    examples: Problem["examples"];
    visibleTests: Problem["tests"]["visible"];
    testInventory: {
      visible: number;
      hidden: number;
      total: number;
    };
  };
  finalCode: {
    language: Language;
    source: string;
    savedAt: string;
  } | null;
  outcome: ProblemResultSummary;
  attempts: Array<{
    type: Submission["submissionType"];
    submittedAt: string;
    language: Language;
    passed: number;
    total: number;
    result: RunResult;
  }>;
}

export interface ReadinessAnalysisExport {
  schemaVersion: "1.0";
  kind: "gca_practice_readiness_analysis";
  generatedAt: string;
  privacy: {
    hiddenTestDetailsIncluded: false;
    referenceSolutionsIncluded: false;
    excluded: string[];
  };
  assessment: {
    sessionId: string;
    assessmentId: string;
    title: string;
    status: "completed" | "expired";
    timing: {
      durationMs: number;
      startedAt: string;
      expiresAt: string;
      finishedAt: string | null;
      timeUsedMs: number;
      timeRemainingMs: number;
    };
    summary: {
      problemsSolved: number;
      problemCount: number;
      testsPassed: number;
      testsTotal: number;
    };
    problems: ReadinessAnalysisProblem[];
  };
  analysisRequest: {
    objective: string;
    requestedSections: string[];
    guidance: string[];
    limitations: string[];
  };
}

export class ResultsService {
  constructor(
    private readonly assessments: AssessmentRepository,
    private readonly sessions: SessionRepository,
    private readonly submissions: SubmissionRepository,
    private readonly sessionService: SessionService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  get(sessionId: string): AssessmentResultSummary {
    const session = this.refreshSession(sessionId);
    const assessment = this.assessments.findById(session.assessmentId);
    if (!assessment) {
      throw new PersistenceNotFoundError("assessment", session.assessmentId);
    }
    if (!session.startedAt || !session.expiresAt) {
      throw new Error(`Session "${sessionId}" has incomplete timing data.`);
    }

    const latest = latestSubmissions(
      this.submissions.listForSession(session.id),
    );
    const problems = assessment.assessment.assessment.problems.map((problem) => {
      const submission = latest.get(problem.id);
      const total = problem.tests.visible.length + problem.tests.hidden.length;
      return {
        problemId: problem.id,
        slot: problem.slot,
        title: problem.title,
        verdict: submission?.result.verdict ?? "not_attempted",
        passed: submission?.passed ?? 0,
        total,
        ...(submission ? { language: submission.language } : {}),
      } satisfies ProblemResultSummary;
    });
    const endMs = completionTime(session, this.now().getTime());
    const startedMs = Date.parse(session.startedAt);
    const expiresMs = Date.parse(session.expiresAt);

    return {
      sessionId: session.id,
      assessmentId: assessment.id,
      assessmentTitle: assessment.title,
      status: session.status,
      startedAt: session.startedAt,
      expiresAt: session.expiresAt,
      finishedAt: session.finishedAt,
      problemsSolved: problems.filter(({ verdict }) => verdict === "accepted").length,
      problemCount: problems.length,
      testsPassed: problems.reduce((sum, problem) => sum + problem.passed, 0),
      testsTotal: problems.reduce((sum, problem) => sum + problem.total, 0),
      timeUsedMs: Math.max(0, Math.min(expiresMs, endMs) - startedMs),
      timeRemainingMs: Math.max(0, expiresMs - endMs),
      problems,
    };
  }

  history(): HistoryView {
    const all = this.sessions.list();
    return {
      unfinished: all
        .filter(({ status }) => status === "active")
        .map((session) => {
          const result = this.get(session.id);
          return {
            sessionId: session.id,
            assessmentTitle: result.assessmentTitle,
            startedAt: result.startedAt,
            expiresAt: result.expiresAt,
            problemsSolved: result.problemsSolved,
            problemCount: result.problemCount,
          };
        }),
      completed: all
        .filter(({ status }) => status === "completed" || status === "expired")
        .map((session) => this.get(session.id)),
    };
  }

  analysisExport(sessionId: string): ReadinessAnalysisExport {
    const summary = this.get(sessionId);
    if (summary.status !== "completed" && summary.status !== "expired") {
      throw new SessionStateError(
        `Session "${sessionId}" must be completed before results can be exported.`,
      );
    }
    const assessment = this.assessments.findById(summary.assessmentId);
    if (!assessment) {
      throw new PersistenceNotFoundError("assessment", summary.assessmentId);
    }
    const submissions = this.submissions.listForSession(sessionId);
    const latest = latestSubmissions(submissions);
    const code = this.sessions.listCode(sessionId);

    return {
      schemaVersion: "1.0",
      kind: "gca_practice_readiness_analysis",
      generatedAt: this.now().toISOString(),
      privacy: {
        hiddenTestDetailsIncluded: false,
        referenceSolutionsIncluded: false,
        excluded: [
          "hidden test inputs",
          "hidden expected outputs",
          "reference solutions",
        ],
      },
      assessment: {
        sessionId,
        assessmentId: summary.assessmentId,
        title: summary.assessmentTitle,
        status: summary.status,
        timing: {
          durationMs: Date.parse(summary.expiresAt) - Date.parse(summary.startedAt),
          startedAt: summary.startedAt,
          expiresAt: summary.expiresAt,
          finishedAt: summary.finishedAt,
          timeUsedMs: summary.timeUsedMs,
          timeRemainingMs: summary.timeRemainingMs,
        },
        summary: {
          problemsSolved: summary.problemsSolved,
          problemCount: summary.problemCount,
          testsPassed: summary.testsPassed,
          testsTotal: summary.testsTotal,
        },
        problems: assessment.assessment.assessment.problems.map((problem) => {
          const problemSubmissions = submissions.filter(
            ({ problemId }) => problemId === problem.id,
          );
          const finalSubmission = latest.get(problem.id);
          const finalCode = selectFinalCode(
            code.filter(({ problemId }) => problemId === problem.id),
            finalSubmission?.language,
          );
          return {
            problemId: problem.id,
            slot: problem.slot,
            title: problem.title,
            context: {
              conceptSummary: problem.generationMetadata.conceptSummary,
              skills: [...problem.generationMetadata.skills],
              expectedComplexity: problem.generationMetadata.expectedComplexity,
              patternTags: [...problem.generationMetadata.patternTags],
              description: problem.description,
              constraints: [...problem.constraints],
              signature: structuredClone(problem.signature),
              examples: structuredClone(problem.examples),
              visibleTests: structuredClone(problem.tests.visible),
              testInventory: {
                visible: problem.tests.visible.length,
                hidden: problem.tests.hidden.length,
                total: problem.tests.visible.length + problem.tests.hidden.length,
              },
            },
            finalCode: finalCode
              ? {
                  language: finalCode.language,
                  source: finalCode.source,
                  savedAt: finalCode.updatedAt,
                }
              : null,
            outcome: summary.problems.find(({ problemId }) => problemId === problem.id)!,
            attempts: problemSubmissions.map((submission) => ({
              type: submission.submissionType,
              submittedAt: submission.submittedAt,
              language: submission.language,
              passed: submission.passed,
              total: submission.total,
              result: redactResult(submission.result),
            })),
          } satisfies ReadinessAnalysisProblem;
        }),
      },
      analysisRequest: {
        objective:
          "Assess the candidate's readiness for a timed General Coding Assessment and provide evidence-based recommendations.",
        requestedSections: [
          "overall readiness assessment",
          "correctness and edge-case handling",
          "algorithmic complexity and problem-solving patterns",
          "code quality and language fluency",
          "time management and completion strategy",
          "prioritized weaknesses",
          "recommended practice plan",
        ],
        guidance: [
          "Base every conclusion on the supplied problem context, code, timing, attempts, and judge outcomes.",
          "Distinguish correctness gaps from implementation, language, and time-management issues.",
          "Call out strong evidence as well as weaknesses and make recommendations specific and actionable.",
        ],
        limitations: [
          "Hidden test inputs and expected outputs are intentionally omitted.",
          "Execution timings depend on the local machine and are not a standardized benchmark.",
          "The pass count is not an official CodeSignal score.",
        ],
      },
    };
  }

  private refreshSession(sessionId: string): Session {
    const session = this.sessions.findById(sessionId);
    if (!session) throw new PersistenceNotFoundError("session", sessionId);
    return session.status === "active"
      ? this.sessionService.resumeSession(sessionId).session
      : session;
  }
}

function selectFinalCode(
  code: ReturnType<SessionRepository["listCode"]>,
  judgedLanguage?: Language,
): ReturnType<SessionRepository["listCode"]>[number] | undefined {
  if (judgedLanguage) {
    const judged = code.find(({ language }) => language === judgedLanguage);
    if (judged) return judged;
  }
  return [...code].sort((left, right) => left.updatedAt.localeCompare(right.updatedAt)).at(-1);
}

function redactResult(result: RunResult): RunResult {
  return {
    verdict: result.verdict,
    ...(result.compileTimeMs === undefined ? {} : { compileTimeMs: result.compileTimeMs }),
    passed: result.passed,
    total: result.total,
    tests: result.tests.map((test) => test.visibility === "hidden"
      ? {
          visibility: "hidden",
          verdict: test.verdict,
          executionTimeMs: test.executionTimeMs,
        }
      : {
          visibility: "visible",
          testId: test.testId,
          verdict: test.verdict,
          executionTimeMs: test.executionTimeMs,
          expected: test.expected,
          ...(test.actual === undefined ? {} : { actual: test.actual }),
          ...(test.stdout === undefined ? {} : { stdout: test.stdout }),
          ...(test.stderr === undefined ? {} : { stderr: test.stderr }),
          ...(test.message === undefined ? {} : { message: test.message }),
        }),
  };
}

function latestSubmissions(submissions: Submission[]): Map<string, Submission> {
  const latest = new Map<string, Submission>();
  for (const submission of submissions) latest.set(submission.problemId, submission);
  return latest;
}

function completionTime(session: Session, now: number): number {
  if (session.finishedAt) return Date.parse(session.finishedAt);
  return Math.min(now, Date.parse(session.expiresAt ?? new Date(now).toISOString()));
}
