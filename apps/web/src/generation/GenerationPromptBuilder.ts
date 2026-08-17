import {
  AvoidanceManifestBuilder,
  type ProblemHistoryEntry,
} from "./AvoidanceManifestBuilder.js";

export class GenerationPromptBuilder {
  constructor(
    private readonly avoidance = new AvoidanceManifestBuilder(),
  ) {}

  build(history: ProblemHistoryEntry[]): string {
    return `Create one original, internally consistent GCA-style practice assessment.

OUTPUT CONTRACT
- Return JSON only. Do not use Markdown or code fences.
- Use schemaVersion "1.0", a 70-minute durationSeconds value of 4200, and exactly four single-function problems.
- Each problem must include id, slot, title, generationMetadata, description, constraints, signature, examples, limits, tests, and validation.
- Supported TypeSpec values are only {"kind":"int"}, {"kind":"long"}, {"kind":"boolean"}, {"kind":"string"}, and recursively {"kind":"array","items":TypeSpec}.
- Every signature name must be "solution". Every test argument list must match its signature and every expected value must match the return TypeSpec.
- validation.referenceLanguage must be "python" and validation.referenceSolution must define solution(...) for every problem.
- Include meaningful visible and hidden tests for every problem, including boundary, edge, and stress-oriented cases.
- Execute each Python reference solution mentally or with tools and verify every declared expected output before responding.
- Keep descriptions, examples, constraints, tests, metadata, and reference code mutually consistent.

REQUIRED JSON SHAPE
{
  "schemaVersion": "1.0",
  "assessment": {
    "title": "...",
    "durationSeconds": 4200,
    "problems": [{
      "id": "p1",
      "slot": 1,
      "title": "...",
      "generationMetadata": {
        "conceptSummary": "...",
        "skills": ["..."],
        "expectedComplexity": "O(...) ",
        "patternTags": ["..."]
      },
      "description": "...",
      "constraints": ["..."],
      "signature": {
        "name": "solution",
        "parameters": [{"name": "value", "type": {"kind": "int"}}],
        "returnType": {"kind": "int"}
      },
      "examples": [{"arguments": [1], "output": 1, "explanation": "..."}],
      "limits": {"executionTimeMs": 2000, "compileTimeMs": 10000, "outputLimitBytes": 65536},
      "tests": {
        "visible": [{"id": "p1-v1", "arguments": [1], "expected": 1, "category": "example"}],
        "hidden": [{"id": "p1-h1", "arguments": [2], "expected": 2, "category": "boundary"}]
      },
      "validation": {"referenceLanguage": "python", "referenceSolution": "def solution(value):\\n    return value"}
    }]
  }
}
Repeat that problem object exactly four times with slots 1 through 4 and unique problem/test IDs. Aim for 2–4 visible tests, 10–20 hidden correctness tests, 5–10 hidden edge tests, and 2–5 hidden stress tests per problem.

PROBLEM PROFILE
1. Straightforward arrays/strings/loops, approximately 5–10 minutes.
2. Moderate maps, counting, transformations, prefix state, or sliding windows, approximately 10–15 minutes.
3. Implementation-heavy simulation, matrices, state, or multiple rules, approximately 15–25 minutes.
4. Optimization/problem solving, approximately 20–30 minutes; constraints must make a naive approach fail.

ORIGINALITY
- Generate original concepts. Do not reproduce proprietary or known CodeSignal questions.
- Avoid exact duplicates and close variations of the history below.

${this.avoidance.build(history)}`;
  }
}
