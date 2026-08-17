import type { Language, SupportedValue } from "./types.js";

export type ExecutionVerdict =
  | "accepted"
  | "wrong_answer"
  | "compile_error"
  | "runtime_error"
  | "time_limit_exceeded"
  | "output_limit_exceeded"
  | "internal_error";

export type TestVisibility = "visible" | "hidden";

export interface RunRequest {
  sessionId: string;
  problemId: string;
  language: Language;
  source: string;
  mode: "run" | "submit";
}

interface BaseTestResult {
  verdict: ExecutionVerdict;
  executionTimeMs: number;
}

export interface VisibleTestResult extends BaseTestResult {
  visibility: "visible";
  testId: string;
  expected: SupportedValue;
  actual?: SupportedValue;
  stdout?: string;
  stderr?: string;
  message?: string;
}

export interface HiddenTestResult extends BaseTestResult {
  visibility: "hidden";
}

export type TestResult = VisibleTestResult | HiddenTestResult;

export interface RunResult {
  verdict: ExecutionVerdict;
  compileTimeMs?: number;
  passed: number;
  total: number;
  tests: TestResult[];
}
