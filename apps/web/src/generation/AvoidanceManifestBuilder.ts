export interface ProblemHistoryEntry {
  title: string;
  conceptSummary: string;
  patternTags: string[];
  complexity: string;
  signatureShape: string;
}

export class AvoidanceManifestBuilder {
  build(entries: ProblemHistoryEntry[]): string {
    if (entries.length === 0) {
      return "AVOID PREVIOUSLY USED CONCEPTS:\nNo prior imported problems are recorded yet.";
    }

    return [
      "AVOID PREVIOUSLY USED CONCEPTS:",
      ...entries.map(
        (entry, index) =>
          `${index + 1}. ${entry.title}\n` +
          `   Tags: ${entry.patternTags.join(", ") || "none"}\n` +
          `   Complexity: ${entry.complexity}\n` +
          `   Signature: ${entry.signatureShape}\n` +
          `   ${entry.conceptSummary}`,
      ),
    ].join("\n\n");
  }
}
