import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ApiImportWorkflowClient,
  type HistoryView,
  type ImportWorkflowClient,
} from "../api/importClient.js";

const defaultClient = new ApiImportWorkflowClient();

export function HistoryPage({ client = defaultClient }: { client?: ImportWorkflowClient }) {
  const [history, setHistory] = useState<HistoryView>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    void client.history().then(
      (value) => { if (active) setHistory(value); },
      (reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "History could not be loaded."); },
    );
    return () => { active = false; };
  }, [client]);

  return (
    <main className="list-page">
      <header className="simple-header">
        <Link className="home-brand import-brand" to="/"><span className="brand-mark">G</span><span>GCA Practice</span></Link>
        <Link className="button button--primary" to="/import">New assessment</Link>
      </header>
      <div className="list-page-content">
        <p className="home-eyebrow">Local archive</p><h1>Assessment history</h1>
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
                <Link className="history-row" key={result.sessionId} to={`/results/${result.sessionId}`}>
                  <div><strong>{result.assessmentTitle}</strong><span>{formatDate(result.finishedAt ?? result.startedAt)} · {result.status}</span></div>
                  <span>{result.problemsSolved}/{result.problemCount} solved</span><b>View →</b>
                </Link>
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
