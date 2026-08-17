import type { AssessmentPresetId } from "@gca-practice/contracts";

export interface ProblemHistoryEntry {
  preset?: AssessmentPresetId;
  title: string;
  conceptSummary: string;
  patternTags: string[];
  complexity: string;
  signatureShape: string;
}

export class AvoidanceManifestBuilder {
  build(
    entries: ProblemHistoryEntry[],
    selectedPreset?: AssessmentPresetId,
  ): string {
    if (entries.length === 0) {
      return "AVOID PREVIOUSLY USED CONCEPTS:\nNo prior imported problems are recorded yet.";
    }

    if (selectedPreset && entries.some(({ preset }) => preset !== undefined)) {
      const samePreset = entries.filter(({ preset }) => preset === selectedPreset);
      const otherPresets = entries.filter(({ preset }) => preset !== selectedPreset);
      return [
        "AVOID PREVIOUSLY USED CONCEPTS:",
        `SAME-PRESET HISTORY (${selectedPreset}) — strongly avoid repeating these concepts, mechanics, or close variants:`,
        samePreset.length > 0
          ? formatEntries(samePreset)
          : "No prior problems are recorded for this preset.",
        "OTHER-PRESET HISTORY — do not reproduce these exact problems or cosmetic reskins; general topic overlap is allowed:",
        otherPresets.length > 0
          ? formatEntries(otherPresets)
          : "No problems are recorded for other presets.",
      ].join("\n\n");
    }

    return [
      "AVOID PREVIOUSLY USED CONCEPTS:",
      formatEntries(entries),
    ].join("\n\n");
  }
}

function formatEntries(entries: ProblemHistoryEntry[]): string {
  return entries.map(
    (entry, index) =>
      `${index + 1}. ${entry.title}\n` +
      `   Tags: ${entry.patternTags.join(", ") || "none"}\n` +
      `   Complexity: ${entry.complexity}\n` +
      `   Signature: ${entry.signatureShape}\n` +
      `   ${entry.conceptSummary}`,
  ).join("\n\n");
}
