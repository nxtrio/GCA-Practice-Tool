// @vitest-environment jsdom

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodeEditor } from "../src/editor/CodeEditor.tsx";

const editorProps = vi.hoisted(() => vi.fn());

vi.mock("@monaco-editor/react", () => ({
  default: (props: Record<string, unknown>) => {
    editorProps(props);
    return <div data-testid="monaco-editor" />;
  },
}));

afterEach(() => {
  cleanup();
  editorProps.mockClear();
});

describe("CodeEditor", () => {
  it("leaves live model content uncontrolled so parent renders cannot move the caret", () => {
    const view = render(
      <CodeEditor
        modelPath="session/p1/solution.java"
        language="java"
        source={"int solution() {\n  return 1;\n}"}
        onChange={vi.fn()}
      />,
    );

    const firstProps = editorProps.mock.lastCall?.[0] as Record<string, unknown>;
    expect(firstProps.defaultValue).toBe("int solution() {\n  return 1;\n}");
    expect(firstProps.value).toBeUndefined();

    view.rerender(
      <CodeEditor
        modelPath="session/p1/solution.java"
        language="java"
        source={"int solution() {\n  return 12;\n}"}
        onChange={vi.fn()}
      />,
    );

    const rerenderedProps = editorProps.mock.lastCall?.[0] as Record<string, unknown>;
    expect(rerenderedProps.value).toBeUndefined();
  });

  it("syncs only intentional source revisions and keeps cursor markers in place", () => {
    const executeEdits = vi.fn();
    const setPosition = vi.fn();
    const model = {
      getFullModelRange: vi.fn(() => ({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 3,
        endColumn: 2,
      })),
      getOffsetAt: vi.fn(() => 8),
      getPositionAt: vi.fn(() => ({ lineNumber: 1, column: 9 })),
    };
    let liveValue = "int solution() {\n  return 1;\n}";
    const editor = {
      executeEdits,
      getModel: vi.fn(() => model),
      getPosition: vi.fn(() => ({ lineNumber: 2, column: 3 })),
      getValue: vi.fn(() => liveValue),
      setPosition,
    };
    const view = render(
      <CodeEditor
        modelPath="session/p1/solution.java"
        language="java"
        source={liveValue}
        onChange={vi.fn()}
      />,
    );
    const mountedProps = editorProps.mock.lastCall?.[0] as {
      onMount(instance: unknown): void;
    };
    act(() => mountedProps.onMount(editor));

    liveValue = "int solution() {\n  return 123;\n}";
    view.rerender(
      <CodeEditor
        modelPath="session/p1/solution.java"
        language="java"
        source="int solution() {\n  return 12;\n}"
        onChange={vi.fn()}
      />,
    );
    expect(executeEdits).not.toHaveBeenCalled();

    view.rerender(
      <CodeEditor
        modelPath="session/p1/solution.java"
        language="java"
        source="int solution() {\n  return 1;\n}"
        sourceRevision={1}
        onChange={vi.fn()}
      />,
    );
    expect(executeEdits).toHaveBeenCalledWith("assessment-source-sync", [
      expect.objectContaining({ forceMoveMarkers: false }),
    ]);
    expect(setPosition).toHaveBeenCalledWith({ lineNumber: 1, column: 9 });
  });
});
