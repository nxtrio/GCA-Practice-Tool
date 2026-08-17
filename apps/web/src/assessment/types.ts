import type {
  AssessmentPresetId,
  FunctionSignature,
  GenerationMetadata,
  ProblemExample,
  TestCase,
} from "@gca-practice/contracts";

/** Frontend-safe problem data. Hidden testcase payloads never enter this model. */
export interface AssessmentProblemView {
  id: string;
  slot: number;
  title: string;
  generationMetadata: GenerationMetadata;
  description: string;
  constraints: string[];
  signature: FunctionSignature;
  examples: ProblemExample[];
  visibleTests: TestCase[];
}

export interface AssessmentView {
  id: string;
  preset: AssessmentPresetId;
  title: string;
  durationSeconds: number;
  problems: AssessmentProblemView[];
}

export type ProblemProgress = "untouched" | "written" | "partial" | "solved";
