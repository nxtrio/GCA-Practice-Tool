import type { ProblemProgress } from "./types.js";

export interface ProblemNavigationItem {
  id: string;
  slot: number;
  title: string;
  progress: ProblemProgress;
}

export interface ProblemNavigationProps {
  items: ProblemNavigationItem[];
  activeProblemId: string;
  onSelect: (problemId: string) => void;
  showStatusLabels?: boolean;
}

const progressSymbols: Record<ProblemProgress, string> = {
  untouched: "○",
  written: "◐",
  partial: "●",
  solved: "✓",
};

const progressLabels: Record<ProblemProgress, string> = {
  untouched: "Not Attempted",
  written: "Attempted",
  partial: "Submitted",
  solved: "Submitted",
};

export function ProblemNavigation({
  items,
  activeProblemId,
  onSelect,
  showStatusLabels = false,
}: ProblemNavigationProps) {
  return (
    <nav className="problem-navigation" aria-label="Assessment problems">
      {items.map((item) => (
        <button
          className="problem-tab"
          data-active={item.id === activeProblemId}
          key={item.id}
          type="button"
          aria-current={item.id === activeProblemId ? "page" : undefined}
          aria-label={`Question ${item.slot}: ${item.title}, ${
            showStatusLabels ? progressLabels[item.progress] : item.progress
          }`}
          onClick={() => onSelect(item.id)}
        >
          <span className={`progress-mark progress-mark--${item.progress}`}>
            {progressSymbols[item.progress]}
          </span>
          <span>{showStatusLabels ? `Question ${item.slot}` : `Q${item.slot}`}</span>
          {showStatusLabels && <small>{progressLabels[item.progress]}</small>}
        </button>
      ))}
    </nav>
  );
}
