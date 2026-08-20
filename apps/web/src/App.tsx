import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { demoAssessment } from "./assessment/demoAssessment.js";
import { ApiJudgeClient } from "./api/client.js";
import {
  ApiImportWorkflowClient,
  type ResumedSessionView,
  type EnvironmentView,
} from "./api/importClient.js";
import {
  ApiBackedCodePersistence,
  MemoryCodePersistence,
} from "./editor/codePersistence.js";
import { HomePage } from "./pages/HomePage.js";

const AssessmentPage = lazy(async () => {
  const [{ AssessmentPage: Page }, { configureLocalMonaco }] =
    await Promise.all([
      import("./pages/AssessmentPage.js"),
      import("./editor/monacoEnvironment.js"),
    ]);
  configureLocalMonaco();
  return { default: Page };
});
const ImportAssessmentPage = lazy(async () => ({
  default: (await import("./pages/ImportAssessmentPage.js")).ImportAssessmentPage,
}));
const ResultsPage = lazy(async () => ({ default: (await import("./pages/ResultsPage.js")).ResultsPage }));
const HistoryPage = lazy(async () => ({ default: (await import("./pages/HistoryPage.js")).HistoryPage }));
const SettingsPage = lazy(async () => ({ default: (await import("./pages/SettingsPage.js")).SettingsPage }));
const importClient = new ApiImportWorkflowClient();
const judgeClient = new ApiJudgeClient();

const legacyDemoExpirationKey = "gca-practice:demo-session:expires-at";
const legacyDemoCodePrefix = "gca-practice:code:demo-session:";
let demoInstance = 0;

function SessionAssessmentRoute() {
  const { sessionId = "" } = useParams();
  const navigate = useNavigate();
  const [resumed, setResumed] = useState<ResumedSessionView>();
  const [environment, setEnvironment] = useState<EnvironmentView>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    setResumed(undefined);
    setError(undefined);
    void (async () => {
      try {
        const [value, toolchains] = await Promise.all([
          importClient.resumeSession(sessionId),
          importClient.environment(),
        ]);
        if (!active) return;
        if (value.session.status === "expired") {
          await importClient.finishSession(sessionId, latestCodeSnapshots(value.code));
          if (active) navigate(`/results/${sessionId}`, { replace: true });
          return;
        }
        if (active) { setResumed(value); setEnvironment(toolchains); }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Session could not be loaded.");
      }
    })();
    return () => { active = false; };
  }, [navigate, sessionId]);

  const persistence = useMemo(
    () => resumed ? new ApiBackedCodePersistence(importClient, resumed.code) : undefined,
    [resumed],
  );

  if (error) {
    return (
      <main className="workspace-loading workspace-error">
        <p>{error}</p><Link to="/">Create another assessment</Link>
      </main>
    );
  }
  if (!resumed || !persistence) {
    return <div className="workspace-loading">Opening workspace…</div>;
  }
  if (resumed.session.status === "completed" || resumed.session.status === "expired") {
    return <Navigate to={`/results/${resumed.session.id}`} replace />;
  }
  if (!resumed.session.expiresAt) {
    return <div className="workspace-loading">This session has no expiration time.</div>;
  }

  return (
    <>
      <Suspense fallback={<div className="workspace-loading">Opening editor…</div>}>
        <AssessmentPage
          sessionId={resumed.session.id}
          assessment={resumed.assessment}
          expiresAt={resumed.session.expiresAt}
          persistence={persistence}
          judgeClient={judgeClient}
          availableLanguages={environment
            ? (["java", "cpp", "python"] as const).filter((language) => environment[language].available)
            : []}
          initialProblemLanguages={Object.fromEntries(
            latestCodeSnapshots(resumed.code).map(({ problemId, language }) => [problemId, language]),
          )}
          initialSubmissions={resumed.submissions ?? []}
          onFinish={async (code) => {
            await importClient.finishSession(resumed.session.id, code);
            navigate(`/results/${resumed.session.id}`);
          }}
        />
      </Suspense>
    </>
  );
}

function latestCodeSnapshots(code: ResumedSessionView["code"]) {
  const latest = new Map<string, ResumedSessionView["code"][number]>();
  for (const candidate of code) {
    const current = latest.get(candidate.problemId);
    if (!current || candidate.updatedAt > current.updatedAt) latest.set(candidate.problemId, candidate);
  }
  return [...latest.values()].map(({ problemId, language, source }) => ({
    problemId,
    language,
    source,
  }));
}

function DemoAssessmentRoute() {
  const navigate = useNavigate();
  const [sessionId] = useState(createDemoSessionId);
  const [expiresAt] = useState(createDemoExpiration);
  const persistence = useMemo(() => new MemoryCodePersistence(), []);

  useEffect(() => clearLegacyDemoState(), []);

  return (
    <Suspense fallback={<div className="workspace-loading">Opening workspace…</div>}>
      <AssessmentPage
        sessionId={sessionId}
        assessment={demoAssessment}
        expiresAt={expiresAt}
        persistence={persistence}
        onFinish={() => navigate("/", { replace: true })}
      />
    </Suspense>
  );
}

function createDemoSessionId(): string {
  demoInstance += 1;
  return `demo-session-${demoInstance}`;
}

function createDemoExpiration(): string {
  return new Date(
    Date.now() + demoAssessment.durationSeconds * 1_000,
  ).toISOString();
}

function clearLegacyDemoState(): void {
  try {
    const keys = Array.from(
      { length: window.localStorage.length },
      (_, index) => window.localStorage.key(index),
    );
    for (const key of keys) {
      if (
        key === legacyDemoExpirationKey ||
        key?.startsWith(legacyDemoCodePrefix)
      ) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // The demo remains fully usable in memory when browser storage is blocked.
  }
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/import"
        element={<Suspense fallback={<div className="workspace-loading">Opening importer…</div>}><ImportAssessmentPage /></Suspense>}
      />
      <Route path="/assessment/demo" element={<DemoAssessmentRoute />} />
      <Route path="/assessment/:sessionId" element={<SessionAssessmentRoute />} />
      <Route path="/results/:sessionId" element={<Suspense fallback={<div className="workspace-loading">Loading results…</div>}><ResultsPage /></Suspense>} />
      <Route path="/history" element={<Suspense fallback={<div className="workspace-loading">Loading history…</div>}><HistoryPage /></Suspense>} />
      <Route path="/settings" element={<Suspense fallback={<div className="workspace-loading">Loading settings…</div>}><SettingsPage /></Suspense>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
