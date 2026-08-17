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
}

const progressSymbols: Record<ProblemProgress, string> = {
  untouched: "○",
  written: "◐",
  partial: "●",
  solved: "✓",
};

export function ProblemNavigation({
  items,
  activeProblemId,
  onSelect,
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
          aria-label={`Question ${item.slot}: ${item.title}, ${item.progress}`}
          onClick={() => onSelect(item.id)}
        >
          <span className={`progress-mark progress-mark--${item.progress}`}>
            {progressSymbols[item.progress]}
          </span>
          <span>Q{item.slot}</span>
        </button>
      ))}
    </nav>
  );
}
