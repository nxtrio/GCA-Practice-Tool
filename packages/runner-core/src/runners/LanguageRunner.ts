import type {
  ExecutionVerdict,
  FunctionSignature,
  Language,
  ProblemLimits,
  SupportedValue,
  TestCase,
} from "@gca-practice/contracts";

export interface PrepareRequest {
  language: Language;
  source: string;
  signature: FunctionSignature;
  tests: TestCase[];
  limits: ProblemLimits;
}

export interface PreparedProgram {
  language: Language;
  workspacePath: string;
  preparationVerdict: "accepted" | "compile_error" | "internal_error";
  compileTimeMs: number;
  compileStdout: string;
  compileStderr: string;
  compileExitCode: number | null;
  compileSignal: NodeJS.Signals | null;
  testIds: string[];
}

export type MaterializedTest = TestCase;

export interface TestExecutionResult {
  testId: string;
  verdict: ExecutionVerdict;
  executionTimeMs: number;
  expected: SupportedValue;
  actual?: SupportedValue;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  message?: string;
}

/**
 * Common contract for the native language runners introduced in later phases.
 * Phase 0 deliberately defines no process execution implementation.
 */
export interface LanguageRunner {
  prepare(request: PrepareRequest): Promise<PreparedProgram>;
  runTest(
    program: PreparedProgram,
    test: MaterializedTest,
  ): Promise<TestExecutionResult>;
  cleanup(program: PreparedProgram): Promise<void>;
}
