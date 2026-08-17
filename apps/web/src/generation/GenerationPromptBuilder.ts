import {
  AvoidanceManifestBuilder,
  type ProblemHistoryEntry,
} from "./AvoidanceManifestBuilder.js";
import generationPromptTemplate from "./assessment-generation-prompt.txt?raw";

const HISTORY_MANIFEST_TOKEN = "{{HISTORY_MANIFEST}}";

export class GenerationPromptBuilder {
  constructor(
    private readonly avoidance = new AvoidanceManifestBuilder(),
  ) {}

  build(history: ProblemHistoryEntry[]): string {
    return generationPromptTemplate
      .replace(HISTORY_MANIFEST_TOKEN, this.avoidance.build(history))
      .trim();
  }
}
