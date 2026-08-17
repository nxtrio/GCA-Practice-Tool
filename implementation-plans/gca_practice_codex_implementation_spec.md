# Local GCA Practice Environment — Codex Implementation Specification

## Purpose

Build a **local-only practice application** that recreates the workflow and behavioral experience of the CodeSignal General Coding Assessment (GCA) as closely as practical, without copying proprietary CodeSignal assets, branding, source code, or real assessment questions.

The application is for **one local user** practicing coding assessments.

The primary workflow is:

1. Open the local app.
2. Copy a reusable assessment-generation prompt.
3. Paste that prompt into ChatGPT, Claude, or another external model.
4. Receive a strict JSON assessment payload.
5. Paste the JSON into the local app.
6. Validate the assessment automatically.
7. Start a realistic timed GCA-style session.
8. Solve four coding problems in Java, C++, or Python.
9. Run visible/custom tests.
10. Submit against visible + hidden tests.
11. View a final assessment summary.

The application should replace the current manual workflow of generating questions in ChatGPT, switching to VS Code, manually creating files/function signatures/test cases, manually tracking time, and manually approximating visible/hidden tests.

---

# 1. Core Product Principles

Optimize in this priority order:

1. **Realistic GCA practice**
2. **Extremely fast assessment generation/import**
3. **Reliable code/test execution**
4. **Simple local development**
5. **Maintainability**
6. **Visual fidelity**

Avoid overengineering.

This is **not** a production online judge, not a SaaS product, and not a cloud platform.

---

# 2. Required Technology Choices

Unless a blocking technical issue is discovered, use the following architecture.

## Frontend

- React
- TypeScript
- Vite
- Monaco Editor
- React Router

Do not use Next.js.

Do not use Redux unless application complexity later proves that React Context + reducer/state hooks are insufficient.

## Backend

- Node.js
- TypeScript
- Express

Use a local HTTP API served on localhost.

## Persistence

- SQLite
- Prefer `better-sqlite3`

Do not build a separate database service.

## Validation

- JSON Schema
- Ajv

## Code Execution

Run native local subprocesses.

Supported languages:

- Java
- C++
- Python

Use:

- Java: `javac` + `java`
- C++: prefer `clang++`, fall back to `g++`
- Python: `python3`

Do not use Docker for the MVP.

## Repository Shape

Use a TypeScript monorepo-style structure with shared packages for contracts, schema validation, and runner logic.

---

# 3. Explicit Non-Goals

Do **not** implement any of the following unless explicitly requested later:

- authentication
- accounts
- cloud deployment
- cloud sync
- multiplayer
- social features
- online leaderboards
- anti-cheat
- webcam monitoring
- plagiarism detection
- payment systems
- LLM API integration
- automated AI generation inside the app
- actual proprietary CodeSignal questions
- Redis
- Kafka
- message brokers
- microservices
- Kubernetes
- production multi-tenant sandboxing
- browser-based terminal
- Git integration
- debugger/breakpoints
- language servers
- Copilot-like assistance
- full IDE filesystem explorer
- Electron packaging
- Tauri packaging
- hard cross-platform memory sandboxing in MVP

The product should remain a **specialized local GCA simulator**.

---

# 4. GCA Practice Behavior to Reproduce

Use a default GCA preset of:

- 4 questions
- 70 minutes
- all questions available once the session starts
- questions solvable in any order
- timer cannot be paused
- code preserved when moving between problems
- code preserved separately per language
- visible tests available while solving
- hidden tests executed on Submit
- final assessment summary

The exact styling does not need to clone CodeSignal.

Behavioral fidelity matters more than cosmetic fidelity.

---

# 5. Main Screens

Implement the following screens.

## 5.1 Home

Show:

- Start New Practice Assessment
- Resume unfinished assessment, if one exists
- Recent assessment history
- Settings
- Environment/toolchain status

## 5.2 Import / Generate Assessment

This page should make generation/import extremely fast.

Include:

- `Copy Generation Prompt`
- large JSON paste editor/text area
- automatic validation after paste
- validation error list
- warnings
- `Copy Repair Prompt`
- `Start Assessment`

Suggested layout:

```text
┌──────────────────────────────────────────────┐
│ New Practice Assessment                      │
│                                              │
│ [ Copy Generation Prompt ]                   │
│                                              │
│ Assessment JSON                              │
│ ┌──────────────────────────────────────────┐ │
│ │ paste here...                            │ │
│ │                                          │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ ✓ Schema valid                              │
│ ✓ 4 problems                                │
│ ✓ 70 minute duration                        │
│ ✓ Reference solutions verified              │
│ ✓ Java runner available                     │
│ ✓ C++ runner available                      │
│ ✓ Python runner available                   │
│                                              │
│               [ Start Assessment ]           │
└──────────────────────────────────────────────┘
```

Do not create a multi-step import wizard.

## 5.3 Assessment Screen

Suggested layout:

```text
┌────────────────────────────────────────────────────────────┐
│ GCA Practice     Q1  Q2  Q3  Q4          37:42   Finish   │
├──────────────────────┬─────────────────────────────────────┤
│ Description          │ Java ▾          Reset   Settings    │
│                      │                                     │
│ Problem title        │  1  int solution(int[] nums) {     │
│                      │  2                                  │
│ Description...       │  3                                  │
│                      │  4  }                               │
│ Examples             │                                     │
│                      │                                     │
│ Constraints          │                                     │
│                      │                                     │
├──────────────────────┴─────────────────────────────────────┤
│ Tests                                                      │
│ ✓ Test 1      ✓ Test 2      ✕ Test 3                       │
│                                                            │
│                           Run      Submit                   │
└────────────────────────────────────────────────────────────┘
```

Requirements:

- problem statement panel
- Monaco code editor
- draggable horizontal/vertical panels if practical
- timer
- problem tabs/navigation
- language selector
- Run
- Submit
- test result area
- code autosave
- keyboard-friendly behavior
- distraction-minimized layout

## 5.4 Final Results

Show at minimum:

```text
Problems fully solved: 3 / 4
Tests passed:          72 / 81
Time used:             65:42
Time remaining:         4:18

Q1  ✓  15/15
Q2  ✓  18/18
Q3  —  14/20
Q4  ✓  19/19
```

Do not attempt to reproduce CodeSignal's exact score in the MVP.

---

# 6. Assessment Import Format

The app must accept **strict machine-readable JSON**.

Do not parse arbitrary Markdown.

Use JSON Schema + semantic validation.

---

# 7. Language-Neutral Function Type System

The imported assessment should describe function signatures using a small language-neutral type system.

The app must generate Java, C++, and Python signatures automatically.

Do not require the LLM to independently generate three language signatures.

## Supported MVP Types

Support:

```text
int
long
boolean
string
array<T>
```

Arrays may nest.

Examples:

```text
array<int>
array<string>
array<array<int>>
```

This covers:

- integers
- strings
- booleans
- arrays/lists
- matrices
- nested arrays

Do not support arbitrary classes, objects, maps, sets, tuples, graphs, linked-list nodes, or custom structures in the MVP.

---

# 8. Signature Example

Imported form:

```json
{
  "name": "solution",
  "parameters": [
    {
      "name": "numbers",
      "type": {
        "kind": "array",
        "items": {
          "kind": "int"
        }
      }
    }
  ],
  "returnType": {
    "kind": "int"
  }
}
```

The application should deterministically generate:

Java:

```java
int solution(int[] numbers)
```

C++:

```cpp
int solution(vector<int> numbers)
```

Python:

```python
def solution(numbers):
```

Prefer deterministic starter-code generation over model-provided starter code.

---

# 9. Proposed Assessment JSON Shape

Use the following as the conceptual schema.

The actual JSON Schema should be created in the repository.

```json
{
  "schemaVersion": "1.0",
  "assessment": {
    "title": "GCA Practice 2026-08-16",
    "durationSeconds": 4200,
    "problems": [
      {
        "id": "p1",
        "slot": 1,
        "title": "Alternating Blocks",

        "generationMetadata": {
          "conceptSummary": "Count windows whose adjacent values alternate by a fixed relation.",
          "skills": [
            "arrays",
            "iteration"
          ],
          "expectedComplexity": "O(n)",
          "patternTags": [
            "array traversal"
          ]
        },

        "description": "Problem description here.",

        "constraints": [
          "1 <= values.length <= 100000"
        ],

        "signature": {
          "name": "solution",
          "parameters": [
            {
              "name": "values",
              "type": {
                "kind": "array",
                "items": {
                  "kind": "int"
                }
              }
            }
          ],
          "returnType": {
            "kind": "int"
          }
        },

        "examples": [
          {
            "arguments": [
              [1, 3, 1, 3]
            ],
            "output": 2,
            "explanation": "Example explanation."
          }
        ],

        "limits": {
          "executionTimeMs": 2000,
          "compileTimeMs": 10000,
          "outputLimitBytes": 65536
        },

        "tests": {
          "visible": [
            {
              "id": "v1",
              "arguments": [
                [1, 3, 1, 3]
              ],
              "expected": 2,
              "category": "example"
            }
          ],
          "hidden": [
            {
              "id": "h1",
              "arguments": [
                [5]
              ],
              "expected": 0,
              "category": "boundary"
            }
          ]
        },

        "validation": {
          "referenceLanguage": "python",
          "referenceSolution": "def solution(values):\n    ..."
        }
      }
    ]
  }
}
```

---

# 10. Import Validation Pipeline

Validation must happen in layers.

## Level 1 — JSON Parsing

Example error:

```text
Invalid JSON at line 183, column 14
```

## Level 2 — JSON Schema Validation

Use Ajv.

Examples:

```text
/problems/2/signature/parameters/1/type is invalid
```

## Level 3 — Semantic Validation

Examples:

```text
Exactly four problems are required for the default GCA preset.

Problem IDs must be unique.

Visible test v4 has 3 arguments but solution() accepts 2 parameters.

Expected output does not match return type.

Problem 3 has zero hidden tests.
```

Validate:

- problem count
- unique problem IDs
- unique test IDs
- supported TypeSpec
- argument count
- argument type compatibility
- expected-output type compatibility
- nonempty visible tests
- nonempty hidden tests
- valid limits
- supported reference language

## Level 4 — Reference Oracle Validation

This is required for MVP.

Each imported problem must include a Python reference solution.

During import:

```text
JSON
 ↓
schema validation
 ↓
semantic validation
 ↓
run reference solution
 ↓
execute every testcase
 ↓
reference output == declared expected?
      │
    no│yes
      │
 reject accept
```

Reject the assessment if any expected result disagrees with the reference solution.

Example error:

```text
Problem 3
Hidden test h17

Declared expected:
42

Reference solution produced:
41
```

This feature is non-negotiable because LLM-generated hidden test outputs may be wrong.

## Level 5 — Quality Warnings

Warnings should not block import.

Examples:

```text
Warning: Problem 4 contains only 7 hidden tests.

Warning: No boundary test uses the minimum array size.

Warning: Q1 and Q2 use highly similar pattern tags.

Warning: Problem appears similar to a previously imported problem.
```

---

# 11. LLM Generation Workflow

The app itself must **not call an LLM API**.

Instead, it should generate a reusable prompt that the user copies into ChatGPT, Claude, or another model.

The generated prompt must instruct the model to:

- generate exactly four original GCA-style single-function problems
- avoid reproducing known CodeSignal questions
- return JSON only
- not wrap JSON in Markdown fences
- use only the supported TypeSpec vocabulary
- make every test conform to the signature
- provide a Python reference solution for every problem
- generate visible and hidden tests
- generate edge cases
- generate at least some stress-oriented tests
- verify expected outputs against the reference solution before responding
- produce internally consistent descriptions, examples, tests, and reference code

---

# 12. Suggested GCA Generation Profile

Use approximately this difficulty distribution.

## Q1

- straightforward implementation
- target solve time: ~5–10 minutes
- arrays / strings / loops
- few algorithmic tricks

## Q2

- moderate data manipulation
- target solve time: ~10–15 minutes
- maps
- strings
- counting
- transformations
- prefix state
- sliding windows where appropriate

## Q3

- implementation-heavy
- target solve time: ~15–25 minutes
- simulation
- matrices
- state
- multiple rules
- careful implementation

## Q4

- optimization / problem solving
- target solve time: ~20–30 minutes
- naive solution should fail constraints
- possible patterns:
  - hashing
  - prefix sums
  - sorting
  - binary search
  - greedy
  - two pointers
  - sliding window
  - frequency maps

Do not hard-code these patterns into the judge. They are only generation guidance.

---

# 13. Duplicate Problem Prevention

Store metadata for every imported problem:

```json
{
  "title": "Alternating Blocks",
  "conceptSummary": "Count subarrays satisfying an alternating local relation.",
  "patternTags": [
    "sliding-window",
    "array"
  ],
  "expectedComplexity": "O(n)",
  "signatureShape": "(int[]) -> int"
}
```

Compute a SHA-256 content fingerprint over normalized problem data.

This catches exact duplicates.

Also generate an `avoid previous problems` block for the generation prompt.

Example:

```text
AVOID PREVIOUSLY USED CONCEPTS:

1. Alternating Blocks
   sliding-window, arrays
   Count fixed windows satisfying alternating comparisons.

2. Power Pair Counter
   hash-map
   Count pairs whose transformed values match powers of two.

3. Falling Shape
   matrix simulation
   Simulate an object dropping into an occupied grid.
```

Semantic duplicate detection does not need an embedding model or LLM API.

A metadata manifest is sufficient for the first version.

---

# 14. Copy Repair Prompt

When imported JSON is invalid, provide a button:

```text
Copy Repair Prompt
```

The generated text should look like:

```text
The assessment JSON you generated failed validation.

Please return the ENTIRE corrected JSON document.

Do not wrap the JSON in Markdown.

Validation errors:

1. ...
2. ...
3. ...

Do not change problem concepts unless required to correct the errors.
```

This allows the user to repair malformed output in the original external LLM without requiring an API integration.

---

# 15. Code Execution Architecture

This subsystem is the most important technical area.

Create a common language runner interface.

Conceptually:

```ts
interface LanguageRunner {
  prepare(request: PrepareRequest): Promise<PreparedProgram>;

  runTest(
    program: PreparedProgram,
    test: MaterializedTest
  ): Promise<TestExecutionResult>;

  cleanup(program: PreparedProgram): Promise<void>;
}
```

Normalize results across languages.

Use verdicts:

```text
accepted
wrong_answer
compile_error
runtime_error
time_limit_exceeded
output_limit_exceeded
internal_error
```

---

# 16. Compile Once, Run Each Test Separately

For Java and C++:

```text
user code
   ↓
generate wrapper
   ↓
compile once
   ↓
run executable test 0
run executable test 1
run executable test 2
...
```

Do **not** compile separately for each test.

However, execute each test in a separate process.

Reason:

If one test reaches:

```java
while (true) {}
```

only that test process needs to be terminated.

The judge can still report earlier test results.

This also produces clean per-test timeout/runtime information.

---

# 17. Test Inputs as Generated Language Literals

Do not require candidate code to parse stdin.

Do not add JSON parsing libraries to Java/C++ merely for test input.

Given:

```json
[
  [1, 2, 3],
  "abc"
]
```

generate Java:

```java
solution(new int[]{1, 2, 3}, "abc");
```

generate C++:

```cpp
solution(vector<int>{1, 2, 3}, "abc");
```

generate Python:

```python
solution([1, 2, 3], "abc")
```

The HarnessGenerator is responsible for converting typed JSON values to source literals.

---

# 18. Keep Judge Results Separate from Candidate stdout

Never use normal stdout as the machine-readable judge protocol.

Users may write:

```java
System.out.println("debug");
```

or:

```python
print("debug")
```

Instead use:

```text
stdout → debug output
stderr → debug/error output
result → private judge result file
```

Example temp path:

```text
/tmp/gca-run-47ae/result.json
```

The generated harness should serialize the function return value into that result file.

The backend should then read that file.

This prevents candidate debug output from corrupting judge communication.

---

# 19. Java Runner

Candidate editor should expose only the solution method body/signature.

Example:

```java
int solution(int[] numbers) {
    // your code
}
```

Generate a complete compilation unit internally.

Conceptual wrapper:

```java
import java.util.*;

public class Main {

    // candidate source inserted here

    public static void main(String[] args) throws Exception {
        int testIndex = Integer.parseInt(args[0]);

        Main candidate = new Main();

        switch (testIndex) {
            case 0 -> {
                int result = candidate.solution(new int[]{1, 2, 3});
                JudgeOutput.write(result);
            }
        }
    }

    // generated serializer
}
```

Compile:

```text
javac Main.java
```

Run:

```text
java -Xmx256m Main <testIndex>
```

Capture compile errors separately from runtime errors.

---

# 20. C++ Runner

Candidate editor:

```cpp
int solution(vector<int> numbers) {
    // your code
}
```

Generated wrapper:

```cpp
#include <bits/stdc++.h>
using namespace std;

// candidate source

int main(int argc, char** argv) {
    int test = stoi(argv[1]);

    switch (test) {
        case 0: {
            auto result = solution(vector<int>{1, 2, 3});
            writeJudgeResult(result);
            break;
        }
    }
}
```

Compile using:

```text
clang++ -std=c++20 -O2
```

If `clang++` is unavailable, allow:

```text
g++ -std=c++20 -O2
```

Detect the compiler during application startup.

Do not switch compilers during a session.

---

# 21. Python Runner

Candidate editor:

```python
def solution(numbers):
    pass
```

Generated module:

```python
# candidate source

if __name__ == "__main__":
    test_index = int(sys.argv[1])

    if test_index == 0:
        result = solution([1, 2, 3])
        write_judge_result(result)
```

Optionally run:

```text
python3 -m py_compile
```

before tests so syntax errors can be reported cleanly.

---

# 22. Process Execution

Use Node `child_process.spawn`.

Use:

```text
shell: false
```

Never pass user-derived source text through shell commands.

Prefer explicit executable + argument arrays.

Example:

```ts
spawn("javac", ["Main.java"], {
  cwd: workspacePath,
  shell: false
});
```

---

# 23. Execution Limits

Recommended defaults:

```text
compile timeout:       10 seconds
per-test timeout:       2 seconds
stdout limit:          64 KB
stderr limit:          64 KB
Java heap:             256 MB
```

Assessment JSON may override these within reasonable configured bounds.

On timeout:

```text
SIGTERM
   ↓
short grace period
   ↓
SIGKILL
```

Implement process termination behind a platform abstraction.

Where supported, terminate the process group rather than only the immediate process.

---

# 24. Concurrency

For MVP:

- do not execute individual tests in parallel
- execute tests sequentially
- allow only one active execution job per session/problem

Benefits:

- deterministic order
- stable timing
- simpler cancellation
- simpler debugging
- lower CPU spikes

Parallel test execution can be added later if execution time becomes a real problem.

---

# 25. Temporary Workspace

Every compile/run operation should use a unique temp directory.

Example:

```text
/tmp/gca-practice/<uuid>/
```

Possible contents:

```text
Main.java
Main.class
solution.cpp
solution
solution.py
judge_result.json
```

Requirements:

- unique per preparation/run
- never share workspaces between submissions
- cleanup in `finally`
- tolerate cleanup failure without crashing the server
- periodically clean abandoned temp directories from earlier crashes

---

# 26. Test Case Model

Use four conceptual categories.

## Visible Sample Tests

Approximately:

```text
2–4 per problem
```

These should illustrate behavior.

## Hidden Correctness Tests

Approximately:

```text
10–20
```

Typical cases and structural variations.

## Hidden Edge Cases

Approximately:

```text
5–10
```

Examples:

- minimum input
- repeated values
- duplicates
- negatives where supported
- sorted values
- reverse sorted
- single element
- single row/column
- degenerate structures
- maximum relevant values

## Hidden Stress Tests

Approximately:

```text
2–5
```

Used to distinguish an expected efficient algorithm from brute force.

MVP may represent these as normal static tests.

Later versions may support generated tests.

---

# 27. Run vs Submit Semantics

Implement:

```text
Run
 └── visible tests only
```

Later:

```text
Run Custom
 └── user-created custom tests only
```

Implement:

```text
Submit
 ├── visible tests
 └── hidden tests
```

The UI must never display hidden inputs or expected outputs.

Hidden-test details should be redacted at the API boundary.

Good API response:

```json
{
  "visibility": "hidden",
  "status": "wrong_answer",
  "executionTimeMs": 42
}
```

Do not send hidden arguments/expected values to the frontend and merely hide them with CSS.

---

# 28. Custom Tests

Custom tests are **not required for the initial MVP**.

Practice-complete version should allow the user to enter:

- function arguments
- expected output

Run them separately.

Custom-test results should not alter assessment score/history.

---

# 29. Timer Design

Never decrement a timer variable once per second as the source of truth.

Persist:

```text
startedAt
expiresAt
```

Render:

```ts
remainingMs = expiresAt - Date.now()
```

This ensures refresh/restart does not pause or reset the timer.

At one minute remaining, show a strong warning.

At expiration:

1. freeze editing
2. snapshot code
3. mark session expired
4. optionally judge latest code snapshots
5. navigate to final results

The timer must not pause when switching tabs/problems.

---

# 30. Code Persistence

Persist candidate source using the key:

```text
session
problem
language
```

Switching:

```text
Q3 Java
 ↓
Q3 Python
 ↓
Q3 Java
```

must restore the original Java code exactly.

Autosave with a short debounce.

Do not wait for explicit Save.

---

# 31. Problem Navigation Status

Suggested statuses:

```text
○ untouched
◐ code written
● submitted but not fully passing
✓ fully solved
```

Status should be derived from persisted session state where practical.

---

# 32. Monaco Editor Configuration

Use Monaco.

Include:

- Java syntax highlighting
- C++ syntax highlighting
- Python syntax highlighting
- line numbers
- indentation
- bracket matching
- auto-closing brackets
- font-size setting
- tab-size setting
- theme
- word-wrap setting
- autocomplete setting

Do not add full Java/C++/Python language servers.

The editor should feel like an assessment IDE, not a full development workstation.

---

# 33. SQLite Design

Prefer a small number of tables and store imported assessment content as JSON.

Do not over-normalize the problem schema.

## assessments

```text
id
title
schema_version
duration_seconds
assessment_json
content_hash
created_at
```

## problem_catalog

```text
id
assessment_id
problem_id
title
concept_summary
pattern_tags_json
complexity
content_hash
created_at
```

## sessions

```text
id
assessment_id
status
started_at
expires_at
finished_at
created_at
```

Suggested status values:

```text
not_started
active
completed
expired
abandoned
```

## session_code

```text
session_id
problem_id
language
source
updated_at
```

Composite key:

```text
(session_id, problem_id, language)
```

## submissions

```text
id
session_id
problem_id
language
submission_type
submitted_at
passed
total
result_json
```

## settings

```text
key
value_json
```

---

# 34. Environment Detection

Create an environment/toolchain endpoint.

Suggested response:

```json
{
  "java": {
    "available": true,
    "version": "21.0.x",
    "javacPath": "/path/to/javac"
  },
  "cpp": {
    "available": true,
    "compiler": "clang++",
    "version": "..."
  },
  "python": {
    "available": true,
    "version": "3.x"
  }
}
```

If a runtime is unavailable:

- show it clearly before starting
- disable that language in the language selector
- provide a concise installation hint

Do not silently fail when Run is clicked.

---

# 35. Security Model

This is a personal local application.

It executes the user's own practice code.

It is **not a security sandbox**.

MVP should still protect the application from accidental broken code using:

- temp directories
- compile timeout
- per-test timeout
- process termination
- output limits
- maximum source size
- maximum assessment-import size
- `shell: false`
- Java heap limit
- cleanup

The README must clearly state that candidate code can still intentionally:

- read local files
- write local files
- access the network
- spawn processes

That is acceptable for the intended use case.

---

# 36. Memory Limits

Do not build a complex cross-platform memory sandbox in MVP.

Use:

```text
Java:   -Xmx256m
C++:    no strict memory cap in MVP
Python: no strict memory cap in MVP
```

Later options may include:

- POSIX resource limits
- optional Docker runner
- Linux cgroups

Do not block MVP on this feature.

---

# 37. Suggested API Surface

Keep the API small.

Example routes:

```text
GET    /api/environment

GET    /api/assessments
POST   /api/assessments/import
GET    /api/assessments/:id

POST   /api/sessions
GET    /api/sessions/:id
PATCH  /api/sessions/:id/code
POST   /api/sessions/:id/finish

POST   /api/execution/run
POST   /api/execution/submit

GET    /api/history
GET    /api/settings
PATCH  /api/settings
```

Do not create dozens of tiny endpoints unless needed.

---

# 38. Recommended Project Directory Structure

```text
gca-practice/
│
├── package.json
├── tsconfig.base.json
├── README.md
│
├── apps/
│   │
│   ├── web/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── pages/
│   │   │   │   ├── HomePage.tsx
│   │   │   │   ├── ImportAssessmentPage.tsx
│   │   │   │   ├── AssessmentPage.tsx
│   │   │   │   ├── ResultsPage.tsx
│   │   │   │   └── SettingsPage.tsx
│   │   │   │
│   │   │   ├── assessment/
│   │   │   │   ├── AssessmentShell.tsx
│   │   │   │   ├── AssessmentTimer.tsx
│   │   │   │   ├── ProblemNavigation.tsx
│   │   │   │   ├── ProblemDescription.tsx
│   │   │   │   ├── LanguageSelector.tsx
│   │   │   │   └── RunControls.tsx
│   │   │   │
│   │   │   ├── editor/
│   │   │   │   ├── CodeEditor.tsx
│   │   │   │   └── editorSettings.ts
│   │   │   │
│   │   │   ├── tests/
│   │   │   │   ├── TestPanel.tsx
│   │   │   │   ├── VisibleTest.tsx
│   │   │   │   └── HiddenTestResult.tsx
│   │   │   │
│   │   │   ├── import/
│   │   │   │   ├── AssessmentPaste.tsx
│   │   │   │   └── ValidationResults.tsx
│   │   │   │
│   │   │   └── api/
│   │   │       └── client.ts
│   │   │
│   │   └── vite.config.ts
│   │
│   └── server/
│       └── src/
│           ├── server.ts
│           │
│           ├── routes/
│           │   ├── assessments.ts
│           │   ├── sessions.ts
│           │   ├── execution.ts
│           │   └── environment.ts
│           │
│           ├── services/
│           │   ├── AssessmentService.ts
│           │   ├── SessionService.ts
│           │   ├── ImportService.ts
│           │   └── ExecutionService.ts
│           │
│           ├── persistence/
│           │   ├── database.ts
│           │   ├── migrations/
│           │   └── repositories/
│           │
│           └── generation/
│               ├── PromptBuilder.ts
│               └── AvoidanceManifest.ts
│
├── packages/
│   │
│   ├── contracts/
│   │   └── src/
│   │       ├── assessment.ts
│   │       ├── execution.ts
│   │       ├── session.ts
│   │       └── types.ts
│   │
│   ├── assessment-schema/
│   │   ├── assessment.schema.json
│   │   └── src/
│   │       ├── validate.ts
│   │       ├── semanticValidator.ts
│   │       └── oracleValidator.ts
│   │
│   └── runner-core/
│       └── src/
│           ├── coordinator/
│           │   └── ExecutionCoordinator.ts
│           │
│           ├── process/
│           │   ├── ProcessRunner.ts
│           │   ├── ProcessKiller.ts
│           │   └── OutputCollector.ts
│           │
│           ├── workspace/
│           │   └── TempWorkspace.ts
│           │
│           ├── harness/
│           │   ├── HarnessGenerator.ts
│           │   ├── JavaHarness.ts
│           │   ├── CppHarness.ts
│           │   └── PythonHarness.ts
│           │
│           ├── types/
│           │   ├── TypeSpec.ts
│           │   ├── JavaTypeGenerator.ts
│           │   ├── CppTypeGenerator.ts
│           │   └── PythonTypeGenerator.ts
│           │
│           ├── runners/
│           │   ├── LanguageRunner.ts
│           │   ├── JavaRunner.ts
│           │   ├── CppRunner.ts
│           │   ├── PythonRunner.ts
│           │   └── RunnerRegistry.ts
│           │
│           └── toolchains/
│               ├── JavaToolchain.ts
│               ├── CppToolchain.ts
│               └── PythonToolchain.ts
│
├── fixtures/
│   ├── assessments/
│   │   ├── valid-gca.json
│   │   └── invalid/
│   │
│   └── runner/
│       ├── java/
│       ├── cpp/
│       └── python/
│
└── tests/
    ├── integration/
    └── e2e/
```

The exact filenames may evolve, but keep responsibilities separated in roughly this way.

---

# 39. Implementation Roadmap

Work in technical dependency order.

Do not start by polishing the UI.

Each phase should leave behind something testable.

---

## Phase 0 — Repository and Shared Contracts

### Objective

Establish shared types before implementing features.

### Implement

- repository/package setup
- base TypeScript configuration
- shared contracts package
- assessment schema package
- runner-core package
- frontend/server app skeletons

Define:

```text
Assessment
Problem
TypeSpec
TestCase
RunRequest
RunResult
TestResult
Session
Submission
```

Create at least:

```text
fixtures/assessments/valid-gca.json
```

### Acceptance Criteria

- all packages compile
- shared types can be imported by web/server
- valid fixture passes schema validation
- basic test runner works

---

## Phase 1 — Assessment Schema and Semantic Validation

### Objective

Prove assessments can be represented safely.

### Implement

```text
assessment.schema.json
validateAssessment.ts
semanticValidator.ts
```

### Validation Rules

At minimum:

- valid JSON
- schema version
- exactly 4 problems for GCA preset
- unique problem IDs
- unique test IDs
- supported TypeSpec values
- correct argument counts
- input value/type compatibility
- expected value/return type compatibility
- visible tests present
- hidden tests present
- duration valid
- execution limits valid
- reference solution present

### Acceptance Criteria

- valid fixture accepted
- malformed fixtures rejected with specific paths/messages
- semantic errors distinguishable from JSON/schema errors

---

## Phase 2 — Type System and Harness Generation

### Objective

Solve the cross-language representation layer before process execution.

### Implement

```text
typeSystem/
  javaTypes.ts
  cppTypes.ts
  pythonTypes.ts

harness/
  javaHarness.ts
  cppHarness.ts
  pythonHarness.ts
```

Support literal/source generation for:

```text
int
long
boolean
string
array<int>
array<long>
array<boolean>
array<string>
nested arrays
```

Correctly escape:

- double quotes
- backslashes
- newline
- tab
- carriage return
- Unicode
- empty strings
- empty arrays

### Acceptance Criteria

Generated harnesses compile/parse for representative fixtures.

Create identity-style tests where possible.

---

## Phase 3 — Process Execution Engine

### Objective

Execute arbitrary broken practice code without freezing the app.

### Implement

```text
ProcessRunner
ProcessKiller
OutputCollector
TempWorkspace
```

Support:

- async subprocess execution
- explicit args
- no shell
- timeout
- cancellation
- stdout capture
- stderr capture
- output limit
- exit code
- cleanup

### Required Tests

- normal program
- nonzero exit
- infinite loop
- runaway stdout
- runaway stderr
- missing executable
- cancellation
- temp cleanup

### Acceptance Criteria

No test can permanently block the backend.

---

## Phase 4 — Java, C++, and Python Runners

### Objective

Complete the language execution layer.

### Implement

```text
PythonRunner
JavaRunner
CppRunner
RunnerRegistry
```

Also:

```text
detectJava
detectPython
detectCpp
```

Behavior:

- compile once where relevant
- run each testcase separately
- read private judge result file
- capture debug stdout/stderr
- normalize verdicts

### Acceptance Criteria

For all three languages, verify:

- accepted solution
- wrong answer
- syntax/compile error
- runtime exception/crash
- timeout
- output-limit failure
- arrays
- matrices
- strings containing escaped characters

---

## Phase 5 — Oracle-Backed Import Verification

### Objective

Reject bad LLM-generated expected outputs before a practice session starts.

### Implement

```text
ReferenceSolutionValidator
```

Use Python reference solutions.

For every imported testcase:

- execute oracle
- deserialize result
- compare to declared expected
- reject mismatch

### Acceptance Criteria

An assessment with one deliberately incorrect expected value must fail import and point to the exact problem/test.

---

## Phase 6 — SQLite and Session Lifecycle

### Objective

Make assessment/session state persistent before building the full UI.

### Implement

- migrations
- repositories
- assessment import persistence
- problem history persistence
- session creation
- code persistence
- submission persistence
- completion/expiration state

Functions should conceptually support:

```text
startSession()
saveCode()
submitProblem()
finishSession()
expireSession()
resumeSession()
```

### Acceptance Criteria

- close/restart backend
- resume active session
- source code remains
- timer still reflects original expiration time

---

## Phase 7 — Assessment UI Shell

### Objective

Make the real assessment interface usable.

### Implement

```text
AssessmentPage
AssessmentShell
AssessmentTimer
ProblemNavigation
ProblemDescription
CodeEditor
LanguageSelector
TestPanel
RunControls
```

Integrate Monaco.

### Important Behavior

- problem switching
- language switching
- autosave
- persisted code restore
- resizable layout if practical
- timer based on `expiresAt`

### Acceptance Criteria

User can navigate all four problems and switch all three languages without losing code.

---

## Phase 8 — Judge/UI Integration

### Objective

Complete the core practice loop.

### Implement

```text
Run → visible tests
Submit → visible + hidden tests
```

UI must display:

- compile error
- runtime error
- timeout
- expected/actual for visible tests
- debug stdout/stderr
- execution time
- hidden test pass/fail without revealing details

### Acceptance Criteria

A user can solve a problem end-to-end in all three languages.

---

## Phase 9 — Import and Generation Experience

### Objective

Make creating a new assessment extremely fast.

### Implement

```text
ImportAssessmentPage
GenerationPromptBuilder
AvoidanceManifestBuilder
AssessmentPaste
ValidationResults
RepairPromptBuilder
```

Workflow:

```text
Copy Prompt
 ↓
external LLM
 ↓
Copy JSON
 ↓
Paste
 ↓
validate
 ↓
Start Assessment
```

### Acceptance Criteria

A valid generated assessment can be pasted and started with only a few interactions.

---

## Phase 10 — Completion and History

### Objective

Finish the end-to-end MVP.

### Implement

- automatic expiry
- final code snapshot
- final judging
- final results screen
- history page
- resume unfinished session
- problem catalog metadata
- duplicate fingerprints

### Acceptance Criteria

A full 4-question assessment can be completed and later viewed in history.

At this point, MVP is complete.

---

# 40. MVP Definition

MVP is complete when the app supports:

- React/Vite browser UI
- Node/Express backend
- Monaco
- Java
- C++
- Python
- environment diagnostics
- JSON assessment import
- JSON Schema validation
- semantic validation
- Python oracle verification
- 4-problem GCA preset
- 70-minute default
- problem switching
- language switching
- code autosave
- native subprocess runner
- visible tests
- hidden tests
- Run
- Submit
- compile errors
- runtime errors
- timeouts
- stdout/stderr capture
- SQLite persistence
- session resume
- persistent timer
- automatic expiration
- final summary
- Copy Generation Prompt
- Copy Repair Prompt

If all of these work reliably, stop adding features and use the application before expanding scope.

---

# 41. Practice-Complete Version

After MVP is stable, consider:

- custom tests
- deterministic generated stress tests
- richer import warnings
- problem history
- previous submission viewing
- assessment performance history
- basic per-topic analytics
- approximate practice score
- configurable assessment templates
- keyboard shortcuts
- fullscreen mode
- multiple generation profiles

---

# 42. Optional Generated Stress Tests

Static JSON is inefficient for very large stress tests.

Later, optionally allow:

```json
{
  "generatedTests": {
    "seed": 912381,
    "generatorLanguage": "python",
    "generatorSource": "...",
    "count": 20
  }
}
```

Import workflow:

```text
generator + seed
       ↓
materialize inputs
       ↓
reference solution
       ↓
materialize expected outputs
       ↓
persist concrete tests
```

The active assessment session should use materialized tests rather than running a generator dynamically.

Do not implement this before MVP.

---

# 43. Testing Strategy

The platform itself must have strong automated coverage.

## Unit Tests

Test:

- TypeSpec validation
- Java type generation
- C++ type generation
- Python signature generation
- source literal generation
- string escaping
- array escaping
- nested arrays
- result serialization
- result comparison
- hidden-result redaction
- timer calculations
- fingerprinting
- assessment semantic validation

---

## Cross-Language Integration Matrix

Run all of these scenarios for Java, C++, and Python:

| Scenario | Expected Verdict |
|---|---|
| valid solution | accepted |
| wrong answer | wrong_answer |
| syntax/compile error | compile_error |
| exception/crash | runtime_error |
| infinite loop | time_limit_exceeded |
| runaway printing | output_limit_exceeded |
| nested arrays | correct |
| escaped strings | correct |

---

## Serialization Round-Trip Test

This is especially important.

Generate representative supported values:

```text
int
long
boolean
string
arrays
matrices
nested arrays
```

Create trivial functions that return inputs.

Verify:

```text
input logical value
==
runner output logical value
```

for all three languages.

This catches many harness bugs.

---

## Import Fixtures

Create fixtures for:

- invalid JSON
- missing problem
- wrong problem count
- wrong number of test arguments
- unsupported type
- duplicate problem ID
- duplicate test ID
- wrong expected type
- broken reference solution
- reference/output mismatch
- missing hidden tests
- malformed execution limits

---

## Timer Tests

Use a fake clock if practical.

Test:

```text
start
30 minutes pass
reload
remaining == 40 minutes
```

Also:

- expire while app is open
- expire while app is closed
- restart after expiration
- finish manually before expiration

---

## UI End-to-End Test

Automate at least one full workflow:

```text
Import valid assessment
Start assessment
Open Q1
Write solution
Run
Submit
Switch Q2
Switch language
Return Q1
Verify code
Finish assessment
View results
```

Treat this as an MVP release gate.

---

# 44. Important Engineering Risks

## 44.1 Harness Correctness

This is probably the hardest subsystem.

A serialization bug can make correct user solutions fail.

Invest heavily in unit and integration tests here.

## 44.2 LLM Test Consistency

Generated test outputs may be wrong.

This is why Python reference-solution verification is required before import.

## 44.3 Process-Tree Termination

Candidate code may spawn child processes.

Implement termination behind a platform abstraction.

A perfect security sandbox is not required, but accidental runaway processes should not remain alive.

## 44.4 Candidate Debug Output

Do not use stdout as the judge protocol.

Use a separate result file from day one.

## 44.5 Escaping Source Literals

Correctly handle:

- quotes
- backslashes
- line breaks
- Unicode
- empty collections
- nested collections

## 44.6 Timing

Track compile time separately from execution time.

Do not include Java/C++ compile time in per-test runtime.

Do not treat Java startup overhead versus native C++ timing as a meaningful algorithm benchmark.

Timeout correctness matters more than microbenchmark precision.

## 44.7 Overengineering

Do not add:

- Docker
- desktop packaging
- language servers
- cloud infrastructure
- authentication
- background distributed workers

until the basic simulator is already useful.

---

# 45. Rejected Alternatives

## Next.js

Rejected.

No need for:

- SSR
- server components
- hosted deployment
- full-stack framework routing conventions

Vite + React is simpler.

## Electron

Rejected for MVP.

A localhost browser application is simpler and already resembles an online coding assessment.

## Tauri

Rejected for MVP.

Native packaging does not solve an immediate product requirement.

## FastAPI

Technically viable.

Rejected only because Node/TypeScript allows the frontend, backend, shared schema, and runner contracts to use the same language.

## Docker-Based Execution

Rejected initially.

Appropriate for hostile multi-user code execution.

Unnecessary complexity for a personal local practice tool.

## Generic stdin/stdout Judge

Rejected.

The application should be centered on CodeSignal-style single-function problems.

## Arbitrary Markdown Imports

Strongly rejected.

Use strict JSON.

## Filesystem-Only Persistence

Rejected.

SQLite better supports:

- assessment history
- unfinished sessions
- source persistence
- duplicate tracking
- submissions
- future analytics

without requiring a database server.

## CodeMirror

Technically acceptable.

Monaco is preferred because bundle size is not important and its IDE-like behavior better fits the assessment experience.

---

# 46. Codex Implementation Instructions

When implementing this specification:

1. **Do not redesign the architecture unless a concrete blocker is found.**
2. **Do not add infrastructure not required by the current phase.**
3. **Complete phases in dependency order.**
4. **Add tests alongside each subsystem.**
5. **Do not skip validation or oracle verification in order to move faster.**
6. **Prefer deterministic generated code over model-generated code wherever possible.**
7. **Keep hidden test data out of frontend API responses.**
8. **Use native subprocess execution for MVP.**
9. **Use explicit process args with `shell: false`.**
10. **Keep the product local and single-user.**
11. **Do not implement cosmetic CodeSignal cloning before core functionality is stable.**
12. **Do not silently swallow runner/import errors. Surface actionable diagnostics.**
13. **Avoid placeholder buttons in completed phases. If a control exists, it should work.**
14. **Preserve unfinished-session state across browser/server restarts.**
15. **Treat runner correctness and assessment correctness as higher priority than UI polish.**

---

# 47. Definition of Done

The project is successful when the following workflow works reliably:

```text
Open app
  ↓
Copy generation prompt
  ↓
Generate four-problem assessment externally
  ↓
Paste JSON
  ↓
Automatic schema + semantic + oracle validation
  ↓
Start 70-minute assessment
  ↓
Navigate Q1–Q4
  ↓
Solve using Java / C++ / Python
  ↓
Run visible tests
  ↓
Submit visible + hidden tests
  ↓
Switch problems without losing code
  ↓
Timer continues correctly
  ↓
Finish or expire
  ↓
View final results
  ↓
Assessment saved in history
```

If this workflow is reliable and pleasant enough that the user prefers it to manually using VS Code for GCA practice, the application has achieved its primary goal.

---

# 48. Final Architectural Directive

Build a **specialized local GCA simulator**, not a generic online judge.

Use:

```text
React + TypeScript + Vite
        ↓
Monaco Editor
        ↓
Local Node/Express API
        ↓
SQLite
        ↓
ExecutionCoordinator
   ┌────┼────┐
   ▼    ▼    ▼
Python Java  C++
Runner Runner Runner
   └────┼────┘
        ↓
Generated function-call harness
        ↓
Per-test subprocess execution
        ↓
Normalized results
```

Two architectural features are non-negotiable:

1. **Deterministic harness/starter-code generation from a small language-neutral type system**
2. **Reference-solution validation of every imported expected test output**

Those two choices prevent the application from turning practice sessions into debugging sessions for malformed LLM-generated assessments.

Keep the first version focused, local, and reliable.

