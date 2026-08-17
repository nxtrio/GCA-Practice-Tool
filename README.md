# Coding Assessment Practice

A local, no-account coding-assessment simulator with strict assessment validation and native Java/C++/Python execution. Practice either a classic GCA format or an implementation-heavy Roblox-oriented format without question-bank spoilers or platform noise.

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
- Prompt-assisted generation with upload-or-paste JSON import and strict reference-solution validation
- Preset-aware generation history that avoids repeating concepts within the selected format
- Monaco editor with Java, C++, and Python runners
- Separate Run and Submit flows; hidden test details stay private during sessions
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

This is an unofficial project and is not affiliated with or endorsed by Roblox or CodeSignal. Its generation prompts require original practice problems—not copied, leaked, or reconstructed assessment questions. See the [base implementation specification](implementation-plans/gca_practice_codex_implementation_spec.md), [preset expansion specification](implementation-plans/assessment_presets_roblox_expansion.md), [contribution guide](CONTRIBUTING.md), and [MIT license](LICENSE).
