import type { AssessmentPresetId } from "@gca-practice/contracts";
import {
  AvoidanceManifestBuilder,
  type ProblemHistoryEntry,
} from "./AvoidanceManifestBuilder.js";
import generationPromptTemplate from "./assessment-generation-prompt.txt?raw";
import imcGenerationPromptTemplate from "./imc-assessment-generation-prompt.txt?raw";
import robloxGenerationPromptTemplate from "./roblox-assessment-generation-prompt.txt?raw";

const HISTORY_MANIFEST_TOKEN = "{{HISTORY_MANIFEST}}";

export class GenerationPromptBuilder {
  constructor(
    private readonly preset: AssessmentPresetId = "gca",
    private readonly avoidance = new AvoidanceManifestBuilder(),
  ) {}

  build(history: ProblemHistoryEntry[]): string {
    const template = {
      gca: generationPromptTemplate,
      roblox: robloxGenerationPromptTemplate,
      imc: imcGenerationPromptTemplate,
    }[this.preset];
    return template
      .replace(HISTORY_MANIFEST_TOKEN, this.avoidance.build(history, this.preset))
      .trim();
  }
}
