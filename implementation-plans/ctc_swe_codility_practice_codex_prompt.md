# CTC Software Engineering Assessment Preset — Codex Implementation Plan

**Repository:** `nxtrio/GCA-Practice-Tool`  
**Target feature:** Add a fourth assessment category for an unofficial Chicago Trading Company (CTC) Software Engineering Codility-style practice assessment.  
**Preset ID:** `ctc`  
**Recommended practice format:** 3 questions, 180 minutes  
**Status of format:** Unofficial practice calibration based on current public candidate reports and CTC's public recruiting materials as of August 21, 2026.

---

## 1. Goal

Extend the existing assessment-preset architecture with a new **CTC Software Engineering** category.

The implementation should feel native to the existing GCA Practice Tool:

- CTC appears alongside the existing GCA, Roblox, and IMC assessment choices.
- The existing assessment engine, editor, language runners, import flow, timer, test execution, persistence, results, history, and readiness-analysis workflow are reused.
- CTC gets its own preset metadata and its own LLM assessment-generation prompt.
- The prompt generates **three original Codility-style software-engineering problems** calibrated toward the implementation/logic-heavy, "Medium-ish" profile currently reported for CTC.
- Existing GCA, Roblox, and IMC behavior must not regress.

Do **not** build a separate CTC-specific execution engine or a clone of the Codility website.

---

## 2. Research-Based Practice Model

This preset is intentionally an **unofficial approximation**, not a claim about CTC's guaranteed assessment contents.

### Current evidence used for calibration

Public CTC recruiting material describes a coding challenge that tests programming ability, while the Summer 2027 Software Engineering role emphasizes:

- data structures,
- object-oriented programming,
- algorithms,
- applying programming fundamentals to real-world problems,
- Java, C++, and Python.

Recent Summer 2027 candidate reports describe a second-stage Codility coding assessment after the behavioral/cognitive assessment with approximately:

- **3 programming questions**
- **about 3 hours**
- problems commonly described as **Medium-ish**
- substantial **implementation, logic, state tracking, and edge-case work**
- enough time that the primary challenge is correctness and implementation discipline rather than extreme competitive-programming speed.

Some public reports from adjacent CTC SWE recruiting cycles also describe simulation/state-processing-style tasks. Those reports should influence only the **broad skill profile**. The generator must never reconstruct, paraphrase, or imitate any reported CTC question.

### Practice preset definition

Use:

```ts
id: "ctc"
displayName: "CTC Software Engineering Assessment"
shortName: "CTC"
practiceName: "CTC SWE Practice"
problemCount: 3
durationSeconds: 10800
```

UI copy can summarize the format as:

> **3 Questions · 180 Minutes**  
> Codility-style implementation, logic, and scalable problem solving

Avoid language implying that this format is guaranteed or official.

---

## 3. Architectural Principle

The current repository already has a preset architecture for:

- `gca`
- `roblox`
- `imc`

CTC should be the **fourth preset**.

Before changing code, inspect the current repository and search globally for:

```text
AssessmentPresetId
ASSESSMENT_PRESETS
isAssessmentPresetId
"gca"
"roblox"
"imc"
4200
3000
7200
problemCount
durationSeconds
GenerationPromptBuilder
preset ===
preset:
```

The implementation should extend centralized preset-driven behavior wherever possible.

### Do not

- create a second assessment schema,
- fork the runner,
- fork the editor,
- create CTC-only persistence models,
- duplicate the import flow,
- hard-code CTC count/duration checks in multiple places,
- change schema version solely for this preset,
- weaken hidden-test isolation,
- expose reference solutions to the candidate workspace,
- break legacy GCA assessments that omit `preset`.

---

## 4. Primary Files to Modify

At minimum, inspect and update the following current code paths.

### Preset contract

```text
packages/contracts/src/assessmentPresets.ts
```

Current preset ID union contains:

```ts
"gca" | "roblox" | "imc"
```

Add:

```ts
"ctc"
```

Add the CTC preset metadata to `ASSESSMENT_PRESETS`.

Update `isAssessmentPresetId(...)` so `"ctc"` resolves correctly.

Preserve the current legacy behavior in which an old assessment with no explicit preset resolves as GCA.

---

### JSON schema

```text
packages/assessment-schema/assessment.schema.json
```

Extend the preset enum from:

```json
["gca", "roblox", "imc"]
```

to:

```json
["gca", "roblox", "imc", "ctc"]
```

Do not introduce a new schema shape for CTC.

---

### Semantic validation

Inspect the existing semantic validator.

The current validator already derives:

- expected problem count,
- legal slots,
- exact duration,

from the resolved preset metadata.

Prefer letting the new centralized CTC preset automatically drive validation.

CTC requirements:

```text
preset = "ctc"
durationSeconds = 10800
exactly 3 problems
slots = 1, 2, 3
problem IDs = p1, p2, p3 in generated assessments
```

The semantic validator should reject:

- CTC with 2 problems,
- CTC with 4 problems,
- missing slot 1/2/3,
- duplicate slots,
- duration other than 10800,
- unsupported preset values.

Do not add duplicate `if (preset === "ctc")` validation if the generic preset mechanism already covers the rule.

---

### Generation prompt builder

```text
apps/web/src/generation/GenerationPromptBuilder.ts
```

The builder currently selects a preset-specific template for GCA, Roblox, and IMC.

Add a fourth template:

```text
apps/web/src/generation/ctc-assessment-generation-prompt.txt
```

Import it and map:

```ts
ctc: ctcGenerationPromptTemplate
```

The CTC prompt should use the same history/avoidance-manifest mechanism as the other presets.

Do not special-case history logic unless necessary.

---

### Fixtures

Add:

```text
fixtures/assessments/valid-ctc.json
```

It must be a fully valid CTC assessment with:

- `schemaVersion: "1.0"`
- `assessment.preset: "ctc"`
- `durationSeconds: 10800`
- exactly 3 valid problems
- slots 1–3
- IDs `p1`, `p2`, `p3`
- reference solutions
- meaningful visible and hidden tests.

Also add targeted invalid fixtures if the repository's current test structure uses fixture-based negative validation.

Recommended negative cases:

```text
invalid-ctc-wrong-duration.json
invalid-ctc-two-problems.json
invalid-ctc-four-problems.json
invalid-ctc-bad-slots.json
```

If tests construct invalid objects inline instead, follow the existing convention rather than adding unnecessary fixture files.

---

## 5. User-Facing Preset Integration

Inspect how the Home/import flow enumerates presets.

CTC must be visible as a distinct choice alongside:

```text
GCA
Roblox
IMC
CTC
```

Recommended card text:

### CTC Software Engineering

**3 Questions · 180 Minutes**

> Codility-style implementation, logic, state processing, and scalable problem solving.

A small disclaimer or existing global disclaimer should make clear this is unofficial practice.

### Required behavior after selection

Selecting CTC should:

1. set the active preset to `ctc`,
2. display the CTC-specific LLM generation prompt,
3. include CTC-only history exclusions in the generated prompt,
4. validate imported JSON against CTC's 3-question / 180-minute contract,
5. start the standard assessment workspace with three problems,
6. start a 180-minute timer,
7. persist the assessment as CTC,
8. label history/results/readiness exports as CTC,
9. allow retry/reopen flows to retain the CTC preset.

If the UI is already driven entirely from `ASSESSMENT_PRESETS`, preserve that architecture and add the smallest required metadata.

If cards or labels are manually enumerated, add CTC without reorganizing unrelated UI.

---

## 6. CTC Assessment Generation Philosophy

The generator is the most important part of this feature.

The preset should **not** become:

- three generic LeetCode questions,
- three trivial simulations,
- an IMC-style algorithms gauntlet,
- a quant/math test,
- a finance-knowledge test,
- a recreation of public CTC reports.

The desired feel is:

> Three substantial, self-contained software-engineering coding tasks where the intended algorithms are conventional, but careful interpretation, state management, implementation quality, complexity awareness, and edge-case handling matter.

### Skill bias

Strongly favor problems using combinations of:

- arrays,
- strings,
- hash maps,
- hash sets,
- counters/frequency state,
- stacks,
- queues/deques,
- sorting,
- parsing/tokenization,
- event/state processing,
- sequential simulation,
- prefix/running aggregates,
- two pointers,
- sliding windows,
- straightforward greedy reasoning,
- indexing and boundary management,
- practical transformations of structured data.

Occasionally acceptable when natural:

- BFS/DFS,
- binary search,
- heap/priority queue,
- interval processing,
- simple dynamic programming.

Do not make these advanced topics the default identity of the preset.

### Techniques that should rarely be necessary

Avoid making success depend on:

- segment trees,
- Fenwick trees,
- suffix arrays,
- suffix automata,
- advanced graph algorithms,
- max flow,
- computational geometry,
- obscure number theory,
- difficult combinatorial DP,
- highly specialized competitive-programming tricks.

A generated assessment can contain a stronger optimization problem, but it should still have a recognizable and implementable solution under ordinary SWE interview preparation.

---

## 7. Difficulty and Pacing

Model a 180-minute assessment, but target a prepared candidate to finish coding in substantially less than the full window and use the remaining time for testing.

Recommended generation targets:

### Q1 — Direct implementation

Target:

```text
25–35 minutes
Medium
```

Characteristics:

- understandable quickly,
- meaningful implementation,
- several edge cases,
- likely arrays/strings/maps/sorting/simple simulation,
- no obscure algorithmic insight,
- should reward clean decomposition.

---

### Q2 — Stateful specification problem

Target:

```text
35–45 minutes
Medium
```

Characteristics:

- more rules/state transitions than Q1,
- operation order matters,
- likely map/set/stack/queue/event-processing logic,
- careful bookkeeping,
- hidden tests expose ambiguous assumptions and boundary mistakes.

---

### Q3 — Performance-aware implementation

Target:

```text
45–60 minutes
Medium to upper-Medium
```

Characteristics:

- still implementation-centered,
- contains one important scalability observation,
- naive repeated scanning / obvious quadratic approach should fail the largest tests,
- intended improvement should use conventional tools such as hashing, prefix state, sorting, monotonic processing, a heap, or another standard technique,
- should not require a "Hard LeetCode" trick.

Across all three, a strong prepared candidate should plausibly complete the core solutions in roughly:

```text
105–140 minutes
```

leaving meaningful time for testing and debugging.

These times are generation calibration targets, not UI-enforced per-question limits.

---

## 8. Problem Diversity Requirements

Every generated assessment must have three meaningfully distinct mechanics.

Reject internally and regenerate if:

- all three are array scans,
- all three are matrix problems,
- all three are pure simulations,
- all three require the same central data structure,
- two problems are essentially reskins of one another,
- a problem is only a known LeetCode problem with renamed nouns.

A good set might have broad shapes such as:

```text
Q1: transform/aggregate structured records
Q2: process commands or evolving state
Q3: optimize repeated queries or sequence processing
```

Those are examples of diversity, not templates to reproduce every time.

Do not force finance/trading themes. Neutral software/data/system scenarios are preferable because CTC does not require prior finance knowledge for SWE applicants.

---

## 9. Codility-Style Testing Bias

The practice tool does not need to clone Codility scoring, but generated tasks should encourage the same discipline:

- examples are insufficient proof of correctness,
- hidden tests matter,
- complexity matters on at least one task,
- candidate code should handle boundary conditions precisely.

### Visible tests

Per problem:

```text
2–4 visible tests
```

Visible tests should be explanatory rather than exhaustive.

Include at least:

- one ordinary representative case,
- one case that clarifies a non-obvious rule or edge condition.

---

### Hidden tests

Per problem, target approximately:

```text
12–18 hidden tests
```

Hidden tests should collectively cover applicable categories such as:

- minimum input size,
- maximum logical input size,
- single element,
- empty collection if permitted,
- duplicates,
- all values equal,
- all values distinct,
- already-ordered data,
- reverse/adversarial ordering,
- zero values,
- negative values if allowed,
- tie handling,
- repeated operations,
- state reset/re-entry behavior,
- first/last index,
- off-by-one transitions,
- integer overflow boundaries where relevant,
- performance stress,
- pathological but valid input.

Do not include invalid inputs unless the problem explicitly asks the candidate to handle them.

---

## 10. Complexity Calibration

Every problem statement must contain enough constraints to infer an acceptable complexity.

Requirements:

- Constraints must be meaningful, not decorative.
- The reference solution must comfortably fit the stated limits.
- At least one problem should punish a naive high-complexity implementation on hidden tests.
- Q1 does not need an optimization trick.
- Avoid "gotcha" constraints where only an obscure data structure can pass.
- Prefer familiar target complexities such as:

```text
O(n)
O(n log n)
O(n + m)
O((n + q) log n)
```

depending on the problem.

Where Java integer overflow is possible, make required numeric ranges explicit and use the `long` TypeSpec when appropriate.

---

## 11. Exact CTC Generation Prompt

Codex should create:

```text
apps/web/src/generation/ctc-assessment-generation-prompt.txt
```

using the following prompt as the canonical starting point.

Preserve the repository's existing history-manifest placeholder syntax exactly; if the existing prompt builder uses a different literal token than shown below, adapt only that token.

---

### BEGIN CTC GENERATION PROMPT

```text
Create one original, internally consistent practice assessment modeled on the broad skill profile and pacing currently associated with a Chicago Trading Company (CTC) software-engineering Codility assessment.

This is an unofficial practice exercise. It is not affiliated with, endorsed by, or guaranteed to match Chicago Trading Company or Codility. Public candidate reports may inform only the broad format and skill profile. Do not reproduce, reconstruct, paraphrase, or closely imitate any real, leaked, proprietary, previously used, or candidate-reported CTC or Codility problem.

## OUTPUT CONTRACT

Return valid JSON only.

Do not use Markdown, commentary, explanations, or code fences outside the JSON document.

The document must contain:

- "schemaVersion": "1.0"
- "preset": "ctc" inside the assessment object
- "durationSeconds": 10800
- exactly three single-function problems
- slots exactly 1, 2, and 3
- problem IDs exactly "p1", "p2", and "p3"
- every function named "solution"

Design the three problems as one coherent 180-minute software-engineering coding assessment.

The assessment should feel implementation-heavy and logic-heavy rather than like a competitive-programming contest.

Target a prepared candidate to need approximately:

- Q1: 25–35 minutes
- Q2: 35–45 minutes
- Q3: 45–60 minutes

The candidate should have meaningful time remaining for testing and debugging.

Do not force a strict difficulty staircase if that would make a problem unnatural, but the overall set should roughly progress from direct implementation toward more specification-heavy and performance-aware work.

Keep the UTF-8 JSON comfortably below the repository's assessment import size limit.

Do not add properties outside the supported assessment schema.

## REQUIRED JSON SHAPE

Use the exact assessment shape supported by the repository.

At minimum, produce:

{
  "schemaVersion": "1.0",
  "assessment": {
    "preset": "ctc",
    "title": "...",
    "durationSeconds": 10800,
    "problems": [
      {
        "id": "p1",
        "slot": 1,
        "title": "...",
        "generationMetadata": {
          ...
        },
        "description": "...",
        "constraints": [
          "..."
        ],
        "signature": {
          "name": "solution",
          "params": [
            {
              "name": "...",
              "type": ...
            }
          ],
          "returnType": ...
        },
        "examples": [
          ...
        ],
        "limits": {
          ...
        },
        "tests": {
          "visible": [
            ...
          ],
          "hidden": [
            ...
          ]
        },
        "validation": {
          "referenceLanguage": "python",
          "referenceSolution": "..."
        }
      },
      {
        "id": "p2",
        "slot": 2,
        ...
      },
      {
        "id": "p3",
        "slot": 3,
        ...
      }
    ]
  }
}

Follow the current repository schema exactly for all nested fields. Do not invent additional metadata fields that the schema does not allow.

## SUPPORTED TYPES

Use only the TypeSpec forms already supported by the practice tool:

- {"kind":"int"}
- {"kind":"long"}
- {"kind":"boolean"}
- {"kind":"string"}
- {"kind":"array","items":TypeSpec}

Arrays may recursively contain another supported TypeSpec.

Do not use:

- objects,
- maps as parameter types,
- tuples,
- floating-point types,
- nullable types,
- custom classes,
- trees or linked-list node objects.

Represent structured input using parallel arrays, arrays of strings, nested arrays, or other supported shapes when necessary.

Every test argument list must exactly match the function signature.

Every expected result must exactly match the declared return TypeSpec.

## TARGET CTC SWE STYLE

Generate three substantial software-engineering coding tasks.

The core challenge should usually come from:

- understanding a precise specification,
- translating rules into reliable code,
- maintaining state correctly,
- choosing ordinary data structures well,
- handling operation ordering,
- avoiding indexing and boundary mistakes,
- recognizing a reasonable scalability requirement,
- testing edge cases.

Strongly favor combinations of:

- arrays,
- strings,
- hash maps,
- hash sets,
- counters and frequency state,
- sorting,
- stacks,
- queues or deques,
- parsing and tokenization,
- state machines,
- sequential simulation,
- event processing,
- prefix or running aggregates,
- two pointers,
- sliding windows,
- straightforward greedy reasoning,
- practical indexing and interval logic.

Occasionally use a standard technique such as:

- BFS or DFS,
- binary search,
- a heap / priority queue,
- interval processing,
- simple dynamic programming,

when it naturally fits the problem.

Do not make the assessment depend on advanced or obscure competitive-programming techniques such as:

- segment trees,
- Fenwick trees,
- suffix arrays,
- suffix automata,
- advanced graph algorithms,
- max flow,
- computational geometry,
- difficult combinatorial dynamic programming,
- obscure number theory,
- specialized contest tricks.

Do not test finance knowledge, trading knowledge, probability puzzles, market microstructure, mental math, or brainteasers.

A neutral software, systems, operations, records, scheduling, text-processing, or data-processing scenario is appropriate.

## QUESTION 1 PROFILE

Q1 should be a direct but non-trivial implementation problem.

Target:

- Medium difficulty
- approximately 25–35 minutes

Good characteristics:

- understandable within a few minutes,
- clean single-function interface,
- requires multiple implementation steps,
- rewards correct use of arrays, strings, maps, sets, sorting, counters, or a straightforward simulation,
- contains several meaningful edge cases,
- does not require an obscure algorithmic insight.

Q1 must not be trivial boilerplate or a five-minute warm-up.

## QUESTION 2 PROFILE

Q2 should emphasize stateful logic or specification fidelity.

Target:

- Medium difficulty
- approximately 35–45 minutes

Good characteristics:

- evolving state,
- commands, records, events, or transformations,
- operation ordering matters,
- careful bookkeeping is necessary,
- likely use of maps, sets, stacks, queues, counters, parsing, or related ordinary structures,
- hidden tests should expose incorrect assumptions.

The problem should be conceptually understandable but implementation-dense enough to require disciplined coding.

## QUESTION 3 PROFILE

Q3 should be performance-aware while remaining implementation-centered.

Target:

- Medium to upper-Medium difficulty
- approximately 45–60 minutes

Requirements:

- include one meaningful scalability observation,
- an obvious repeated-scan or naive quadratic approach should fail the largest intended tests,
- the intended solution should use a conventional technique,
- the optimization should be derivable from the constraints,
- the final implementation should still be reasonable in an interview/OA setting.

Suitable central techniques can include:

- hashing,
- prefix state,
- sorting plus scanning,
- a heap,
- two pointers,
- sliding window,
- monotonic processing,
- interval processing,
- binary search,
- another standard O(n) or O(n log n) approach.

Do not turn Q3 into a Hard-LeetCode-style trick problem.

## PROBLEM DIVERSITY

The three problems must have meaningfully different mechanics.

Do not generate:

- three array scans,
- three matrix/grid problems,
- three command simulators,
- three problems using the same central data structure,
- two reskins of the same algorithm,
- obvious renamed copies of well-known LeetCode questions.

Internally compare the three problem concepts before emitting JSON.

If two are substantially similar, replace one.

## ORIGINALITY

Every problem must be newly invented for this assessment.

Do not reproduce or closely paraphrase:

- any real CTC assessment question,
- any candidate-reported CTC question,
- any Codility task,
- any LeetCode problem,
- any HackerRank problem,
- any problem from the supplied assessment history,
- any previously generated problem whose mechanics are substantially similar.

Changing names, story nouns, variable names, or constants is not enough to make a known problem original.

The underlying state transition, optimization insight, objective, and required output must be meaningfully original.

## HISTORY EXCLUSION

Use the following prior-assessment manifest to avoid repeats:

{{HISTORY_MANIFEST}}

Treat same-preset CTC history as the strongest exclusion signal.

Also avoid obvious mechanical overlap with prior assessments from other presets when visible in the manifest.

Do not mention the history manifest in the generated assessment.

## DESCRIPTION QUALITY

Each description must:

- state the task completely,
- define all terminology before use,
- specify indexing conventions,
- specify ordering rules,
- specify tie-breaking rules,
- specify what happens at boundaries,
- distinguish inclusive and exclusive ranges,
- make valid-input guarantees explicit,
- contain enough information to solve the problem without guessing.

Avoid intentionally misleading wording.

Difficulty should come from implementation and reasoning, not ambiguity.

## CONSTRAINTS

Give explicit numeric constraints for every parameter and nested collection where relevant.

Constraints must be internally consistent with:

- the reference solution,
- the intended time complexity,
- the generated tests,
- Java/C++/Python execution.

At least one problem, preferably Q3, should have constraints large enough that a clearly naive implementation fails performance-oriented hidden tests.

Do not require an obscure data structure merely to satisfy the limits.

## EXAMPLES

Provide 2–4 meaningful examples per problem using the schema's supported example representation.

Examples should:

- be small enough to understand,
- demonstrate normal behavior,
- clarify at least one important edge or rule,
- have correct outputs.

Do not make examples the only cases that the reference solution handles correctly.

## TESTS

Generate meaningful visible and hidden tests for every problem.

### Visible tests

Provide 2–4 visible tests per problem.

Visible tests should be useful for understanding and basic debugging.

### Hidden tests

Target approximately 12–18 hidden tests per problem while keeping the complete JSON reasonably sized.

Use hidden tests to cover applicable cases such as:

- minimum sizes,
- single-element inputs,
- empty collections when permitted,
- duplicates,
- all values equal,
- all values distinct,
- ties,
- first/last positions,
- repeated operations,
- state transitions,
- unusual but valid ordering,
- zero,
- negative values when permitted,
- large values,
- integer boundaries,
- off-by-one cases,
- adversarial ordering,
- performance-stress cases.

Do not add invalid inputs unless the problem explicitly requires validation of invalid input.

Do not label tests with hints that reveal the solution.

## REFERENCE SOLUTIONS

For every problem:

- validation.referenceLanguage must be "python"
- validation.referenceSolution must define solution(...)
- the reference implementation must be deterministic
- it must obey the declared signature
- it must handle all stated constraints
- it must return the declared TypeSpec
- it must be efficient enough for the stated limits
- it must not read stdin
- it must not print output
- it must not access the network or filesystem
- it must not use randomness
- it must not depend on third-party libraries

Use only ordinary Python standard-language features compatible with the practice tool's validation environment.

The reference solution is validation infrastructure, not candidate-facing explanation.

## PERFORMANCE AND NUMERIC SAFETY

Choose input sizes that meaningfully distinguish intended solutions from clearly naive ones where appropriate.

Ensure:

- no reference solution times out under reasonable local execution,
- no generated hidden test is absurdly huge,
- recursive Python solutions do not rely on unsafe recursion depth unless limits guarantee safety,
- integer ranges are compatible with Java/C++ expectations,
- use the long TypeSpec when an int result could overflow 32-bit signed range.

## INTERNAL VALIDATION BEFORE OUTPUT

Before returning the JSON, silently verify all of the following:

1. The JSON parses.
2. schemaVersion is exactly "1.0".
3. assessment.preset is exactly "ctc".
4. durationSeconds is exactly 10800.
5. There are exactly 3 problems.
6. Problem IDs are exactly p1, p2, p3.
7. Slots are exactly 1, 2, 3.
8. Every function is named solution.
9. Every TypeSpec is supported.
10. Every test argument matches the signature.
11. Every expected output matches the return type.
12. Every reference solution defines solution(...).
13. Every visible and hidden expected answer agrees with the reference solution.
14. Each problem is internally consistent.
15. Constraints agree with every generated test.
16. The three problems are mechanically distinct.
17. No problem closely matches supplied history.
18. No problem reconstructs a real or reported CTC/Codility question.
19. At least one problem meaningfully tests scalability.
20. The total assessment matches an implementation-heavy, Medium-ish SWE Codility profile.

If any check fails, fix the assessment before emitting the JSON.

Return JSON only.
```

### END CTC GENERATION PROMPT

---

## 12. Prompt-Builder Tests

Add tests that construct a CTC `GenerationPromptBuilder` and confirm that its output contains at least:

```text
"preset": "ctc"
durationSeconds = 10800 or equivalent JSON instruction
exactly three problems
p1 / p2 / p3
slots 1 / 2 / 3
implementation-heavy
logic-heavy
originality prohibition
history manifest insertion
```

Also verify the CTC generated prompt does **not** accidentally contain preset contracts from another category, such as:

```text
4200
3000
7200
exactly two problems
exactly four problems
"preset": "gca"
"preset": "roblox"
"preset": "imc"
```

Be careful: some numbers may legitimately occur inside prose or history. Prefer testing decisive contract phrases rather than fragile global string absence if current test conventions offer a better approach.

---

## 13. Avoidance History

The existing history system appears to track the assessment preset and can distinguish same-preset from other-preset history.

CTC should participate automatically.

Required behavior:

- a prior CTC assessment should be included in the strong same-preset avoidance context,
- prior GCA/Roblox/IMC assessments may remain available as weaker cross-preset originality context if that is current behavior,
- creating a CTC preset must not pollute another preset's strict history rules.

Add a focused test proving that CTC history is handled as same-preset history.

Do not create a separate CTC history database.

---

## 14. Assessment Workspace Behavior

The standard workspace should work unchanged.

For a valid imported CTC assessment, verify:

- exactly three problem tabs/navigation items,
- slots display correctly,
- timer starts at `03:00:00`,
- Java is available,
- C++ is available,
- Python is available,
- Run works,
- Submit works,
- visible tests behave normally,
- hidden tests remain hidden,
- completion/results work,
- resume/reload preserves remaining state under current persistence semantics.

Do not expose the Python reference solution in the candidate UI.

### Custom tests

Do not build a special CTC-only custom-test subsystem.

If the repository already has a generic function-based custom-input component that can safely be reused with minimal configuration, CTC may use it. Otherwise, leave custom-input behavior unchanged for this implementation.

The required feature is the **assessment preset and generation profile**, not a Codility UI clone.

---

## 15. Results and Readiness Analysis

Inspect current results/readiness export code for assumptions about only three presets.

CTC results should clearly identify:

```text
preset: ctc
```

and show the user-facing CTC practice name wherever other presets are labeled.

If readiness-analysis JSON contains a preset/category field, ensure CTC round-trips correctly.

Do not invent CTC-specific scoring unless the app already supports configurable scoring by preset.

The practice tool's existing pass/fail/test-based evaluation can remain the source of truth.

---

## 16. Persistence and Backward Compatibility

Verify all persistence code can serialize/deserialize `"ctc"` through the shared `AssessmentPresetId`.

Required:

- saved CTC sessions reload as CTC,
- history entries retain CTC,
- retry/reopen retains CTC,
- old GCA documents with no `preset` continue resolving as GCA,
- GCA/Roblox/IMC persisted data remains valid.

No data migration should be needed unless the current storage layer has a hard-coded enum outside the shared contracts.

Search before assuming.

---

## 17. Documentation Updates

Update:

```text
README.md
```

Replace wording such as:

> three supported formats

with:

> four supported formats

Add a concise CTC entry, for example:

```text
CTC Software Engineering practice
- 3 questions
- 180 minutes
- Codility-style implementation and logic bias
- unofficial practice profile based on public recruiting information and candidate reports
```

The README disclaimer should make clear that:

- CTC and Codility are third-party names,
- the project is not affiliated with or endorsed by them,
- generated problems are original practice content,
- format/difficulty are approximations and may change.

Do not claim CTC guarantees three questions or 180 minutes.

---

## 18. AGENTS.md Update

After implementation, update `AGENTS.md` to point future coding agents to this CTC expansion spec.

Recommended wording:

```text
For the CTC assessment preset, also read:
implementation-plans/ctc_swe_codility_practice_codex_prompt.md

Treat it as the authoritative CTC-specific expansion spec.
Shared architecture and validation rules from the foundational preset documents still apply.
```

Do not replace the existing foundational GCA/Roblox/IMC guidance.

---

## 19. Tests to Add

Follow current repository conventions rather than creating a parallel test hierarchy.

At minimum add coverage for the following.

### Contracts

- `"ctc"` satisfies `AssessmentPresetId`.
- `isAssessmentPresetId("ctc") === true`.
- CTC metadata:
  - 3 problems,
  - 10800 seconds,
  - correct names.

### JSON schema

- valid CTC JSON passes schema validation.
- unsupported preset still fails.

### Semantic validator

Valid:

```text
ctc + 3 problems + slots 1,2,3 + duration 10800
```

Invalid:

```text
ctc + 2 problems
ctc + 4 problems
ctc + wrong duration
ctc + missing/duplicate/bad slot
```

### Prompt generation

- selects CTC template,
- injects history manifest,
- includes CTC contract,
- does not substitute another preset template.

### History

- CTC prior assessment is treated as same-preset history.

### UI

- CTC appears on preset selection screen.
- selecting CTC shows CTC generation instructions.
- importing a valid CTC fixture succeeds.
- validation summary reflects 3 problems / 180 minutes if those values are displayed.
- assessment workspace renders Q1–Q3.
- CTC appears correctly in results/history.

### Regression

Existing tests for:

```text
gca
roblox
imc
legacy preset-less GCA
```

must remain green.

---

## 20. End-to-End Acceptance Test

Add or extend an e2e path that performs roughly:

1. Open the application.
2. Select **CTC Software Engineering**.
3. Confirm the generation prompt is CTC-specific.
4. Import `valid-ctc.json`.
5. Confirm validation succeeds.
6. Start assessment.
7. Confirm three problem navigation entries.
8. Confirm the timer corresponds to 180 minutes.
9. Execute at least one visible test in a supported language.
10. Navigate across all three problems.
11. Submit/finish under the normal app flow.
12. Confirm results identify the CTC preset.
13. Open history and confirm the completed assessment is labeled CTC.

If the existing e2e suite avoids long timer/state flows, match its style and keep the test deterministic.

---

## 21. Commands to Run Before Completion

Use the repository's current package-manager scripts as defined in `package.json`.

At minimum run the equivalent of:

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
```

If script names differ, use the actual current scripts.

Also manually smoke-test:

```text
GCA import/start
Roblox import/start
IMC import/start
CTC import/start
legacy GCA without preset
```

Do not declare completion while known regressions remain.

---

## 22. Suggested Implementation Order

### Phase 1 — Inspect

Read:

```text
AGENTS.md
implementation-plans/gca_practice_codex_implementation_spec.md
implementation-plans/assessment_presets_roblox_expansion.md
implementation-plans/imc_swe_hackerrank_practice_codex_prompt.md
```

Then inspect current code rather than assuming those documents perfectly match HEAD.

---

### Phase 2 — Add central preset

Update:

```text
AssessmentPresetId
ASSESSMENT_PRESETS
isAssessmentPresetId
JSON schema enum
```

Add contract/schema tests.

---

### Phase 3 — Add CTC LLM prompt

Create:

```text
apps/web/src/generation/ctc-assessment-generation-prompt.txt
```

Wire it into:

```text
GenerationPromptBuilder
```

Add prompt/history tests.

---

### Phase 4 — Add UI exposure

Add CTC to the assessment selection/import experience using the existing preset architecture.

Avoid unrelated UI redesign.

---

### Phase 5 — Add fixture and validation coverage

Create `valid-ctc.json`, negative test cases, and semantic validation tests.

---

### Phase 6 — Verify persistence/results/history

Search for any remaining 3-preset assumptions and fix only those that affect CTC support.

---

### Phase 7 — Docs and e2e

Update README, AGENTS, and end-to-end tests.

Run the full suite.

---

## 23. Definition of Done

The feature is complete only when all of the following are true:

- [ ] `ctc` is a first-class `AssessmentPresetId`.
- [ ] CTC is visible as a separate category in the app.
- [ ] CTC is configured for exactly 3 questions.
- [ ] CTC is configured for exactly 10800 seconds / 180 minutes.
- [ ] JSON schema accepts `"preset": "ctc"`.
- [ ] semantic validation derives CTC rules from centralized preset metadata.
- [ ] a dedicated CTC generation prompt exists.
- [ ] the prompt is implementation/logic-heavy and Medium-ish rather than IMC/competitive-programming-heavy.
- [ ] Q1/Q2/Q3 have the intended broad pacing profile.
- [ ] the prompt explicitly forbids leaked/reported/proprietary problem reconstruction.
- [ ] the prompt requires meaningful hidden correctness and performance cases.
- [ ] the existing history avoidance system works with CTC.
- [ ] a valid CTC fixture imports successfully.
- [ ] wrong CTC duration/problem-count/slot configurations fail validation.
- [ ] the assessment workspace correctly renders three problems and a 180-minute timer.
- [ ] results/history/readiness output retain the CTC preset.
- [ ] legacy GCA behavior still works.
- [ ] GCA tests pass.
- [ ] Roblox tests pass.
- [ ] IMC tests pass.
- [ ] CTC tests pass.
- [ ] typecheck passes.
- [ ] build passes.
- [ ] e2e tests pass.
- [ ] README documents the fourth preset and unofficial nature of the practice format.
- [ ] AGENTS.md references this implementation plan.

---

## 24. Non-Goals

Do not expand scope into:

- reproducing Codility's UI,
- reproducing Codility's proprietary scoring model,
- web scraping CTC questions,
- ingesting leaked questions,
- finance/trading knowledge questions,
- a new backend judge,
- new compiler infrastructure,
- an assessment marketplace,
- account/auth changes,
- unrelated visual redesign,
- changes to GCA/Roblox/IMC difficulty calibration.

The goal is a **small, architecturally consistent fourth preset with a high-quality CTC-specific generation profile**.

---

## 25. Final Instruction to Codex

Implement this as a focused extension of the current preset architecture.

Prefer the smallest complete change that:

1. makes `ctc` a real fourth preset,
2. gives it a dedicated 3-question / 180-minute generation profile,
3. preserves all existing engine behavior,
4. adds strong validation and regression coverage,
5. clearly labels the format as unofficial practice,
6. generates original problems rather than reconstructing real assessments.

Before editing, inspect current HEAD and adapt file names or call sites where the repository has evolved since this plan was written. Do not blindly follow stale assumptions when the code itself provides a more centralized path.
