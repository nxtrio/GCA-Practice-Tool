# Codex Prompt — Add IMC SWE HackerRank Practice Preset

You are modifying this repository:

https://github.com/nxtrio/GCA-Practice-Tool

Your task is to add a new **IMC Software Engineering HackerRank Practice** assessment category/preset to the existing coding-assessment practice application.

The goal is to let the user generate and take realistic **IMC SWE-style practice assessments** using the same local assessment engine already used for the GCA and Roblox modes.

Do not merely produce an implementation plan. Inspect the repository, implement the feature completely, test it, and leave the repository in a working state.

---

## 1. READ THE REPOSITORY FIRST

Before modifying code:

1. Read `AGENTS.md`.
2. Read:
   - `implementation-plans/gca_practice_codex_implementation_spec.md`
   - `implementation-plans/assessment_presets_roblox_expansion.md`
3. Inspect the CURRENT implementation.
4. Do not assume the old implementation plans exactly match the current code.
5. Identify how the existing `gca` and `roblox` presets currently control:
   - assessment metadata;
   - problem count;
   - duration;
   - validation;
   - generation prompts;
   - generation history;
   - UI labels;
   - session creation;
   - workspace;
   - results;
   - persistence;
   - retry flows.

The app already has a preset architecture. Extend that architecture cleanly.

DO NOT create a second parallel assessment engine specifically for IMC.

---

## 2. PRODUCT GOAL

Add a third practice option:

**IMC Software Engineering Assessment**

The home page should conceptually offer:

- General Coding Assessment
  - 4 questions
  - 70 minutes

- Roblox Coding Assessment
  - 2 questions
  - 50 minutes

- IMC Software Engineering Assessment
  - 2 questions
  - 120 minutes
  - HackerRank-style
  - Algorithms / Data Structures
  - Medium-Hard / Hard

The desired workflow is:

```text
Launch app
→ choose IMC Software Engineering Assessment
→ copy IMC-specific generation prompt
→ paste prompt into an external LLM
→ receive generated JSON
→ paste/import JSON
→ validate assessment
→ begin 120-minute session
→ inspect either question in any order
→ solve using Java, C++, or Python
→ Run Code
→ inspect sample-test results
→ optionally test custom inputs
→ Submit Code
→ switch/revisit questions
→ finish assessment
→ view results
→ export readiness-analysis JSON
```

The IMC mode must reuse the existing infrastructure wherever possible.

---

## 3. RESEARCH / MODELING ASSUMPTIONS

This is an **UNOFFICIAL practice mode**.

Current public candidate reports for the 2026–2027 recruiting cycle commonly describe the IMC Software Engineering HackerRank assessment as:

- HackerRank
- 2 coding problems
- approximately 120 minutes total
- algorithm / data-structure focused
- problems often around Medium-Hard to Hard
- substantial hidden testing
- constraints large enough that inefficient approaches may fail
- strong emphasis on deriving the required complexity from the constraints

IMC does **NOT** publicly guarantee that every office, role, year, or recruiting batch uses exactly the same assessment.

Therefore:

- model the practice preset as **2 problems / 120 minutes**;
- keep the preset definition centralized so this can easily be changed later;
- label the feature as an unofficial practice simulation;
- do NOT claim this is IMC's guaranteed assessment format.

The user is taking the Chicago Software Engineering assessment, so optimize the practice profile for SWE algorithmic coding rather than trading/math questions.

Do NOT add:

- mental-math tests;
- probability games;
- market-making games;
- finance trivia;
- trading simulations.

This is a **Software Engineering coding assessment preset**.

---

## 4. PRESET DEFINITION

Extend the existing preset type.

Conceptually:

```ts
export type AssessmentPresetId =
  | "gca"
  | "roblox"
  | "imc";
```

Add something conceptually equivalent to:

```ts
imc: {
  id: "imc",
  displayName: "IMC Software Engineering Assessment",
  shortName: "IMC",
  problemCount: 2,
  durationSeconds: 7200,
}
```

Use whatever structure fits the CURRENT architecture.

The authoritative IMC defaults must be:

```text
preset = "imc"
problemCount = 2
durationSeconds = 7200
```

Do not scatter `2` or `7200` across generic application logic.

---

## 5. ASSESSMENT JSON CONTRACT

Generated IMC assessments should continue to use the existing schema wherever possible.

Do NOT invent an entirely separate IMC schema unless absolutely necessary.

New generated assessments must contain:

```json
"schemaVersion": "1.0"
```

and:

```json
"preset": "imc"
```

and:

```json
"durationSeconds": 7200
```

with exactly two problems.

Use:

```text
p1
p2
```

with slots:

```text
1
2
```

Keep the existing TypeSpec system and single-function execution architecture unless the current code has evolved to support something better.

Preserve the existing required problem fields, test definitions, Python reference solution validation, semantic validation, hidden-test protections, and oracle verification.

Do not weaken any existing validation.

IMC validation should reject:

- incorrect preset;
- duration other than 7200;
- anything other than exactly two problems;
- slots other than 1 and 2;
- duplicate IDs;
- malformed signatures;
- invalid tests;
- incorrect expected results;
- invalid reference solutions.

Existing GCA and Roblox JSON must continue working exactly as before.

---

## 6. HACKERRANK-INSPIRED CANDIDATE EXPERIENCE

The IMC preset should feel closer to taking a HackerRank test than the GCA preset does.

Do NOT copy HackerRank:

- logos;
- trademarks as decorative branding;
- proprietary assets;
- pixel-for-pixel layout;
- CSS;
- screenshots;
- source code.

Instead reproduce the useful behavioral characteristics of a HackerRank coding test using the project's existing visual language.

Prioritize behavioral fidelity over visual cloning.

### Required IMC workspace behavior

The user should be able to:

- see the overall remaining assessment time;
- navigate freely between Question 1 and Question 2;
- see whether each problem is:
  - not attempted;
  - attempted;
  - submitted;
- retain code while switching questions;
- retain code separately per programming language if the application already behaves this way;
- Run Code without submitting;
- Submit Code independently for each question;
- revisit a submitted question;
- edit it;
- resubmit it before the assessment ends;
- use sample tests;
- use custom tests if supported by the existing runner;
- finish the entire assessment manually;
- have the assessment automatically finish when time expires.

Use terminology such as:

```text
Run Code
Submit Code
Question 1
Question 2
All Questions
Test Results
Custom Input
```

where appropriate.

Do not make unnecessary cosmetic changes to GCA or Roblox.

---

## 7. TEST-CASE EXPERIENCE

HackerRank-style assessment behavior makes the distinction between sample tests and hidden evaluation important.

For IMC practice:

### Run Code

`Run Code` should primarily expose:

- sample / visible tests;
- compile errors;
- runtime errors;
- actual output;
- expected output where appropriate;
- custom test execution.

Do not expose private hidden-test inputs or expected outputs.

### Submit Code

`Submit Code` should evaluate the complete test suite.

After submission, the user may see:

- number of tests passed;
- number failed;
- time-limit failures;
- runtime errors;
- high-level status.

But hidden test:

- arguments;
- expected answers;
- reference-solution details

must remain hidden during the assessment.

Reuse the application's current hidden-test architecture rather than rebuilding this unnecessarily.

If the existing system already behaves sufficiently like this, preserve it and only make small IMC-specific presentation adjustments.

---

## 8. OPTIONAL CUSTOM INPUT

Inspect what custom-test functionality already exists.

If the app already supports custom inputs cleanly, expose it naturally in IMC mode.

If implementing a HackerRank-like custom-input panel is straightforward using the existing TypeSpec runner, make it accessible through something equivalent to:

```text
Test against custom input
```

or:

```text
Custom Input
```

Do not rewrite the execution engine just to emulate HackerRank STDIN.

The application uses function-based problems and that is acceptable.

Functional practice value is more important than perfectly recreating HackerRank's I/O system.

---

## 9. IMC GENERATION PROMPT

Create a dedicated IMC generation profile.

Do NOT generate IMC assessments by merely taking the Roblox prompt and changing the timer.

The IMC assessment needs a substantially different difficulty and topic profile.

Reuse shared JSON/output/validation rules where practical.

Conceptually the prompt system may have:

```text
shared-generation-rules
gca-generation-profile
roblox-generation-profile
imc-generation-profile
```

but fit this into the existing implementation instead of forcing this exact file structure.

---

## 10. IMC GENERATION PHILOSOPHY

The generated pair should feel like ONE coherent two-hour SWE assessment.

Do NOT independently generate two random LeetCode problems.

Both questions should require meaningful reasoning, implementation, complexity analysis, and hidden-test robustness.

Target approximately:

```text
Q1: 40–50 minutes
Q2: 55–70 minutes
```

There is intentionally some overlap because difficulty is variable.

The candidate should ideally have around 10–20 minutes total for:

- reading;
- debugging;
- testing;
- revisiting solutions.

For this practice mode, bias difficulty slightly toward the harder side rather than making the mock too easy.

A candidate who can consistently solve these mocks should feel well-buffered for a real Medium-Hard assessment.

---

## 11. QUESTION 1 PROFILE

Question 1 should usually be approximately:

```text
upper Medium → Medium-Hard
```

It should require more than trivial implementation.

Good Q1 patterns include combinations of:

- arrays;
- strings;
- hash maps;
- sets;
- sorting;
- binary search;
- prefix sums;
- intervals;
- heaps / priority queues;
- stack / monotonic structures;
- matrix reasoning;
- BFS / DFS;
- simulation;
- greedy reasoning;
- preprocessing.

Difficulty should preferably come from:

```text
understanding the problem
→ identifying the correct representation
→ deriving an efficient enough solution
→ implementing it carefully
→ covering edge cases
```

Avoid making Q1 a warm-up Easy.

---

## 12. QUESTION 2 PROFILE

Question 2 should usually be approximately:

```text
Medium-Hard → Hard
```

The ideal shape is often:

```text
straightforward brute-force approach exists
→ constraints make it inadequate
→ candidate must identify exploitable structure
→ combine 2 or more standard techniques
→ implement optimized solution correctly
```

Good techniques include:

- binary search on answer;
- BFS / DFS with augmented state;
- Dijkstra / shortest paths;
- dynamic programming;
- multidimensional DP;
- greedy + sorting;
- greedy + ordered structure;
- prefix sums;
- 2D prefix sums;
- monotonic stack;
- monotonic deque;
- priority queues;
- offline query processing;
- tree preprocessing;
- coordinate compression;
- frequency/state bookkeeping;
- custom data-structure implementation;
- repeated-query optimization;
- sweep-line style sorting;
- memoization where appropriate.

Do not force obscure algorithms merely to call the problem "Hard."

---

## 13. DESIRED TOPIC BREADTH

Across repeated IMC mocks, strongly favor these families:

### Tier 1

- arrays
- hashing
- sorting
- binary search
- prefix sums
- greedy
- heaps / priority queues
- BFS
- DFS
- practical dynamic programming
- simulation
- careful state management
- complexity optimization

### Tier 2

- matrices / grids
- 2D prefix sums
- monotonic stack
- monotonic deque
- intervals
- tree traversal / preprocessing
- shortest paths
- offline queries
- custom data structures
- frequency / recency bookkeeping
- binary search on answer
- augmented graph state

### Occasional

- union-find
- topological sorting
- coordinate compression
- bit manipulation
- trie-like structures

Do not make every mock the same.

The two questions in one assessment should preferably test DIFFERENT major skill families.

Example desirable pairings:

```text
Q1: sorting + heap
Q2: BFS + augmented state
```

or:

```text
Q1: prefix sums + hashing
Q2: binary search on answer + graph feasibility
```

or:

```text
Q1: simulation + custom data structure
Q2: DP + preprocessing
```

These are examples of technique combinations only.

Do not repeatedly generate these exact pairings.

---

## 14. COMPLEXITY MUST MATTER

This is especially important.

Generated constraints must be designed so that complexity analysis matters.

The generator should frequently create situations where:

```text
O(n²) brute force is easy to imagine
but n is large enough that it will time out
```

or:

```text
recomputing each query independently is too slow
```

or:

```text
a BFS/DFS state definition must include additional information
```

or:

```text
a naive repeated scan must be replaced by preprocessing
```

However, do not create fake constraints purely to reject otherwise reasonable solutions.

Every constraint should be internally consistent with:

- the intended solution;
- runtime limit;
- input size;
- generated hidden stress tests.

---

## 15. TEST DESIGN

Each problem must have strong visible and hidden testing.

Favor roughly the scale expected from a serious HackerRank coding question.

Include enough tests to cover:

- standard behavior;
- minimum sizes;
- maximum-ish sizes;
- duplicates;
- boundaries;
- empty results where valid;
- all-equal inputs;
- increasing/decreasing patterns;
- overflow-sensitive cases;
- adversarial complexity cases;
- off-by-one traps;
- disconnected/unreachable states where relevant;
- multiple equivalent choices;
- large stress cases.

Avoid redundant tests that exercise exactly the same behavior.

Hidden tests must meaningfully detect:

- brute-force TLE;
- incorrect greedy assumptions;
- incomplete state;
- integer overflow;
- indexing mistakes;
- mutation bugs;
- duplicate handling;
- boundary errors.

The Python reference solution must successfully validate every test.

---

## 16. INTEGER OVERFLOW

Because IMC emphasizes Java/C++ and algorithmic implementation, generation should occasionally require awareness of numeric bounds.

If intermediate calculations can exceed 32-bit integer range:

- state this clearly through realistic constraints;
- use the existing `long` TypeSpec when the returned value requires it;
- reference solutions must handle the value correctly;
- generated tests should include at least one meaningful large-value case.

Do not create accidental overflow in the oracle.

---

## 17. DO NOT OVERFIT TO REPORTED IMC QUESTIONS

This requirement is critical.

The generator may use public candidate reports only to understand:

- approximate difficulty;
- assessment pacing;
- broad algorithm families;
- implementation style;
- importance of constraints;
- hidden-test pressure.

It MUST NOT reproduce, reconstruct, paraphrase, mutate, or lightly disguise:

- leaked IMC OA questions;
- reported IMC HackerRank questions;
- proprietary HackerRank questions;
- interview questions from repositories;
- questions from candidate write-ups;
- questions from LeetCode discussions;
- questions from Reddit posts;
- questions from interview-preparation websites.

Add explicit instructions to the generation prompt similar to:

```text
ORIGINALITY REQUIREMENT

Create entirely original practice problems.

Use public IMC assessment reports only to infer broad
difficulty, pacing, and skill distributions.

Do NOT reproduce, paraphrase, mutate, or reconstruct any
reported or leaked IMC assessment problem.

If a generated problem strongly resembles a known IMC,
HackerRank, LeetCode, or interview-bank problem, replace it
with a materially different problem.

Technique similarity is allowed.
Problem replication is not.
```

---

## 18. GENERATION HISTORY / DUPLICATE AVOIDANCE

Reuse the existing generation-history mechanism.

IMC history should primarily avoid repetition against previous IMC practice questions.

Track enough metadata to discourage repeated:

- story/theme;
- primary technique;
- secondary technique;
- state representation;
- optimization insight;
- output objective.

Do NOT make topic avoidance so aggressive that important IMC topics disappear forever.

For example, binary search, hashing, sorting, DP, and graphs should remain recurring skill families.

The goal is to avoid near-duplicate problems, not avoid practicing important techniques repeatedly.

---

## 19. UI — HOME PAGE

Add an IMC option alongside the existing presets.

Something conceptually like:

```text
IMC Software Engineering

2 Questions · 120 Minutes

HackerRank-style algorithmic assessment
Medium-Hard / Hard

[ Practice IMC SWE ]
```

Keep styling consistent with the rest of the application.

Do not use IMC logos.

Do not use HackerRank logos.

Do not imply affiliation with either company.

---

## 20. UI — IMPORT PAGE

When IMC is selected, show something like:

```text
New IMC SWE Practice Assessment

2 questions · 120 minutes
HackerRank-style algorithmic practice
```

The `Copy Generation Prompt` button must copy the IMC generation prompt.

The validation indicators should dynamically expect:

```text
✓ IMC preset
✓ 2 problems
✓ 120 minute duration
✓ Reference solutions verified
```

Do not duplicate the importer.

Make the existing importer preset-aware.

---

## 21. UI — ASSESSMENT WORKSPACE

The IMC workspace should use the same core editor/runner but have a somewhat HackerRank-like workflow.

A reasonable conceptual layout:

```text
┌─────────────────────────────────────────────────────────────┐
│ IMC SWE Practice                     01:37:42   Finish Test │
├──────────────┬────────────────────────────┬─────────────────┤
│ Questions    │ Problem                    │ Code            │
│              │                            │                 │
│ Q1 Attempted │ Description                │ Java ▼          │
│ Q2 Submitted │ Examples                   │                 │
│              │ Constraints                │ Monaco Editor   │
│              │                            │                 │
├──────────────┴────────────────────────────┴─────────────────┤
│ Test Results / Custom Input                                │
│                                                            │
│                              Run Code     Submit Code       │
└─────────────────────────────────────────────────────────────┘
```

This is conceptual only.

Do not perform an expensive redesign if the existing workspace already contains most of these pieces.

Prefer small, high-value UI changes.

---

## 22. QUESTION STATUS

For IMC, clearly display per-question status:

```text
Not Attempted
Attempted
Submitted
```

If the existing model tracks enough information to derive this, use it.

Do not add excessive database complexity merely for cosmetic status labels.

After a submission, the candidate must still be able to:

- navigate away;
- return;
- modify code;
- Run Code again;
- resubmit.

---

## 23. RESULTS

Final IMC results should show at minimum:

```text
IMC SWE Practice

Problems fully solved: X / 2
Tests passed: X / Y
Time used: ...
Time remaining: ...

Q1: ...
Q2: ...
```

Preserve useful existing information such as:

- per-question test totals;
- completion status;
- submission attempts;
- language;
- timeout/runtime-error information if already available.

Do not invent an "IMC score."

Do not invent a pass/fail cutoff.

---

## 24. READINESS ANALYSIS EXPORT

The existing privacy-safe readiness-analysis JSON export must continue working.

Make sure exported sessions identify:

```json
"preset": "imc"
```

The exported data should allow an external LLM to analyze:

- time spent per problem;
- submissions;
- passed/failed tests;
- code;
- TLE/runtime errors;
- completion;
- problem-generation metadata;

to the same extent those metrics are already supported.

Do not leak hidden expected outputs or reference solutions into the assessment-time UI.

---

## 25. BACKWARD COMPATIBILITY

This change must NOT break:

- GCA generation;
- GCA imports;
- GCA validation;
- GCA history;
- Roblox generation;
- Roblox imports;
- Roblox validation;
- Roblox history;
- existing persisted sessions;
- old assessments without newly introduced optional fields.

Legacy GCA behavior must continue to work.

Do not change schema version unless technically unavoidable.

---

## 26. TESTING REQUIREMENTS

Add or update automated tests.

At minimum test:

### Presets

- GCA still resolves correctly.
- Roblox still resolves correctly.
- IMC resolves correctly.
- IMC duration = 7200.
- IMC problem count = 2.

### Validation

Valid IMC assessment:

- 2 problems;
- slots 1 and 2;
- 7200 seconds;
- preset `imc`.

Reject:

- IMC with 1 problem;
- IMC with 3 problems;
- IMC with 3000 seconds;
- IMC with 4200 seconds;
- IMC with incorrect slots;
- unsupported preset.

### Prompt generation

Verify IMC prompt contains:

- `preset = imc`;
- exactly two questions;
- 7200 seconds;
- IMC difficulty profile;
- originality requirement.

Verify it does NOT accidentally contain incompatible requirements such as:

- exactly four questions;
- 4200 seconds;
- Roblox-specific matrix-heavy requirements.

### UI

Test:

- IMC appears on home page.
- selecting IMC reaches the correct import flow;
- IMC generation prompt can be copied;
- valid IMC JSON can start;
- workspace shows Q1 and Q2;
- timer uses 120 minutes;
- question switching retains code;
- Run works;
- Submit works;
- submitted questions can be edited and resubmitted;
- finishing reaches results;
- history identifies IMC sessions.

### Regression

Run the full existing test suite.

---

## 27. DEVELOPMENT VALIDATION

Before completing the task, run the repository's existing required checks, including whatever currently corresponds to:

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Fix failures caused by the implementation.

Do not silence failing tests just to make CI green.

---

## 28. DOCUMENTATION

Update the README so the project describes all three supported formats.

Something conceptually like:

```text
GCA Practice
4 questions · 70 minutes

Roblox Coding Assessment Practice
2 questions · 50 minutes
Implementation / matrix biased

IMC Software Engineering Practice
2 questions · 120 minutes
HackerRank-style algorithmic coding
```

Include an explicit disclaimer that the IMC mode:

- is unofficial;
- is not affiliated with IMC or HackerRank;
- uses original generated practice questions;
- models publicly reported broad assessment characteristics rather than guaranteeing the real test format.

---

## 29. IMPLEMENTATION PRIORITY

Optimize in this order:

1. Correct IMC preset behavior.
2. Correct 2-question / 120-minute validation.
3. High-quality IMC-specific generation prompt.
4. Existing execution/run/submit functionality.
5. Hidden-test fidelity.
6. HackerRank-inspired workflow.
7. Generation history.
8. Results/export.
9. Cosmetic similarity.

Do not sacrifice working assessment functionality for visual polish.

---

## 30. DO NOT OVERENGINEER

Do not introduce:

- a separate IMC backend;
- a separate IMC database;
- a separate runner;
- a separate validation engine;
- a HackerRank clone;
- authentication;
- cloud services;
- new microservices;
- anti-cheat;
- webcam monitoring;
- browser tracking;
- plagiarism detection;
- finance simulation;
- LLM API integration.

Reuse the architecture already present.

---

## 31. IMPORTANT PRODUCT PRINCIPLE

This feature exists for realistic preparation.

A strong IMC mock should make the candidate practice:

```text
read constraints carefully
→ determine feasible complexity
→ identify appropriate data structures/algorithms
→ implement accurately
→ use Run Code intelligently
→ debug edge cases
→ survive hidden stress tests
→ manage a two-hour shared clock
```

It should NOT become:

```text
recognize leaked IMC problem
→ reproduce memorized answer
```

---

## 32. FINAL ACCEPTANCE CRITERIA

The task is complete when I can:

1. clone/start the project normally;
2. see IMC SWE as a third assessment type;
3. choose it;
4. copy a dedicated IMC generation prompt;
5. generate a JSON assessment using an external LLM;
6. paste that JSON into the application;
7. successfully validate an assessment containing:
   - `preset: "imc"`
   - `durationSeconds: 7200`
   - exactly two questions;
8. begin a 120-minute assessment;
9. freely switch between Q1 and Q2;
10. write Java/C++/Python;
11. run sample/custom tests;
12. submit against hidden tests;
13. modify and resubmit answers;
14. finish the assessment;
15. see IMC-specific results;
16. see the session correctly represented in history;
17. export readiness-analysis JSON;
18. continue using GCA and Roblox with no regressions.

After implementation, provide me with:

- a concise summary of what changed;
- important architectural decisions;
- files added or modified;
- test results;
- any assumptions made;
- any limitations that remain.

Do not stop after planning. Implement the complete feature.

---

## Implementation Notes

A few choices here are deliberate:

- **Do not implement a true HackerRank STDIN/stdout engine unless it is already easy to support.** The existing function-based runner provides nearly all of the useful practice value and avoids an unnecessary execution-engine rewrite.
- **Use 2 questions / 120 minutes as the practice model**, but keep this centralized and clearly marked as an unofficial simulation because IMC does not publicly guarantee a universal assessment format.
- Since the immediate goal is realistic practice, prioritize:
  1. preset correctness;
  2. generation quality;
  3. timer;
  4. hidden-test behavior;
  5. run/submit workflow;
  6. regression safety;
  7. UI polish last.
