import type { AssessmentValidationView } from "../api/importClient.js";
import type { EnvironmentView } from "../api/importClient.js";

export type ValidationState =
  | { status: "empty" }
  | { status: "awaiting-trust" }
  | { status: "validating" }
  | { status: "failed"; message: string }
  | { status: "complete"; result: AssessmentValidationView };

export interface ValidationResultsProps {
  state: ValidationState;
  starting: boolean;
  environment: EnvironmentView | undefined;
  onCopyRepairPrompt(): void;
  onStartAssessment(): void;
}

export function ValidationResults({
  state,
  starting,
  environment,
  onCopyRepairPrompt,
  onStartAssessment,
}: ValidationResultsProps) {
  if (state.status === "empty") {
    return (
      <section className="validation-card validation-card--empty" aria-live="polite">
        <span className="validation-icon" aria-hidden="true">{"{}"}</span>
        <div>
          <h2>Ready for JSON</h2>
          <p>Confirm the source, then validation starts automatically after you paste.</p>
        </div>
      </section>
    );
  }
  if (state.status === "awaiting-trust") {
    return (
      <section className="validation-card validation-card--caution" aria-live="polite">
        <span className="validation-icon" aria-hidden="true">!</span>
        <div>
          <h2>Trust confirmation required</h2>
          <p>Confirm the assessment source before its Python reference solutions are executed.</p>
        </div>
      </section>
    );
  }
  if (state.status === "validating") {
    return (
      <section className="validation-card validation-card--working" aria-live="polite">
        <span className="validation-spinner" aria-hidden="true" />
        <div><h2>Validating assessment</h2><p>Checking schema, semantics, and every reference output…</p></div>
      </section>
    );
  }
  if (state.status === "failed") {
    return (
      <section className="validation-card validation-card--invalid" role="alert">
        <span className="validation-icon">!</span>
        <div><h2>Validation could not run</h2><p>{state.message}</p></div>
      </section>
    );
  }

  if (!state.result.valid) {
    return (
      <section className="validation-card validation-card--invalid" aria-live="polite">
        <div className="validation-summary">
          <span className="validation-icon">!</span>
          <div>
            <h2>{state.result.errors.length} validation {state.result.errors.length === 1 ? "error" : "errors"}</h2>
            <p>Correct these issues, then paste the full repaired document.</p>
          </div>
        </div>
        <ol className="validation-errors">
          {state.result.errors.map((error, index) => (
            <li key={`${error.path}:${error.code}:${index}`}>
              <code>{error.path}</code>
              <span>{error.message}</span>
              <small>{error.stage}</small>
            </li>
          ))}
        </ol>
        <button className="button button--secondary" type="button" onClick={onCopyRepairPrompt}>
          Copy Repair Prompt
        </button>
      </section>
    );
  }

  const runners = environment
    ? (["java", "cpp", "python"] as const).map((language) => ({
        language,
        ...environment[language],
      }))
    : [];
  const runnersReady = runners.length === 3 && runners.every(({ available }) => available);

  return (
    <section className="validation-card validation-card--valid" aria-live="polite">
      <div className="validation-summary">
        <span className="validation-icon">✓</span>
        <div>
          <h2>Assessment is ready</h2>
          <p>{state.result.assessment.title} · 4 problems · 70 minutes</p>
        </div>
      </div>
      <ul className="validation-checklist">
        <li><span>✓</span> JSON and schema valid</li>
        <li><span>✓</span> Four-problem semantics valid</li>
        <li><span>✓</span> Reference solutions verified</li>
        {runners.map(({ language, available, installationHint }) => (
          <li key={language} className={available ? "" : "check-missing"}>
            <span>{available ? "✓" : "!"}</span>
            {languageLabel(language)} runner {available ? "available" : "unavailable"}
            {!available && installationHint ? ` — ${installationHint}` : ""}
          </li>
        ))}
        {runners.length === 0 && <li className="check-missing"><span>!</span> Runner diagnostics unavailable</li>}
      </ul>
      {state.result.warnings.length > 0 && (
        <div className="quality-warnings">
          <h3>Quality notes</h3>
          <ul>{state.result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </div>
      )}
      <button
        className="button button--primary start-assessment-button"
        type="button"
        disabled={starting || !runnersReady}
        onClick={onStartAssessment}
      >
        {starting ? "Starting…" : "Start Assessment"} <span aria-hidden="true">→</span>
      </button>
    </section>
  );
}

function languageLabel(language: "java" | "cpp" | "python"): string {
  return language === "cpp" ? "C++" : language.charAt(0).toUpperCase() + language.slice(1);
}
