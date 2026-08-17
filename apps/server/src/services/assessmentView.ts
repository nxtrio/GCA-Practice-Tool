import type { Assessment } from "@gca-practice/contracts";
import type { PersistedAssessment } from "../persistence/repositories/AssessmentRepository.js";

export interface SafeProblemView {
  id: string;
  slot: number;
  title: string;
  generationMetadata: Assessment["assessment"]["problems"][number]["generationMetadata"];
  description: string;
  constraints: string[];
  signature: Assessment["assessment"]["problems"][number]["signature"];
  examples: Assessment["assessment"]["problems"][number]["examples"];
  visibleTests: Assessment["assessment"]["problems"][number]["tests"]["visible"];
}

export interface SafeAssessmentDraftView {
  title: string;
  durationSeconds: number;
  problems: SafeProblemView[];
}

export interface SafeAssessmentView extends SafeAssessmentDraftView {
  id: string;
}

export function assessmentDraftToView(
  assessment: Assessment,
): SafeAssessmentDraftView {
  return {
    title: assessment.assessment.title,
    durationSeconds: assessment.assessment.durationSeconds,
    problems: assessment.assessment.problems.map((problem) => ({
      id: problem.id,
      slot: problem.slot,
      title: problem.title,
      generationMetadata: structuredClone(problem.generationMetadata),
      description: problem.description,
      constraints: [...problem.constraints],
      signature: structuredClone(problem.signature),
      examples: structuredClone(problem.examples),
      visibleTests: structuredClone(problem.tests.visible),
    })),
  };
}

export function persistedAssessmentToView(
  assessment: PersistedAssessment,
): SafeAssessmentView {
  return { id: assessment.id, ...assessmentDraftToView(assessment.assessment) };
}
