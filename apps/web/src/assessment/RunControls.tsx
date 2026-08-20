export interface RunControlsProps {
  disabled?: boolean;
  executionAvailable?: boolean;
  running?: boolean;
  onRun?: () => void;
  onSubmit?: () => void;
  hackerRankTerminology?: boolean;
}

export function RunControls({
  disabled = false,
  executionAvailable = false,
  running = false,
  onRun,
  onSubmit,
  hackerRankTerminology = false,
}: RunControlsProps) {
  const controlsDisabled = disabled || !executionAvailable || running;
  return (
    <div className="run-controls">
      <span className="runner-status" role="status">
        {!executionAvailable
          ? "Runner connection pending"
          : running
            ? "Executing in isolated processes…"
            : "Ready"}
      </span>
      <button
        className="button button--secondary"
        type="button"
        disabled={controlsDisabled}
        onClick={onRun}
      >
        {running ? "Running…" : hackerRankTerminology ? "Run Code" : "Run visible tests"}
      </button>
      <button
        className="button button--primary"
        type="button"
        disabled={controlsDisabled}
        onClick={onSubmit}
      >
        {running ? "Judging…" : hackerRankTerminology ? "Submit Code" : "Submit"}
      </button>
    </div>
  );
}
