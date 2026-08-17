import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ASSESSMENT_PRESETS } from "@gca-practice/contracts";
import {
  ApiImportWorkflowClient,
  type AssessmentResultView,
  type ImportWorkflowClient,
} from "../api/importClient.js";
import { formatRemainingTime } from "../assessment/AssessmentTimer.js";

const defaultClient = new ApiImportWorkflowClient();

export function ResultsPage({ client = defaultClient }: { client?: ImportWorkflowClient }) {
  const { sessionId = "" } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState<AssessmentResultView>();
  const [error, setError] = useState<string>();
  const [restartError, setRestartError] = useState<string>();
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    let active = true;
    void client.results(sessionId).then(
      (value) => { if (active) setResult(value); },
      (reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Results could not be loaded.");
      },
    );
    return () => { active = false; };
  }, [client, sessionId]);

  if (error) return <PageError message={error} />;
  if (!result) return <div className="workspace-loading">Calculating results…</div>;
  const preset = ASSESSMENT_PRESETS[result.preset];

  const redoAssessment = async () => {
    setRestartError(undefined);
    setRestarting(true);
    try {
      const session = await client.startSession(result.assessmentId);
      navigate(`/assessment/${session.id}`);
    } catch (reason: unknown) {
      setRestartError(reason instanceof Error ? reason.message : "The assessment could not be restarted.");
      setRestarting(false);
    }
  };

  return (
    <main className="results-page">
      <header className="simple-header">
        <Link className="home-brand import-brand" to="/"><span className="brand-mark" aria-hidden="true">G</span><span>{preset.practiceName}</span></Link>
        <Link to="/history">Assessment history</Link>
      </header>
      <section className="results-hero">
        <p className="home-eyebrow">{preset.displayName} · {result.status === "expired" ? "Time expired" : "Assessment complete"}</p>
        <h1>{result.assessmentTitle}</h1>
        <p>Your final snapshots and submissions are saved locally.</p>
      </section>
      <section className="score-grid" aria-label="Assessment summary">
        <Score label="Problems fully solved" value={`${result.problemsSolved} / ${result.problemCount}`} />
        <Score label="Tests passed" value={`${result.testsPassed} / ${result.testsTotal}`} />
        <Score label="Time used" value={formatRemainingTime(result.timeUsedMs)} />
        <Score label="Time remaining" value={formatRemainingTime(result.timeRemainingMs)} />
      </section>
      <section className="problem-results">
        <div className="results-section-heading"><h2>Problem breakdown</h2><span>Latest judged snapshot</span></div>
        {result.problems.map((problem) => (
          <article className="problem-result-row" key={problem.problemId} data-verdict={problem.verdict}>
            <span className="result-slot">Q{problem.slot}</span>
            <span className="result-verdict" aria-hidden="true">{problem.verdict === "accepted" ? "✓" : problem.verdict === "not_attempted" ? "—" : "●"}</span>
            <div><h3>{problem.title}</h3><p>{verdictLabel(problem.verdict)}{problem.language ? ` · ${languageLabel(problem.language)}` : ""}</p></div>
            <strong>{problem.passed}/{problem.total}</strong>
          </article>
        ))}
      </section>
      <div className="results-actions">
        <button
          className="button button--primary"
          disabled={restarting}
          onClick={() => { void redoAssessment(); }}
          type="button"
        >
          {restarting ? "Starting…" : "Redo this assessment"}
        </button>
        <a
          className="button button--secondary"
          href={`/api/sessions/${encodeURIComponent(result.sessionId)}/export`}
          download={`${filenameSlug(result.assessmentTitle)}-readiness-analysis.json`}
        >
          Export analysis JSON
        </a>
        <Link className="button button--secondary" to="/">Start another assessment</Link>
        <Link className="button button--secondary" to="/history">View history</Link>
        {restartError && <p className="results-action-error" role="alert">{restartError}</p>}
      </div>
    </main>
  );
}

function Score({ label, value }: { label: string; value: string }) {
  return <article><span>{label}</span><strong>{value}</strong></article>;
}

function verdictLabel(verdict: AssessmentResultView["problems"][number]["verdict"]): string {
  return verdict.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function languageLabel(language: "java" | "cpp" | "python"): string {
  return language === "cpp" ? "C++" : language.charAt(0).toUpperCase() + language.slice(1);
}

function filenameSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "assessment";
}

function PageError({ message }: { message: string }) {
  return <main className="workspace-loading workspace-error"><p>{message}</p><Link to="/history">Return to history</Link></main>;
}
