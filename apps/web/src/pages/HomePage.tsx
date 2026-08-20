import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ASSESSMENT_PRESETS } from "@gca-practice/contracts";
import type { AssessmentPresetId } from "@gca-practice/contracts";
import {
  ApiImportWorkflowClient,
  type EnvironmentView,
  type HistoryView,
  type ImportWorkflowClient,
} from "../api/importClient.js";

const defaultClient = new ApiImportWorkflowClient();

export function HomePage({ client = defaultClient }: { client?: ImportWorkflowClient }) {
  const [history, setHistory] = useState<HistoryView>();
  const [environment, setEnvironment] = useState<EnvironmentView>();

  useEffect(() => {
    let active = true;
    void Promise.all([client.history(), client.environment()]).then(
      ([nextHistory, nextEnvironment]) => {
        if (active) { setHistory(nextHistory); setEnvironment(nextEnvironment); }
      },
      () => { /* The primary create flow remains available offline. */ },
    );
    return () => { active = false; };
  }, [client]);

  const active = history?.unfinished[0];
  return (
    <main className="dashboard-page">
      <header className="simple-header dashboard-header">
        <div className="home-brand"><span className="brand-mark" aria-hidden="true">G</span><span>Coding Assessment Practice</span></div>
        <nav><Link to="/history">History</Link><Link to="/settings">Settings</Link></nav>
      </header>
      <section className="dashboard-hero">
        <p className="home-eyebrow">Local assessment workspace</p>
        <h1>Practice the decisions,<br />not the setup.</h1>
        <p>Choose a format, generate original questions, and take a focused coding assessment entirely on this device.</p>
        <div className="preset-grid" aria-label="Assessment presets">
          <PresetCard preset="gca" description="Classic progression from fundamentals through optimization." />
          <PresetCard preset="roblox" description="Implementation-heavy practice with a matrix and simulation bias." />
          <PresetCard preset="imc" description="Unofficial HackerRank-style algorithms and data structures practice at Medium-Hard / Hard difficulty." />
        </div>
        <div className="home-actions">
          {active && <Link className="resume-button" to={`/assessment/${active.sessionId}`}>Resume {ASSESSMENT_PRESETS[active.preset].shortName}: {active.assessmentTitle} <span>{active.problemsSolved}/{active.problemCount}</span></Link>}
          <Link className="demo-link" to="/assessment/demo">Open demo workspace</Link>
        </div>
      </section>
      <section className="dashboard-grid">
        <div className="dashboard-panel">
          <div className="panel-title"><div><p className="panel-kicker">Recent</p><h2>Assessment history</h2></div><Link to="/history">View all</Link></div>
          {!history || history.completed.length === 0 ? <p className="empty-list">No completed assessments yet.</p> : history.completed.slice(0, 3).map((result) => (
            <Link className="dashboard-history-row" key={result.sessionId} to={`/results/${result.sessionId}`}>
              <div><strong>{result.assessmentTitle}</strong><span>{ASSESSMENT_PRESETS[result.preset].shortName} · {result.status} · {new Date(result.finishedAt ?? result.startedAt).toLocaleDateString()}</span></div>
              <b>{result.problemsSolved}/{result.problemCount}</b>
            </Link>
          ))}
        </div>
        <div className="dashboard-panel">
          <div className="panel-title"><div><p className="panel-kicker">Environment</p><h2>Language runners</h2></div></div>
          {environment ? (["java", "cpp", "python"] as const).map((language) => {
            const tool = environment[language];
            return <div className="toolchain-row" key={language} data-available={tool.available}><span>{tool.available ? "✓" : "!"}</span><div><strong>{language === "cpp" ? "C++" : language.charAt(0).toUpperCase() + language.slice(1)}</strong><small>{tool.available ? tool.version : tool.installationHint}</small></div></div>;
          }) : <p className="empty-list">Start the local API to view diagnostics.</p>}
        </div>
      </section>
    </main>
  );
}

function PresetCard({
  preset: presetId,
  description,
}: {
  preset: AssessmentPresetId;
  description: string;
}) {
  const preset = ASSESSMENT_PRESETS[presetId];
  return (
    <article className="preset-card" data-preset={preset.id}>
      <span>{preset.shortName}</span>
      <h2>{preset.displayName}</h2>
      <p>{preset.problemCount} Questions · {preset.durationSeconds / 60} Minutes</p>
      <small>{description}</small>
      <Link className="launch-button" to={`/import?preset=${preset.id}`}>
        Practice {preset.shortName} <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}
