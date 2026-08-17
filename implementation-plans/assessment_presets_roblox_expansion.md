# Roblox Coding Assessment Preset Expansion

## Purpose

Expand the existing **GCA Practice Tool** so it supports a second practice mode modeled after the Roblox Software Engineering CodeSignal coding assessment.

Repository:

- https://github.com/nxtrio/GCA-Practice-tool

The application currently supports a CodeSignal General Coding Assessment (GCA)-style workflow with:

- 4 coding problems
- 70-minute shared timer
- Monaco-based coding workspace
- Java, C++, and Python execution
- Run and Submit flows
- visible and hidden tests
- assessment generation/import
- semantic and oracle validation
- persisted sessions and history
- results views

The goal of this change is to add a **Roblox Coding Assessment** preset without duplicating the assessment engine or breaking existing GCA functionality.

---

# 1. Required Agent Workflow

Before modifying code:

1. Read `AGENTS.md`.
2. Read `implementation-plans/gca_practice_codex_implementation_spec.md`.
3. Inspect the current repository implementation rather than assuming the original implementation plan exactly matches the current code.
4. Search the repository for hard-coded GCA assumptions, including at minimum:

```text
4200
70 minute
70-minute
four-question
four questions
Exactly four
problems.length !== 4
Q4
GCA Practice
default GCA
slots 1 through 4
```

5. Classify each relevant occurrence as either:
   - intentionally GCA-specific and should remain so, or
   - generic assessment logic that must become preset-aware.

Do not perform unrelated refactors.

---

# 2. Product Goal

The home page should support at least two assessment presets:

## General Coding Assessment

- 4 questions
- 70 minutes
- Existing GCA-style problem progression
- Existing behavior must remain supported

## Roblox Coding Assessment

- 2 questions
- 50 minutes
- Implementation-heavy practice
- Strong bias toward matrices, 2D arrays, grids, simulation, indexing, state handling, and optimization

The user should be able to:

```text
Launch app
→ choose Roblox Coding Assessment
→ copy a Roblox-specific generation prompt
→ generate an assessment using an external LLM
→ paste/import the JSON
→ validate it
→ start the assessment
→ solve Q1 and Q2 under a 50-minute timer
→ Run / Submit
→ finish
→ view results/history
```

The Roblox mode must reuse the same execution, validation, persistence, workspace, and results infrastructure as the GCA mode.

---

# 3. Research Basis and Modeling Assumptions

Current and recent candidate reports consistently describe the Roblox coding assessment as:

- 2 coding questions
- 50 minutes total
- frequently implementation-heavy
- frequently involving matrices, grids, or 2D arrays
- often requiring careful simulation, indexing, and edge-case handling
- sometimes pairing a direct implementation approach with a second problem that requires optimization

However, Roblox does not publicly guarantee an exact topic distribution.

Therefore:

- Treat **2 questions / 50 minutes** as the Roblox preset format.
- Treat matrix/grid/implementation emphasis as a **strong practice bias**, not as an official guarantee.
- Do not force both questions to be matrix problems in every generated assessment.
- Do not reproduce or reconstruct reported Roblox interview questions.

---

# 4. Architecture Requirement: Assessment Presets

Do **not** create parallel Roblox-specific versions of the core application.

Do not create components such as:

```text
RobloxAssessmentPage
RobloxRunner
RobloxSession
RobloxSubmissionService
RobloxValidator
```

unless an existing architectural boundary genuinely requires it.

Instead, introduce a centralized assessment preset abstraction.

A reasonable shape is:

```ts
export type AssessmentPresetId = "gca" | "roblox";

export interface AssessmentPreset {
  id: AssessmentPresetId;
  displayName: string;
  shortName: string;
  problemCount: number;
  durationSeconds: number;
}

export const ASSESSMENT_PRESETS = {
  gca: {
    id: "gca",
    displayName: "General Coding Assessment",
    shortName: "GCA",
    problemCount: 4,
    durationSeconds: 4200,
  },

  roblox: {
    id: "roblox",
    displayName: "Roblox Coding Assessment",
    shortName: "Roblox",
    problemCount: 2,
    durationSeconds: 3000,
  },
} satisfies Record<AssessmentPresetId, AssessmentPreset>;
```

The exact file/location may differ based on the repository architecture.

The important requirement is that:

- `4`
- `4200`
- `2`
- `3000`

must not be independently hard-coded throughout generic assessment logic.

There should be one authoritative source for preset structure.

---

# 5. Assessment Contract Changes

Extend the assessment definition so newly generated assessments can explicitly identify their preset.

Preferred shape:

```ts
preset?: "gca" | "roblox";
```

The field should be optional to preserve backward compatibility.

## Backward Compatibility

Existing imported assessments that:

- have no explicit preset,
- contain 4 problems,
- and use `durationSeconds = 4200`

must continue to work as legacy GCA assessments.

Newly generated assessments should explicitly contain:

```json
"preset": "gca"
```

or:

```json
"preset": "roblox"
```

Do not bump the schema version unless there is a strong technical reason to do so.

Prefer backward-compatible evolution of schema version `1.0`.

---

# 6. Preset Resolution

Create a clear mechanism that resolves an assessment to a preset.

Conceptually:

```ts
function resolveAssessmentPreset(
  assessment: AssessmentDefinition
): AssessmentPreset
```

Expected behavior:

1. If `assessment.preset` is present:
   - resolve that preset directly.
2. Otherwise, if the assessment is the legacy combination:
   - 4 problems
   - 4200 seconds
   - treat it as GCA.
3. Invalid or unsupported combinations should fail validation rather than silently guessing.

Do not infer Roblox only from having 2 problems unless that behavior is deliberately documented and tested.

---

# 7. Semantic Validation Refactor

The current validator contains GCA-specific assumptions.

Replace generic hard-coded validation such as:

```ts
assessment.problems.length !== 4
```

and:

```ts
assessment.durationSeconds !== 4200
```

with preset-aware validation.

Conceptually:

```ts
const preset = resolveAssessmentPreset(assessment);

if (assessment.problems.length !== preset.problemCount) {
  // validation failure
}

if (assessment.durationSeconds !== preset.durationSeconds) {
  // validation failure
}
```

Validation messages should identify the active preset.

Examples:

```text
Roblox Coding Assessment requires exactly 2 problems; received 4.
```

```text
Roblox Coding Assessment must last exactly 3000 seconds (50 minutes).
```

```text
General Coding Assessment requires exactly 4 problems.
```

## Do Not Weaken Existing Validation

Preserve all existing protections and checks, including:

- JSON schema validation
- TypeSpec validation
- function signature validation
- unique problem IDs
- unique test IDs
- visible tests
- hidden tests
- Python reference solution requirements
- reference-solution execution
- oracle validation of every testcase
- expected-output verification
- hidden-test input/output protection
- any execution limits already enforced

Only the assessment format constraints should become preset-aware.

---

# 8. Prompt Architecture

The Roblox generation prompt must **not** simply be the GCA prompt with:

```text
4 → 2
70 → 50
```

The difficulty distribution and problem style are different enough to warrant a distinct generation profile.

Prefer a structure such as:

```text
apps/web/src/generation/
  prompts/
    shared-generation-rules.txt
    gca-generation-profile.txt
    roblox-generation-profile.txt
```

or, if a smaller change better fits the current architecture:

```text
assessment-generation-prompt.txt
roblox-assessment-generation-prompt.txt
```

The generation code should become preset-aware.

Conceptually:

```ts
new GenerationPromptBuilder("gca")
new GenerationPromptBuilder("roblox")
```

Reuse the existing history/avoidance mechanism.

Do not duplicate common validation/output-contract instructions if they can be safely shared.

---

# 9. Roblox Generation Output Contract

The Roblox generation prompt must require:

```text
schemaVersion: "1.0"
preset: "roblox"
durationSeconds: 3000
exactly 2 problems
slots exactly 1 and 2
```

Retain the same existing supported TypeSpec grammar.

Every problem must remain a single-function problem.

Every signature name must remain:

```text
solution
```

Each problem must include all fields required by the existing assessment schema, including:

- id
- slot
- title
- generationMetadata
- description
- constraints
- signature
- examples
- limits
- tests
- validation

Each problem must include:

- meaningful visible tests
- meaningful hidden tests
- edge cases
- stress cases where appropriate

Validation must continue to use:

```text
validation.referenceLanguage = "python"
```

Each problem must provide a valid Python `referenceSolution` defining:

```python
solution(...)
```

All test arguments must conform to the declared signature.

All expected outputs must conform to the return TypeSpec.

---

# 10. Roblox Assessment Design Philosophy

The two problems should be generated as **one coherent 50-minute assessment**.

Do not independently generate two arbitrary LeetCode problems.

The shared clock matters.

The target should be:

```text
Q1: approximately 15–20 minutes
Q2: approximately 25–30 minutes
```

with a small amount of remaining time for debugging and submission.

The generator should favor implementation accuracy and practical reasoning rather than obscure competitive-programming tricks.

---

# 11. Roblox Topic Bias

Strongly favor the following skill families:

- implementation-heavy programming
- matrices
- 2D arrays
- grid traversal
- grid transformations
- coordinate/index manipulation
- row/column/diagonal reasoning
- simulation
- state updates
- boundary handling
- careful mutation or copied state
- arrays
- strings
- maps / hash maps
- sets
- frequency tables
- prefix information
- prefix sums
- 2D prefix sums when natural
- precomputation
- incremental computation
- sorting
- repeated-query optimization
- reducing repeated scans
- careful complexity reasoning

These should be treated as **practice biases**, not hard guarantees.

Do not force every assessment to contain the same techniques.

Variation is desirable.

---

# 12. Roblox Question 1 Profile

## Target Solve Time

Approximately:

```text
15–20 minutes
```

## Difficulty

Approximately medium under the shared 50-minute clock.

Q1 should be materially more substantial than the easiest GCA slot.

## Strongly Favor

- 2D arrays
- matrices
- grids
- simulation
- transformations
- indexing
- coordinates
- state changes
- arrays
- strings
- counting/aggregation
- multiple interacting implementation rules

## Desired Difficulty Source

Difficulty should usually come from:

```text
understanding the rules
→ selecting a clean representation
→ implementing multiple conditions correctly
→ handling boundaries/indexing
→ avoiding state-management mistakes
→ handling edge cases
```

The problem should not require an obscure algorithm just to make it difficult.

---

# 13. Roblox Question 2 Profile

## Target Solve Time

Approximately:

```text
25–30 minutes
```

## Difficulty

Medium-hard under the shared 50-minute clock.

## Desired Shape

Strongly favor problems where:

```text
a straightforward solution is easy to identify
→ the direct approach is too slow or does unnecessary repeated work
→ the candidate notices exploitable structure
→ the candidate implements an optimized solution
```

Useful optimization families may include:

- prefix sums
- 2D prefix sums
- precomputation
- hashing
- frequency tables
- incremental updates
- sorting
- sliding windows
- cached derived state
- row/column preprocessing
- avoiding repeated matrix scans
- coordinate transformations

## Avoid Artificial Difficulty

Do not require niche algorithms merely to make Q2 hard.

Avoid unnecessary dependence on:

- segment trees
- suffix arrays
- obscure graph theory
- advanced dynamic programming
- specialized computational geometry
- uncommon competitive-programming techniques

unless such a technique genuinely emerges naturally from the problem.

---

# 14. Originality and Assessment Integrity

The generator must create **original practice problems**.

Add explicit prompt instructions similar to:

```text
ORIGINALITY REQUIREMENT

Generate original practice problems inspired only by the
general skills and structural characteristics associated
with Roblox-style coding assessments.

Do NOT reproduce, paraphrase, mutate, or reconstruct:
- reported Roblox OA questions;
- leaked assessment questions;
- proprietary CodeSignal questions;
- examples copied from interview-experience posts.

If you recognize a known Roblox assessment question,
generate a materially different problem instead.

Topic similarity is allowed.
Problem replication is not.
```

Candidate reports may be used to identify broad skills worth practicing.

They must not be used as a source for reconstructing proprietary questions.

---

# 15. Home Page Changes

Replace the current GCA-only entry experience with a preset choice.

A reasonable UI:

```text
Coding Assessment Practice

Choose a practice format

┌─────────────────────────────┐
│ General Coding Assessment   │
│ 4 Questions · 70 Minutes    │
│                             │
│ [ Practice GCA ]            │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Roblox Coding Assessment    │
│ 2 Questions · 50 Minutes    │
│ Implementation / Matrices   │
│                             │
│ [ Practice Roblox ]         │
└─────────────────────────────┘
```

Do not copy proprietary Roblox or CodeSignal visual assets.

Text branding is sufficient.

Possible routing strategies:

```text
/import?preset=gca
/import?preset=roblox
```

or an equivalent architecture that avoids duplicate pages.

Prefer the smallest clean change consistent with the existing router.

---

# 16. Import / Generation Page

Make the existing assessment import page preset-aware.

The selected preset should determine:

- title
- subtitle
- expected problem count
- expected duration
- generation prompt
- button labels where appropriate

Examples:

## GCA

```text
New GCA Practice Assessment
4 questions · 70 minutes
```

## Roblox

```text
New Roblox Coding Practice
2 questions · 50 minutes
```

The existing workflow should remain:

```text
Choose preset
→ Copy Generation Prompt
→ use external LLM
→ paste JSON
→ validate
→ oracle-check
→ start assessment
```

Do not create a second importer.

---

# 17. GenerationPromptBuilder

Refactor the existing prompt builder so the caller identifies the selected preset.

Conceptually:

```ts
new GenerationPromptBuilder("gca")
new GenerationPromptBuilder("roblox")
```

or:

```ts
buildGenerationPrompt({
  preset,
  history,
})
```

Preserve the existing history-manifest injection mechanism.

Make sure:

- GCA receives the existing GCA prompt behavior.
- Roblox receives the new Roblox profile.
- Roblox generation never accidentally inherits GCA requirements such as:
  - exactly four questions
  - slots 1–4
  - 4200 seconds
  - 70-minute duration

---

# 18. Assessment Workspace

The assessment workspace should remain generic.

For Roblox:

- show exactly Q1 and Q2
- show the 50-minute timer
- preserve Run
- preserve Submit
- preserve question switching
- preserve code autosave
- preserve finish-assessment behavior
- preserve hidden-test protection

If the workspace currently maps over:

```ts
assessment.problems
```

retain that dynamic behavior.

Do not add hard-coded two-question UI if it is not needed.

---

# 19. Dynamic Branding

Remove generic hard-coded labels that incorrectly identify all sessions as GCA.

For example, if the workspace currently contains:

```text
GCA Practice
```

make it preset-aware.

Examples:

```text
GCA Practice
```

and:

```text
Roblox Practice
```

or use a generic product title plus preset-specific subtitle.

Do not rename historical GCA sessions incorrectly.

---

# 20. History and Results

Roblox sessions must be identifiable in:

- history
- result summaries
- resumed sessions
- any stored session metadata presented to the user

A simple history presentation might be:

```text
Roblox Practice
2 / 2 solved
47:18 used

GCA Practice
3 / 4 solved
70:00 used
```

Do not build elaborate analytics as part of this task.

Preset filtering may be added if it is trivial, but it is not required for initial completion.

---

# 21. Avoidance History

Reuse the existing duplicate-avoidance/history manifest.

Prefer storing or deriving preset information for generated assessments.

When generating a Roblox assessment, previous Roblox problems should be weighted most heavily for duplicate avoidance.

Do not make matrix/grid topics disappear simply because a previous GCA problem used a matrix.

Matrices are intentionally a high-frequency Roblox practice category.

A reasonable future shape is:

```ts
buildGenerationPrompt({
  preset,
  history,
})
```

where history can be filtered or prioritized by preset.

This is lower priority than core Roblox support and should not block the initial implementation.

---

# 22. Required Fixtures

Add at least one complete valid Roblox assessment fixture.

Suggested location:

```text
fixtures/assessments/valid-roblox.json
```

or the repository's equivalent fixture directory.

The fixture must:

- identify preset `roblox`
- contain exactly 2 problems
- use `durationSeconds = 3000`
- contain valid visible tests
- contain valid hidden tests
- include Python reference solutions
- pass oracle validation
- be suitable for E2E tests

Prefer original, simple fixture problems rather than copied assessment questions.

---

# 23. Unit and Integration Tests

Add coverage for at least the following.

## Legacy GCA

```text
no explicit preset
4 problems
4200 seconds
→ valid as legacy GCA
```

## Explicit GCA

```text
preset = gca
4 problems
4200 seconds
→ valid
```

## Valid Roblox

```text
preset = roblox
2 problems
3000 seconds
→ valid
```

## Roblox Wrong Problem Count

```text
preset = roblox
4 problems
3000 seconds
→ invalid
```

## Roblox Wrong Duration

```text
preset = roblox
2 problems
4200 seconds
→ invalid
```

## GCA Regression

Existing GCA invalid cases must remain invalid.

No previously valid GCA behavior should regress.

---

# 24. Prompt Tests

Add tests that verify the generated Roblox prompt contains the Roblox contract.

At minimum assert that it requires:

```text
preset "roblox"
exactly 2 problems
3000 seconds
50 minutes
slots 1 and 2
```

Also verify that Roblox prompt content includes guidance relating to:

```text
implementation
matrix
2D array
simulation
optimization
```

Do not make brittle tests dependent on large exact prose blocks unless the existing project already uses that testing style.

Most importantly, assert that the Roblox prompt does **not** accidentally require:

```text
exactly four problems
slots 1 through 4
durationSeconds 4200
70-minute assessment
```

Add regression coverage ensuring GCA prompt behavior remains correct.

---

# 25. End-to-End Test

Add or update E2E coverage for the Roblox flow.

At minimum:

```text
Home
→ choose Roblox Coding Assessment
→ reach Roblox import/generation flow
→ import valid Roblox fixture
→ validation succeeds
→ start assessment
→ verify Q1 and Q2 exist
→ verify no Q3/Q4 navigation appears
→ verify 50-minute duration/session
→ switch between questions
→ Run
→ Submit
→ Finish
→ verify results contain 2 problems
→ verify session is labeled Roblox
```

Avoid assertions that depend on real-time second-perfect countdown values if that would make tests flaky.

Use appropriate tolerance.

---

# 26. Hard-Coded Assumption Audit

Before declaring the task complete, search the repository again for:

```text
4200
70 minute
70-minute
four-question
four questions
Exactly four
problems.length !== 4
Q4
GCA Practice
slots 1 through 4
```

For every remaining occurrence, confirm it is intentionally GCA-specific.

Generic assessment infrastructure must not rely on GCA-only assumptions.

---

# 27. Documentation Changes

Create this implementation plan in the repository as:

```text
implementation-plans/assessment_presets_roblox_expansion.md
```

Update `AGENTS.md` so that this expansion specification supersedes the original GCA-only assumptions wherever the two conflict.

Do not delete the original GCA implementation specification.

The original specification remains useful historical and architectural context.

Update the README so the project clearly advertises:

- GCA Practice
  - 4 questions
  - 70 minutes
- Roblox Coding Assessment Practice
  - 2 questions
  - 50 minutes
  - implementation/matrix-biased generation

Clarify that generated practice problems are original and are not copied Roblox or CodeSignal questions.

---

# 28. Priority Order

The immediate use case is preparation for an upcoming Roblox assessment.

Implement in this order.

## P0 — Must Work

1. Assessment preset model
2. Optional preset field in the assessment contract
3. Legacy GCA preset resolution
4. Preset-aware semantic validation
5. Roblox generation prompt
6. Preset-aware generation builder
7. Home-page GCA / Roblox selection
8. Preset-aware import/generation page
9. Dynamic session branding
10. Valid Roblox fixture
11. Unit/integration tests
12. Roblox E2E flow
13. Typecheck/build/test cleanup

## P1 — Useful

14. Roblox-specific history labeling
15. Same-preset-aware duplicate avoidance
16. README update
17. Minor UI polish

## P2 — Do Not Block Initial Delivery

18. Per-preset analytics
19. Custom difficulty controls
20. Generic arbitrary assessment-builder UI
21. Additional company presets
22. Advanced statistics/filtering

Do not over-generalize the system before the Roblox workflow works end-to-end.

Two fixed presets are sufficient for this task.

---

# 29. Non-Goals

Do not implement the following as part of this task unless required to fix an existing architectural issue:

- Roblox account integration
- CodeSignal integration
- scraping Roblox questions
- copying proprietary assessment questions
- anti-cheating functionality
- browser lockdown
- webcam/proctoring behavior
- arbitrary custom assessment-builder UI
- cloud synchronization
- user accounts
- major execution-engine refactors
- new programming languages
- unrelated styling redesigns
- elaborate analytics

---

# 30. Security and Integrity Requirements

Preserve the current security boundary.

Hidden testcase data must not become available to frontend code before submission.

Do not weaken server-side execution or validation boundaries.

Do not expose:

- hidden test inputs
- hidden expected outputs
- reference solutions

to the assessment-taking UI in a way that defeats practice realism.

Any new Roblox fixture or generated assessment must pass the same oracle-validation pipeline as GCA assessments.

---

# 31. Quality Requirements

Before completion, run the repository's required checks.

At minimum:

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
```

If the repository uses different or additional commands, inspect `package.json` / workspace configuration and run the correct equivalents.

Fix failures caused by this change.

Do not silence failures by weakening tests.

---

# 32. Acceptance Criteria

The task is complete only when all of the following are true.

## Presets

- [ ] GCA remains available.
- [ ] Roblox is available as a second preset.
- [ ] GCA uses 4 problems / 4200 seconds.
- [ ] Roblox uses 2 problems / 3000 seconds.
- [ ] Preset configuration is centralized.

## Compatibility

- [ ] Existing legacy GCA JSON without `preset` remains importable.
- [ ] Existing GCA tests continue to pass.
- [ ] Existing GCA sessions still behave correctly.

## Generation

- [ ] GCA copies the existing GCA-style prompt.
- [ ] Roblox copies a dedicated Roblox-style prompt.
- [ ] Roblox prompt requests exactly 2 questions.
- [ ] Roblox prompt requests exactly 3000 seconds.
- [ ] Roblox prompt strongly biases implementation / 2D array / matrix practice.
- [ ] Roblox prompt contains an explicit originality requirement.
- [ ] Roblox prompt does not accidentally contain GCA-only structural requirements.

## Validation

- [ ] Roblox 2-question / 3000-second assessments validate.
- [ ] Roblox wrong-count assessments fail.
- [ ] Roblox wrong-duration assessments fail.
- [ ] GCA validation remains intact.
- [ ] Oracle validation remains intact.

## UI

- [ ] Home page allows choosing GCA or Roblox.
- [ ] Roblox import page clearly identifies Roblox mode.
- [ ] Roblox assessment workspace shows Q1 and Q2 only.
- [ ] Roblox assessment uses a 50-minute timer.
- [ ] Roblox sessions are not labeled "GCA Practice".
- [ ] Results/history identify Roblox sessions correctly.

## Execution

- [ ] Run works.
- [ ] Submit works.
- [ ] hidden tests remain protected.
- [ ] autosave/resume still works.
- [ ] finish-assessment flow works.

## Automated Verification

- [ ] Typecheck passes.
- [ ] Unit/integration tests pass.
- [ ] Build passes.
- [ ] E2E tests pass.

---

# 33. Definition of Done

The final implementation should allow the following real user workflow without manual code changes:

```text
1. Start the application.

2. Choose:
   "Roblox Coding Assessment"

3. See:
   "2 Questions · 50 Minutes"

4. Click:
   "Copy Generation Prompt"

5. Paste that prompt into an external supported LLM.

6. Receive valid assessment JSON containing:
   - schemaVersion 1.0
   - preset roblox
   - durationSeconds 3000
   - exactly 2 problems

7. Paste that JSON into the existing importer.

8. Have the application:
   - schema-validate it
   - semantic-validate it
   - execute the Python reference solutions
   - verify all expected outputs

9. Start the assessment.

10. See exactly:
    Q1
    Q2

11. Receive a shared 50-minute countdown.

12. Solve using the existing Monaco editor and language runners.

13. Use Run and Submit exactly as in GCA practice.

14. Finish the assessment.

15. View a 2-question Roblox-labeled result.

16. See the session correctly represented in history.

17. Return to the home page and still be able to take the original GCA mode with no regression.
```

If this full workflow works and all required automated checks pass, the Roblox preset expansion is complete.

---

# 34. Implementation Guidance

Prefer small, composable changes over broad rewrites.

A good implementation should make the existing application more generic by extracting the few assumptions that are genuinely assessment-format-specific.

The ideal architectural result is:

```text
                 AssessmentPreset
                 /              \
              GCA              Roblox
               |                  |
               +--------+---------+
                        |
                  Shared System
                        |
        +---------------+----------------+
        |               |                |
     Import          Validation       Generation
        |               |                |
        +---------------+----------------+
                        |
                   Assessment
                    Workspace
                        |
              Run / Submit / Timer
                        |
                  Results / History
```

The Roblox mode is a new **configuration/profile**, not a new application.

That architectural principle should guide all implementation decisions.
