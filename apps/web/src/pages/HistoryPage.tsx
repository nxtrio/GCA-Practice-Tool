import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ApiImportWorkflowClient,
  type AssessmentResultView,
  type HistoryView,
  type ImportWorkflowClient,
} from "../api/importClient.js";

const defaultClient = new ApiImportWorkflowClient();

export function HistoryPage({ client = defaultClient }: { client?: ImportWorkflowClient }) {
  const navigate = useNavigate();
  const [history, setHistory] = useState<HistoryView>();
  const [error, setError] = useState<string>();
  const [restartingSessionId, setRestartingSessionId] = useState<string>();
  useEffect(() => {
    let active = true;
    void client.history().then(
      (value) => { if (active) setHistory(value); },
      (reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "History could not be loaded."); },
    );
    return () => { active = false; };
  }, [client]);

  const redoAssessment = async (result: AssessmentResultView) => {
    setError(undefined);
    setRestartingSessionId(result.sessionId);
    try {
      const session = await client.startSession(result.assessmentId);
      navigate(`/assessment/${session.id}`);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "The assessment could not be restarted.");
      setRestartingSessionId(undefined);
    }
  };

  return (
    <main className="list-page">
      <header className="simple-header">
        <Link className="home-brand import-brand" to="/"><span className="brand-mark">G</span><span>GCA Practice</span></Link>
        <Link className="button button--primary" to="/import">New assessment</Link>
      </header>
      <div className="list-page-content">
        <p className="home-eyebrow">Local archive</p><h1>Assessment history</h1>
        <p className="history-intro">Review a completed session or start a fresh attempt with the same questions.</p>
        {error && <p className="page-error" role="alert">{error}</p>}
        {!history && !error && <p className="muted-copy">Loading history…</p>}
        {history && (
          <>
            <section className="history-section">
              <h2>Unfinished</h2>
              {history.unfinished.length === 0 ? <p className="empty-list">No active assessment.</p> : history.unfinished.map((session) => (
                <Link className="history-row" key={session.sessionId} to={`/assessment/${session.sessionId}`}>
                  <div><strong>{session.assessmentTitle}</strong><span>Started {formatDate(session.startedAt)}</span></div>
                  <span>{session.problemsSolved}/{session.problemCount} solved</span><b>Resume →</b>
                </Link>
              ))}
            </section>
            <section className="history-section">
              <h2>Completed</h2>
              {history.completed.length === 0 ? <p className="empty-list">Completed assessments will appear here.</p> : history.completed.map((result) => (
                <article className="history-row history-row--completed" key={result.sessionId}>
                  <div><strong>{result.assessmentTitle}</strong><span>{formatDate(result.finishedAt ?? result.startedAt)} · {result.status}</span></div>
                  <span>{result.problemsSolved}/{result.problemCount} solved</span>
                  <div className="history-row-actions">
                    <Link className="button button--secondary" to={`/results/${result.sessionId}`}>View results</Link>
                    <button
                      aria-label={`Redo ${result.assessmentTitle}`}
                      className="button button--primary"
                      disabled={restartingSessionId !== undefined}
                      onClick={() => { void redoAssessment(result); }}
                      type="button"
                    >
                      {restartingSessionId === result.sessionId ? "Starting…" : "Redo assessment"}
                    </button>
                  </div>
                </article>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
