import type { Language, Session } from "@gca-practice/contracts";
import type { AssessmentView } from "../assessment/types.js";
import type { ProblemHistoryEntry } from "../generation/AvoidanceManifestBuilder.js";

export interface ValidationIssueView {
  stage: "json" | "schema" | "semantic" | "oracle";
  code: string;
  path: string;
  message: string;
  line?: number;
  column?: number;
}

export type AssessmentValidationView =
  | { valid: false; errors: ValidationIssueView[]; warnings: [] }
  | {
      valid: true;
      validationId: string;
      assessment: Omit<AssessmentView, "id">;
      errors: [];
      warnings: string[];
    };

export interface SessionCodeView {
  sessionId: string;
  problemId: string;
  language: Language;
  source: string;
  updatedAt: string;
}

export interface ResumedSessionView {
  session: Session;
  assessment: AssessmentView;
  code: SessionCodeView[];
  remainingMs: number;
}

export interface ToolchainView {
  available: boolean;
  version: string | null;
  installationHint?: string;
  javaPath?: string | null;
  javacPath?: string | null;
  compiler?: string | null;
  compilerPath?: string | null;
  pythonPath?: string | null;
}

export interface EnvironmentView {
  java: ToolchainView;
  cpp: ToolchainView;
  python: ToolchainView;
}

export interface ProblemResultView {
  problemId: string;
  slot: number;
  title: string;
  verdict:
    | "accepted"
    | "wrong_answer"
    | "compile_error"
    | "runtime_error"
    | "time_limit_exceeded"
    | "output_limit_exceeded"
    | "internal_error"
    | "not_attempted";
  passed: number;
  total: number;
  language?: Language;
}

export interface AssessmentResultView {
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
  problems: ProblemResultView[];
}

export interface UnfinishedSessionView {
  sessionId: string;
  assessmentTitle: string;
  startedAt: string;
  expiresAt: string;
  problemsSolved: number;
  problemCount: number;
}

export interface HistoryView {
  unfinished: UnfinishedSessionView[];
  completed: AssessmentResultView[];
}

export interface CompletionCodeSnapshot {
  problemId: string;
  language: Language;
  source: string;
}

export interface ImportWorkflowClient {
  environment(): Promise<EnvironmentView>;
  problemHistory(): Promise<ProblemHistoryEntry[]>;
  validateAssessment(source: string): Promise<AssessmentValidationView>;
  importAssessment(validationId: string): Promise<AssessmentView>;
  startSession(assessmentId: string): Promise<Session>;
  finishSession(
    sessionId: string,
    code: CompletionCodeSnapshot[],
  ): Promise<AssessmentResultView>;
  results(sessionId: string): Promise<AssessmentResultView>;
  history(): Promise<HistoryView>;
  resumeSession(sessionId: string): Promise<ResumedSessionView>;
  saveCode(input: {
    sessionId: string;
    problemId: string;
    language: Language;
    source: string;
  }): Promise<void>;
}

export class ApiImportWorkflowClient implements ImportWorkflowClient {
  constructor(private readonly baseUrl = "") {}

  environment(): Promise<EnvironmentView> {
    return this.request("/api/environment");
  }

  problemHistory(): Promise<ProblemHistoryEntry[]> {
    return this.request("/api/problem-catalog");
  }

  validateAssessment(source: string): Promise<AssessmentValidationView> {
    return this.request("/api/assessments/validate", {
      method: "POST",
      body: JSON.stringify({ source }),
    });
  }

  importAssessment(validationId: string): Promise<AssessmentView> {
    return this.request("/api/assessments/import", {
      method: "POST",
      body: JSON.stringify({ validationId }),
    });
  }

  startSession(assessmentId: string): Promise<Session> {
    return this.request("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ assessmentId }),
    });
  }

  finishSession(
    sessionId: string,
    code: CompletionCodeSnapshot[],
  ): Promise<AssessmentResultView> {
    return this.request(`/api/sessions/${encodeURIComponent(sessionId)}/finish`, {
      method: "POST",
      body: JSON.stringify({ code }),
    });
  }

  results(sessionId: string): Promise<AssessmentResultView> {
    return this.request(`/api/sessions/${encodeURIComponent(sessionId)}/results`);
  }

  history(): Promise<HistoryView> {
    return this.request("/api/history");
  }

  resumeSession(sessionId: string): Promise<ResumedSessionView> {
    return this.request(`/api/sessions/${encodeURIComponent(sessionId)}`);
  }

  async saveCode(input: {
    sessionId: string;
    problemId: string;
    language: Language;
    source: string;
  }): Promise<void> {
    await this.request(`/api/sessions/${encodeURIComponent(input.sessionId)}/code`, {
      method: "PATCH",
      body: JSON.stringify({
        problemId: input.problemId,
        language: input.language,
        source: input.source,
      }),
    });
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...init.headers },
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: unknown };
      throw new Error(
        typeof body.error === "string"
          ? body.error
          : `Request failed with status ${response.status}.`,
      );
    }
    return (await response.json()) as T;
  }
}
