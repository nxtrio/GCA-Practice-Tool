import type {
  ReferenceLanguage,
  SupportedValue,
  TypeSpec,
} from "./types.js";
import type { AssessmentPresetId } from "./assessmentPresets.js";

export interface Parameter {
  name: string;
  type: TypeSpec;
}

export interface FunctionSignature {
  name: string;
  parameters: Parameter[];
  returnType: TypeSpec;
}

export interface TestCase {
  id: string;
  arguments: SupportedValue[];
  expected: SupportedValue;
  category: string;
}

export interface ProblemExample {
  arguments: SupportedValue[];
  output: SupportedValue;
  explanation: string;
}

export interface ProblemLimits {
  executionTimeMs: number;
  compileTimeMs: number;
  outputLimitBytes: number;
}

export interface GenerationMetadata {
  conceptSummary: string;
  skills: string[];
  expectedComplexity: string;
  patternTags: string[];
}

export interface Problem {
  id: string;
  slot: number;
  title: string;
  generationMetadata: GenerationMetadata;
  description: string;
  constraints: string[];
  signature: FunctionSignature;
  examples: ProblemExample[];
  limits: ProblemLimits;
  tests: {
    visible: TestCase[];
    hidden: TestCase[];
  };
  validation: {
    referenceLanguage: ReferenceLanguage;
    referenceSolution: string;
  };
}

export interface AssessmentDefinition {
  preset?: AssessmentPresetId;
  title: string;
  durationSeconds: number;
  problems: Problem[];
}

export interface Assessment {
  schemaVersion: "1.0";
  assessment: AssessmentDefinition;
}
