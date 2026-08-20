import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Language, RunResult } from "@gca-practice/contracts";
import { ASSESSMENT_PRESETS } from "@gca-practice/contracts";
import type { JudgeClient } from "../api/client.js";
import type { CompletionCodeSnapshot } from "../api/importClient.js";
import { AssessmentShell } from "../assessment/AssessmentShell.js";
import { AssessmentTimer } from "../assessment/AssessmentTimer.js";
import { LanguageSelector, supportedLanguages } from "../assessment/LanguageSelector.js";
import { ProblemDescription } from "../assessment/ProblemDescription.js";
import { ProblemNavigation } from "../assessment/ProblemNavigation.js";
import { RunControls } from "../assessment/RunControls.js";
import type {
  AssessmentProblemView,
  AssessmentView,
  ProblemProgress,
} from "../assessment/types.js";
import {
  BrowserCodePersistence,
  type CodeLocation,
  type CodePersistence,
} from "../editor/codePersistence.js";
import { CodeEditor } from "../editor/CodeEditor.js";
import { starterCode } from "../editor/starterCode.js";
import { TestPanel } from "../tests/TestPanel.js";

const defaultPersistence = new BrowserCodePersistence();
const AUTOSAVE_DELAY_MS = 450;

export interface AssessmentPageProps {
  sessionId: string;
  assessment: AssessmentView;
  expiresAt: string;
  persistence?: CodePersistence;
  onFinish?: (code: CompletionCodeSnapshot[]) => void | Promise<void>;
  judgeClient?: JudgeClient;
  availableLanguages?: Language[];
  initialProblemLanguages?: Partial<Record<string, Language>>;
}

interface ExecutionState {
  status: "running" | "complete" | "error";
  mode: "run" | "submit";
  result?: RunResult;
  error?: string;
}

export function AssessmentPage({
  sessionId,
  assessment,
  expiresAt,
  persistence = defaultPersistence,
  onFinish,
  judgeClient,
  availableLanguages = supportedLanguages,
  initialProblemLanguages = {},
}: AssessmentPageProps) {
  const preset = ASSESSMENT_PRESETS[assessment.preset];
  const [activeProblemId, setActiveProblemId] = useState(
    assessment.problems[0]?.id ?? "",
  );
  const [language, setLanguage] = useState<Language>(
    initialProblemLanguages[assessment.problems[0]?.id ?? ""] ??
      availableLanguages[0] ??
      "java",
  );
  const [preferredLanguages, setPreferredLanguages] = useState<Record<string, Language>>(
    () => Object.fromEntries(
      assessment.problems.map((problem) => [
        problem.id,
        initialProblemLanguages[problem.id] ?? availableLanguages[0] ?? "java",
      ]),
    ),
  );
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    loadDrafts(sessionId, assessment.problems, persistence),
  );
  const [sourceRevision, setSourceRevision] = useState(0);
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const [expired, setExpired] = useState(
    () => Date.parse(expiresAt) <= Date.now(),
  );
  const [finishing, setFinishing] = useState(false);
  const [completionError, setCompletionError] = useState<string>();
  const completionStarted = useRef(false);
  const [executions, setExecutions] = useState<Record<string, ExecutionState>>(
    {},
  );

  const activeProblem =
    assessment.problems.find((problem) => problem.id === activeProblemId) ??
    assessment.problems[0]!;

  const currentKey = draftKey(activeProblem.id, language);
  const currentSource =
    drafts[currentKey] ?? starterCode(language, activeProblem.signature);
  const currentExecution = executions[currentKey];
  const problemRunning = Object.entries(executions).some(
    ([key, execution]) =>
      key.startsWith(`${activeProblem.id}:`) && execution.status === "running",
  );
  const currentRef = useRef({
    location: codeLocation(sessionId, activeProblem.id, language),
    source: currentSource,
  });
  currentRef.current = {
    location: codeLocation(sessionId, activeProblem.id, language),
    source: currentSource,
  };

  const persistCurrent = useCallback(() => {
    persistence.save(currentRef.current.location, currentRef.current.source);
    setSaveState("saved");
  }, [persistence]);

  useEffect(() => {
    setSaveState("saving");
    const timeout = window.setTimeout(persistCurrent, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [currentKey, currentSource, persistCurrent]);

  useEffect(() => {
    const saveOnShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        persistCurrent();
      }
    };
    window.addEventListener("keydown", saveOnShortcut);
    return () => window.removeEventListener("keydown", saveOnShortcut);
  }, [persistCurrent]);

  useEffect(
    () => () => {
      // The completion endpoint receives every final snapshot atomically. Avoid
      // racing that transition with a late per-file save after navigation.
      if (!completionStarted.current) {
        persistence.save(currentRef.current.location, currentRef.current.source);
      }
    },
    [persistence],
  );

  const navigationItems = useMemo(
    () =>
      assessment.problems.map((problem) => ({
        id: problem.id,
        slot: problem.slot,
        title: problem.title,
        progress: problemProgress(problem, drafts, executions),
      })),
    [assessment.problems, drafts, executions],
  );

  const switchProblem = (problemId: string) => {
    persistCurrent();
    setActiveProblemId(problemId);
  };
  const switchLanguage = (nextLanguage: Language) => {
    persistCurrent();
    setLanguage(nextLanguage);
    setPreferredLanguages((current) => ({ ...current, [activeProblem.id]: nextLanguage }));
  };
  const updateSource = (source: string) => {
    setDrafts((current) => ({ ...current, [currentKey]: source }));
    setPreferredLanguages((current) => ({ ...current, [activeProblem.id]: language }));
  };
  const resetSource = () => {
    updateSource(starterCode(language, activeProblem.signature));
    setSourceRevision((current) => current + 1);
  };
  const completeAssessment = useCallback(async () => {
    if (completionStarted.current) return;
    completionStarted.current = true;
    setExpired(true);
    setFinishing(true);
    setCompletionError(undefined);
    try {
      const snapshots = assessment.problems.map((problem) => {
        const selectedLanguage = preferredLanguages[problem.id] ?? language;
        return {
          problemId: problem.id,
          language: selectedLanguage,
          source: drafts[draftKey(problem.id, selectedLanguage)] ?? starterCode(selectedLanguage, problem.signature),
        };
      });
      if (onFinish) await onFinish(snapshots);
      else persistCurrent();
    } catch (error) {
      completionStarted.current = false;
      setFinishing(false);
      setCompletionError(
        error instanceof Error ? error.message : "Assessment could not be completed.",
      );
      if (Date.parse(expiresAt) > Date.now()) setExpired(false);
    }
  }, [assessment.problems, drafts, expiresAt, language, onFinish, persistCurrent, preferredLanguages]);
  const execute = async (mode: "run" | "submit") => {
    if (!judgeClient || problemRunning) return;
    persistCurrent();
    const executionKey = currentKey;
    setExecutions((current) => ({
      ...current,
      [executionKey]: { status: "running", mode },
    }));
    try {
      const result = await judgeClient.execute({
        sessionId,
        problemId: activeProblem.id,
        language,
        source: currentSource,
        mode,
      });
      setExecutions((current) => ({
        ...current,
        [executionKey]: { status: "complete", mode, result },
      }));
    } catch (error) {
      setExecutions((current) => ({
        ...current,
        [executionKey]: {
          status: "error",
          mode,
          error: error instanceof Error ? error.message : "Execution failed.",
        },
      }));
    }
  };

  return (
    <AssessmentShell
      header={
        <>
          <div className="assessment-brand">
            <span className="brand-mark" aria-hidden="true">
              G
            </span>
            <div>
              <span>{preset.practiceName}</span>
              <small>{assessment.title}</small>
            </div>
          </div>
          <div className="session-actions">
            <AssessmentTimer
              expiresAt={expiresAt}
              onExpire={() => void completeAssessment()}
              paused={finishing}
            />
            <button
              className="finish-button"
              type="button"
              disabled={finishing}
              onClick={() => void completeAssessment()}
            >
              {finishing
                ? "Finishing…"
                : completionError
                  ? "Retry finish"
                  : "Finish session"}
            </button>
          </div>
        </>
      }
      navigation={
        <ProblemNavigation
          items={navigationItems}
          activeProblemId={activeProblem.id}
          onSelect={switchProblem}
        />
      }
      description={<ProblemDescription problem={activeProblem} />}
      editorToolbar={
        <>
          <div className="editor-toolbar-left">
            <LanguageSelector
              language={language}
              disabled={expired}
              availableLanguages={availableLanguages}
              onChange={switchLanguage}
            />
            <span className={`save-state save-state--${saveState}`}>
              <span aria-hidden="true">{saveState === "saved" ? "✓" : "↻"}</span>
              {saveState === "saved" ? "Saved" : "Saving…"}
            </span>
          </div>
          <button
            className="toolbar-button"
            type="button"
            disabled={expired}
            onClick={resetSource}
          >
            Reset starter
          </button>
        </>
      }
      editor={
        <CodeEditor
          modelPath={`${sessionId}/${activeProblem.id}/solution.${fileExtension(language)}`}
          language={language}
          source={currentSource}
          sourceRevision={sourceRevision}
          disabled={expired}
          onChange={updateSource}
        />
      }
      tests={
        <TestPanel
          tests={activeProblem.visibleTests}
          running={currentExecution?.status === "running"}
          {...(currentExecution?.result
            ? { result: currentExecution.result }
            : {})}
          {...(currentExecution?.error
            ? { error: currentExecution.error }
            : {})}
        />
      }
      controls={
        <>
          {completionError && <span className="completion-error" role="alert">{completionError}</span>}
          <RunControls
            disabled={expired}
            executionAvailable={Boolean(judgeClient) && availableLanguages.includes(language)}
            running={problemRunning}
            onRun={() => void execute("run")}
            onSubmit={() => void execute("submit")}
          />
        </>
      }
    />
  );
}

function loadDrafts(
  sessionId: string,
  problems: AssessmentProblemView[],
  persistence: CodePersistence,
): Record<string, string> {
  const drafts: Record<string, string> = {};
  for (const problem of problems) {
    for (const language of supportedLanguages) {
      const location = codeLocation(sessionId, problem.id, language);
      drafts[draftKey(problem.id, language)] =
        persistence.load(location) ?? starterCode(language, problem.signature);
    }
  }
  return drafts;
}

function problemProgress(
  problem: AssessmentProblemView,
  drafts: Record<string, string>,
  executions: Record<string, ExecutionState>,
): ProblemProgress {
  const submitted = Object.entries(executions)
    .filter(
      ([key, execution]) =>
        key.startsWith(`${problem.id}:`) &&
        execution.mode === "submit" &&
        execution.status === "complete" &&
        execution.result,
    )
    .map(([, execution]) => execution.result!);
  if (submitted.some((result) => result.verdict === "accepted")) {
    return "solved";
  }
  if (submitted.length > 0) return "partial";
  return supportedLanguages.some(
    (language) =>
      drafts[draftKey(problem.id, language)] !==
      starterCode(language, problem.signature),
  )
    ? "written"
    : "untouched";
}

function codeLocation(
  sessionId: string,
  problemId: string,
  language: Language,
): CodeLocation {
  return { sessionId, problemId, language };
}

function draftKey(problemId: string, language: Language): string {
  return `${problemId}:${language}`;
}

function fileExtension(language: Language): string {
  switch (language) {
    case "java":
      return "java";
    case "cpp":
      return "cpp";
    case "python":
      return "py";
  }
}
