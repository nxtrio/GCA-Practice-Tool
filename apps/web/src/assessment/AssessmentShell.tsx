import type { ReactNode } from "react";

export interface AssessmentShellProps {
  header: ReactNode;
  navigation: ReactNode;
  description: ReactNode;
  editorToolbar: ReactNode;
  editor: ReactNode;
  tests: ReactNode;
  controls: ReactNode;
}

export function AssessmentShell({
  header,
  navigation,
  description,
  editorToolbar,
  editor,
  tests,
  controls,
}: AssessmentShellProps) {
  return (
    <main className="assessment-shell">
      <header className="assessment-header">
        {header}
        {navigation}
      </header>
      <div className="assessment-workspace">
        <aside className="problem-pane">{description}</aside>
        <section className="solution-pane" aria-label="Solution workspace">
          <div className="editor-toolbar">{editorToolbar}</div>
          <div className="editor-region">{editor}</div>
          <div className="lower-panel">
            {tests}
            <footer className="control-bar">{controls}</footer>
          </div>
        </section>
      </div>
    </main>
  );
}
