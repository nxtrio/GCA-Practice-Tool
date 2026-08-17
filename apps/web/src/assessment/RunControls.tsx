export interface RunControlsProps {
  disabled?: boolean;
  executionAvailable?: boolean;
  running?: boolean;
  onRun?: () => void;
  onSubmit?: () => void;
}

export function RunControls({
  disabled = false,
  executionAvailable = false,
  running = false,
  onRun,
  onSubmit,
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
        {running ? "Running…" : "Run visible tests"}
      </button>
      <button
        className="button button--primary"
        type="button"
        disabled={controlsDisabled}
        onClick={onSubmit}
      >
        {running ? "Judging…" : "Submit"}
      </button>
    </div>
  );
}
