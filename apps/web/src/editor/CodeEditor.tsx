import Editor from "@monaco-editor/react";
import type { Language } from "@gca-practice/contracts";
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
  disabled?: boolean;
  onChange: (source: string) => void;
}

export function CodeEditor({
  modelPath,
  language,
  source,
  disabled = false,
  onChange,
}: CodeEditorProps) {
  const settings = loadEditorSettings();
  return (
    <div className="code-editor" aria-label="Code editor">
      <Editor
        height="100%"
        path={modelPath}
        language={monacoLanguage[language]}
        theme="vs-dark"
        value={source}
        onChange={(value) => onChange(value ?? "")}
        loading={<div className="editor-loading">Preparing editor…</div>}
        options={{
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
        }}
      />
    </div>
  );
}
