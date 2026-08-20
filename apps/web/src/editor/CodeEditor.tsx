import Editor from "@monaco-editor/react";
import type { Language } from "@gca-practice/contracts";
import type { editor } from "monaco-editor";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { loadEditorSettings } from "./editorSettings.js";

const monacoLanguage: Record<Language, string> = {
  java: "java",
  cpp: "cpp",
  python: "python",
};

export interface CodeEditorProps {
  modelPath: string;
  language: Language;
  source: string;
  sourceRevision?: number;
  disabled?: boolean;
  onChange: (source: string) => void;
}

export function CodeEditor({
  modelPath,
  language,
  source,
  sourceRevision = 0,
  disabled = false,
  onChange,
}: CodeEditorProps) {
  const settings = loadEditorSettings();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const sourceRef = useRef(source);
  const onChangeRef = useRef(onChange);
  sourceRef.current = source;
  onChangeRef.current = onChange;

  const syncSource = useCallback(
    (instance: editor.IStandaloneCodeEditor, nextSource: string) => {
      if (instance.getValue() === nextSource) return;

      const model = instance.getModel();
      if (!model) return;
      const position = instance.getPosition();
      const cursorOffset = position ? model.getOffsetAt(position) : undefined;

      instance.executeEdits("assessment-source-sync", [
        {
          range: model.getFullModelRange(),
          text: nextSource,
          forceMoveMarkers: false,
        },
      ]);

      if (cursorOffset !== undefined) {
        instance.setPosition(
          model.getPositionAt(Math.min(cursorOffset, nextSource.length)),
        );
      }
    },
    [],
  );

  const handleMount = useCallback(
    (instance: editor.IStandaloneCodeEditor) => {
      editorRef.current = instance;
      syncSource(instance, sourceRef.current);
    },
    [syncSource],
  );

  const handleChange = useCallback((value: string | undefined) => {
    onChangeRef.current(value ?? "");
  }, []);

  useEffect(() => {
    const instance = editorRef.current;
    if (instance) syncSource(instance, sourceRef.current);
    // `sourceRevision` changes only for intentional replacements such as
    // Reset starter. Normal keystrokes must remain owned by Monaco: feeding
    // their React state echo back into the model can replace the full document
    // and move the caret to the final closing bracket.
  }, [sourceRevision, syncSource]);

  useEffect(() => () => {
    editorRef.current = null;
  }, []);

  const options = useMemo<editor.IStandaloneEditorConstructionOptions>(
    () => ({
      ariaLabel: `${language} code editor`,
      automaticLayout: true,
      autoClosingBrackets: "always",
      autoClosingQuotes: "always",
      bracketPairColorization: { enabled: true },
      contextmenu: true,
      cursorBlinking: "smooth",
      fontFamily: "'JetBrains Mono', 'SFMono-Regular', Consolas, monospace",
      fontLigatures: true,
      fontSize: settings.fontSize,
      lineHeight: 23,
      lineNumbers: "on",
      minimap: { enabled: false },
      padding: { top: 18, bottom: 18 },
      quickSuggestions: settings.autocomplete,
      readOnly: disabled,
      renderLineHighlight: "line",
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      suggestOnTriggerCharacters: settings.autocomplete,
      tabSize: settings.tabSize,
      wordWrap: settings.wordWrap,
    }),
    [
      disabled,
      language,
      settings.autocomplete,
      settings.fontSize,
      settings.tabSize,
      settings.wordWrap,
    ],
  );

  return (
    <div className="code-editor" aria-label="Code editor">
      <Editor
        height="100%"
        path={modelPath}
        language={monacoLanguage[language]}
        theme="vs-dark"
        defaultValue={source}
        onMount={handleMount}
        onChange={handleChange}
        loading={<div className="editor-loading">Preparing editor…</div>}
        options={options}
      />
    </div>
  );
}
