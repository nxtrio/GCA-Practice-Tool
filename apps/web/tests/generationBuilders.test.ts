import { describe, expect, it } from "vitest";
import { AvoidanceManifestBuilder } from "../src/generation/AvoidanceManifestBuilder.ts";
import { GenerationPromptBuilder } from "../src/generation/GenerationPromptBuilder.ts";
import { RepairPromptBuilder } from "../src/generation/RepairPromptBuilder.ts";

describe("Phase 9 prompt builders", () => {
  it("includes the full generation contract and prior-problem manifest", () => {
    const prompt = new GenerationPromptBuilder().build([{
      title: "Alternating Blocks",
      conceptSummary: "Count windows with alternating comparisons.",
      patternTags: ["sliding-window", "array"],
      complexity: "O(n)",
      signatureShape: "(array<int>) -> int",
    }]);

    expect(prompt).toContain("exactly four single-function problems");
    expect(prompt).toContain("Return JSON only");
    expect(prompt).toContain("Do not use Markdown or code fences");
    expect(prompt).toContain("validation.referenceLanguage must be \"python\"");
    expect(prompt).toContain("visible and hidden tests");
    expect(prompt).toContain("edge, and stress-oriented cases");
    expect(prompt).toContain("known CodeSignal questions");
    expect(prompt).toContain("REQUIRED JSON SHAPE");
    expect(prompt).toContain('"durationSeconds": 4200');
    expect(prompt).toContain("2–4 visible tests");
    expect(prompt).toContain("Alternating Blocks");
    expect(prompt).toContain("sliding-window, array");
    expect(prompt).toContain("(array<int>) -> int");
  });

  it("builds a useful empty avoidance manifest", () => {
    expect(new AvoidanceManifestBuilder().build([])).toContain(
      "No prior imported problems",
    );
  });

  it("asks for the entire corrected JSON and lists errors", () => {
    const repair = new RepairPromptBuilder().build([
      { path: "/assessment/problems/2", message: "is invalid" },
    ]);
    expect(repair).toContain("ENTIRE corrected JSON document");
    expect(repair).toContain("Do not wrap the JSON in Markdown");
    expect(repair).toContain("1. /assessment/problems/2: is invalid");
    expect(repair).toContain("Do not change problem concepts unless required");
  });
});
