import type { AssessmentDefinition } from "./assessment.js";

export type AssessmentPresetId = "gca" | "roblox";

export interface AssessmentPreset {
  id: AssessmentPresetId;
  displayName: string;
  shortName: string;
  practiceName: string;
  problemCount: number;
  durationSeconds: number;
}

export const ASSESSMENT_PRESETS = {
  gca: {
    id: "gca",
    displayName: "General Coding Assessment",
    shortName: "GCA",
    practiceName: "GCA Practice",
    problemCount: 4,
    durationSeconds: 4_200,
  },
  roblox: {
    id: "roblox",
    displayName: "Roblox Coding Assessment",
    shortName: "Roblox",
    practiceName: "Roblox Practice",
    problemCount: 2,
    durationSeconds: 3_000,
  },
} as const satisfies Record<AssessmentPresetId, AssessmentPreset>;

export class AssessmentPresetResolutionError extends Error {
  constructor() {
    super(
      "Assessments without a preset must use the legacy GCA format: exactly 4 problems and 4200 seconds.",
    );
    this.name = "AssessmentPresetResolutionError";
  }
}

export function resolveAssessmentPreset(
  assessment: AssessmentDefinition,
): AssessmentPreset {
  if (assessment.preset) return ASSESSMENT_PRESETS[assessment.preset];
  if (
    assessment.problems.length === ASSESSMENT_PRESETS.gca.problemCount &&
    assessment.durationSeconds === ASSESSMENT_PRESETS.gca.durationSeconds
  ) {
    return ASSESSMENT_PRESETS.gca;
  }
  throw new AssessmentPresetResolutionError();
}
