import type {
  ExecutionVerdict,
  RunResult,
  TestCase,
  VisibleTestResult,
} from "@gca-practice/contracts";

export interface TestPanelProps {
  tests: TestCase[];
  result?: RunResult;
  running?: boolean;
  error?: string;
}

const verdictLabels: Record<ExecutionVerdict, string> = {
  accepted: "Passed",
  wrong_answer: "Wrong answer",
  compile_error: "Compile error",
  runtime_error: "Runtime error",
  time_limit_exceeded: "Time limit exceeded",
  output_limit_exceeded: "Output limit exceeded",
  internal_error: "Internal error",
};

export function TestPanel({
  tests,
  result,
  running = false,
  error,
}: TestPanelProps) {
  const visibleResults = new Map(
    (result?.tests.filter(
      (test): test is VisibleTestResult => test.visibility === "visible",
    ) ?? []).map((test) => [test.testId, test]),
  );
  const hiddenResults =
    result?.tests.filter((test) => test.visibility === "hidden") ?? [];

  return (
    <section className="test-panel" aria-labelledby="tests-heading">
      <div className="test-panel-heading">
        <div>
          <p className="panel-kicker">Validation</p>
          <h2 id="tests-heading">Test results</h2>
        </div>
        <ResultSummary result={result} running={running} error={error} />
      </div>

      {error && <div className="execution-error" role="alert">{error}</div>}

      <div className="test-cases">
        {tests.map((test, index) => {
          const execution = visibleResults.get(test.id);
          return (
            <article
              className="test-case"
              data-verdict={execution?.verdict ?? "idle"}
              key={test.id}
            >
              <div className="test-case-title">
                <VerdictMark verdict={execution?.verdict} />
                <strong>Visible test {index + 1}</strong>
                <span>{execution ? verdictLabels[execution.verdict] : test.category}</span>
              </div>
              <dl>
                <ResultRow label="Input" value={test.arguments} />
                <ResultRow label="Expected" value={execution?.expected ?? test.expected} />
                {execution?.actual !== undefined && (
                  <ResultRow label="Actual" value={execution.actual} />
                )}
                {execution && (
                  <div>
                    <dt>Time</dt>
                    <dd>{execution.executionTimeMs} ms</dd>
                  </div>
                )}
              </dl>
              {execution?.message && (
                <p className="execution-message">{execution.message}</p>
              )}
              <DebugOutput label="stdout" value={execution?.stdout} />
              <DebugOutput label="stderr" value={execution?.stderr} />
            </article>
          );
        })}

        {hiddenResults.map((execution, index) => (
          <article
            className="test-case test-case--hidden"
            data-verdict={execution.verdict}
            key={`hidden-${index}`}
          >
            <div className="test-case-title">
              <VerdictMark verdict={execution.verdict} />
              <strong>Hidden test {index + 1}</strong>
              <span>{verdictLabels[execution.verdict]}</span>
            </div>
            <p className="hidden-result-detail">
              {execution.executionTimeMs} ms · testcase details are private
            </p>
          </article>
        ))}
      </div>
      {hiddenResults.length === 0 && (
        <p className="hidden-test-note">
          Hidden test details stay private and are evaluated only on Submit.
        </p>
      )}
    </section>
  );
}

function ResultSummary({
  result,
  running,
  error,
}: {
  result: RunResult | undefined;
  running: boolean;
  error: string | undefined;
}) {
  if (running) return <span className="test-count test-count--running">Running</span>;
  if (error) return <span className="test-count test-count--failed">Failed</span>;
  if (!result) return <span className="test-count">Ready</span>;
  return (
    <span className={`test-count test-count--${result.verdict}`}>
      {result.passed}/{result.total} passed · {verdictLabels[result.verdict]}
    </span>
  );
}

function VerdictMark({ verdict }: { verdict: ExecutionVerdict | undefined }) {
  return (
    <span className="test-status" aria-label={verdict ? verdictLabels[verdict] : "Not run"}>
      {verdict === "accepted" ? "✓" : verdict ? "×" : "·"}
    </span>
  );
}

function ResultRow({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd><code>{JSON.stringify(value)}</code></dd>
    </div>
  );
}

function DebugOutput({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return null;
  return (
    <details className="debug-output" open={label === "stderr"}>
      <summary>{label}</summary>
      <pre>{value}</pre>
    </details>
  );
}
