import type { RunResult } from "./execution.js";
import type { Language } from "./types.js";

export type SessionStatus =
  | "not_started"
  | "active"
  | "completed"
  | "expired"
  | "abandoned";

export interface Session {
  id: string;
  assessmentId: string;
  status: SessionStatus;
  startedAt: string | null;
  expiresAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export interface Submission {
  id: string;
  sessionId: string;
  problemId: string;
  language: Language;
  submissionType: "run" | "submit";
  submittedAt: string;
  passed: number;
  total: number;
  result: RunResult;
}

