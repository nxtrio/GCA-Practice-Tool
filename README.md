# Coding Assessment Practice

A local, no-account coding-assessment simulator with strict assessment validation and native Java/C++/Python execution. Practice four formats—GCA, Roblox-oriented, IMC SWE, and CTC SWE—without question-bank spoilers or platform noise.

## Start

Requires Node.js 22+ and npm 10+. Python 3 is required to validate imported assessments; install a JDK and C++ compiler to enable Java and C++ submissions.

```sh
git clone https://github.com/nxtrio/GCA-Practice-Tool.git
cd GCA-Practice-Tool
npm start
```

`npm start` installs dependencies on the first run, starts the local API and web app, and opens [http://localhost:5173](http://localhost:5173). Press `Ctrl+C` to stop both. Use `npm start -- --no-open` to skip opening the browser. Set `GCA_WEB_PORT` or `GCA_API_PORT` if the default ports are occupied.

> [!WARNING]
> This is not a security sandbox. Validating imported JSON executes its Python reference solutions, and running an assessment executes your Java, C++, or Python code locally. Either can access files and the network or spawn processes. Only use code you trust; see [Security](SECURITY.md).

## What you get

- GCA Practice: 4 questions in 70 minutes
- Roblox Coding Assessment Practice: 2 questions in 50 minutes, with implementation/matrix-biased generation
- IMC Software Engineering Practice: 2 questions in 120 minutes, with HackerRank-style algorithms/data-structures practice at Medium-Hard / Hard difficulty
- CTC Software Engineering Practice: 3 questions in 180 minutes, with Codility-style implementation, logic, state-processing, and scalable problem-solving practice
- Prompt-assisted generation with upload-or-paste JSON import and strict reference-solution validation
- Preset-aware generation history that avoids repeating concepts within the selected format
- Monaco editor with Java, C++, and Python runners
- Separate Run and Submit flows; IMC also exposes function-based custom input tests, while hidden test details stay private during sessions
- Automatic completion, results, history, one-click assessment retries, environment checks, and editor settings
- Privacy-safe JSON export for LLM readiness analysis and practice recommendations
- Local SQLite persistence—your assessments and code stay on your machine

| Import and validate | Solve in the assessment workspace |
| --- | --- |
| ![Assessment import](docs/screenshots/import.png) | ![Assessment workspace](docs/screenshots/assessment.png) |

![Assessment results](docs/screenshots/results.png)

## Development

```sh
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Data is stored under `apps/server/data/` and is ignored by Git.

This is an unofficial project and is not affiliated with or endorsed by Roblox, CodeSignal, IMC, HackerRank, Chicago Trading Company (CTC), or Codility. The IMC and CTC formats model broad publicly reported assessment characteristics; their durations, question counts, and difficulty profiles are approximations and may change. Every generation prompt requires original practice problems—not copied, leaked, paraphrased, or reconstructed assessment questions. See the [base implementation specification](implementation-plans/gca_practice_codex_implementation_spec.md), [Roblox preset expansion specification](implementation-plans/assessment_presets_roblox_expansion.md), [IMC preset specification](implementation-plans/imc_swe_hackerrank_practice_codex_prompt.md), [CTC preset specification](implementation-plans/ctc_swe_codility_practice_codex_prompt.md), [contribution guide](CONTRIBUTING.md), and [MIT license](LICENSE).
