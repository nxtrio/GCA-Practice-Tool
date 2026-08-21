import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ASSESSMENT_PRESETS,
  isAssessmentPresetId,
  type AssessmentPresetId,
} from "@gca-practice/contracts";
import {
  ApiImportWorkflowClient,
  type EnvironmentView,
  type ImportWorkflowClient,
} from "../api/importClient.js";
import { GenerationPromptBuilder } from "../generation/GenerationPromptBuilder.js";
import { RepairPromptBuilder } from "../generation/RepairPromptBuilder.js";
import { AssessmentPaste } from "../import/AssessmentPaste.js";
import {
  ValidationResults,
  type ValidationState,
} from "../import/ValidationResults.js";

const defaultClient = new ApiImportWorkflowClient();
const VALIDATION_DELAY_MS = 500;

export interface ImportAssessmentPageProps {
  client?: ImportWorkflowClient;
}

export function ImportAssessmentPage({
  client = defaultClient,
}: ImportAssessmentPageProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedPreset = searchParams.get("preset");
  const presetId: AssessmentPresetId = isAssessmentPresetId(requestedPreset)
    ? requestedPreset
    : "gca";
  const preset = ASSESSMENT_PRESETS[presetId];
  const [source, setSource] = useState("");
  const [state, setState] = useState<ValidationState>({ status: "empty" });
  const [problemHistory, setProblemHistory] = useState<Awaited<ReturnType<ImportWorkflowClient["problemHistory"]>>>([]);
  const [copyNotice, setCopyNotice] = useState<string>();
  const [starting, setStarting] = useState(false);
  const [trustedSource, setTrustedSource] = useState(false);
  const [environment, setEnvironment] = useState<EnvironmentView>();
  const validationSequence = useRef(0);
  const generationBuilder = useMemo(() => new GenerationPromptBuilder(presetId), [presetId]);
  const repairBuilder = useMemo(() => new RepairPromptBuilder(), []);
  const historyPrompt = useMemo(
    () => generationBuilder.build(problemHistory),
    [generationBuilder, problemHistory],
  );

  useEffect(() => {
    let active = true;
    void client.problemHistory(presetId).then(
      (history) => {
        if (active) setProblemHistory(history);
      },
      () => {
        // Prompt generation remains useful when history cannot be loaded.
      },
    );
    return () => { active = false; };
  }, [client, presetId]);

  useEffect(() => {
    let active = true;
    void client.environment().then(
      (value) => { if (active) setEnvironment(value); },
      () => { if (active) setEnvironment(undefined); },
    );
    return () => { active = false; };
  }, [client]);

  useEffect(() => {
    const sequence = ++validationSequence.current;
    if (source.trim().length === 0) {
      setState({ status: "empty" });
      return;
    }
    if (!trustedSource) {
      setState({ status: "awaiting-trust" });
      return;
    }
    setState({ status: "validating" });
    const timeout = window.setTimeout(() => {
      void client.validateAssessment(source).then(
        (result) => {
          if (sequence === validationSequence.current) {
            setState({ status: "complete", result });
          }
        },
        (error: unknown) => {
          if (sequence === validationSequence.current) {
            setState({
              status: "failed",
              message: error instanceof Error ? error.message : "Validation failed.",
            });
          }
        },
      );
    }, VALIDATION_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [client, source, trustedSource]);

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyNotice(`${label} copied`);
    } catch {
      setCopyNotice("Clipboard access was blocked. Select and copy the text manually.");
    }
  };

  const copyRepairPrompt = () => {
    if (state.status !== "complete" || state.result.valid) return;
    void copy(repairBuilder.build(state.result.errors), "Repair prompt");
  };

  const startAssessment = async () => {
    if (state.status !== "complete" || !state.result.valid || starting) return;
    setStarting(true);
    try {
      const assessment = await client.importAssessment(state.result.validationId);
      const session = await client.startSession(assessment.id);
      navigate(`/assessment/${session.id}`);
    } catch (error) {
      setState({
        status: "failed",
        message: error instanceof Error ? error.message : "Assessment could not start.",
      });
      setStarting(false);
    }
  };

  return (
    <main className="import-page">
      <header className="import-header">
        <Link className="home-brand import-brand" to="/">
          <span className="brand-mark" aria-hidden="true">G</span>
          <span>Coding Practice</span>
        </Link>
        <span className="import-step">New {preset.shortName} assessment</span>
      </header>
      <div className="import-layout">
        <section className="import-intro">
          <p className="home-eyebrow">{preset.displayName}</p>
          <h1>New {preset.practiceName}.</h1>
          <p>
            {preset.problemCount} questions · {preset.durationSeconds / 60} minutes. Copy a purpose-built prompt into your preferred LLM, then upload or
            paste its JSON response here. The local validator checks structure and runs
            every Python reference answer before anything is saved.
          </p>
          {preset.id === "imc" && (
            <p className="preset-disclaimer">
              Unofficial HackerRank-style SWE simulation. This format is based on broad public reports and is not affiliated with or guaranteed by IMC or HackerRank.
            </p>
          )}
          {preset.id === "ctc" && (
            <p className="preset-disclaimer">
              Unofficial Codility-style SWE simulation based on broad public reports. It is not affiliated with or guaranteed by CTC or Codility.
            </p>
          )}
          <div className="workflow-line" aria-label="Import workflow">
            <span className="workflow-active">1</span><b>Copy prompt</b><i />
            <span>2</span><b>Add JSON</b><i />
            <span>3</span><b>Start</b>
          </div>
          <button
            className="button button--primary copy-prompt-button"
            type="button"
            onClick={() => void copy(historyPrompt, "Generation prompt")}
          >
            Copy {preset.shortName} Generation Prompt
          </button>
          <details className="prompt-preview">
            <summary>Preview generation prompt</summary>
            <pre>{historyPrompt}</pre>
          </details>
        </section>
        <section className="import-workspace">
          <aside className="execution-warning" aria-labelledby="execution-warning-title">
            <div>
              <strong id="execution-warning-title">Imported code runs on this computer</strong>
              <p>
                Validation executes every Python reference solution in the selected JSON.
                Runner processes receive a reduced environment, but native execution
                is not sandboxed and can access files, the network, or other processes.
              </p>
            </div>
            <label>
              <input
                type="checkbox"
                checked={trustedSource}
                disabled={starting}
                onChange={(event) => setTrustedSource(event.target.checked)}
              />
              I trust this assessment source and allow its reference code to run
            </label>
          </aside>
          <AssessmentPaste value={source} disabled={starting} onChange={setSource} />
          <ValidationResults
            state={state}
            starting={starting}
            environment={environment}
            expectedPreset={preset}
            onCopyRepairPrompt={copyRepairPrompt}
            onStartAssessment={() => void startAssessment()}
          />
        </section>
      </div>
      {copyNotice && <div className="copy-notice" role="status">{copyNotice}</div>}
    </main>
  );
}
