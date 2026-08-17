import { useId, useState, type ChangeEvent } from "react";

export const MAX_ASSESSMENT_FILE_BYTES = 1_500_000;

export interface AssessmentPasteProps {
  value: string;
  disabled?: boolean;
  onChange(value: string): void;
}
export function AssessmentPaste({
  value,
  disabled = false,
  onChange,
}: AssessmentPasteProps) {
  const textareaId = useId();
  const fileInputId = useId();
  const [loadedFilename, setLoadedFilename] = useState<string>();
  const [fileError, setFileError] = useState<string>();

  const loadFile = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    setFileError(undefined);
    if (!isJsonFile(file)) {
      setLoadedFilename(undefined);
      setFileError("Choose a JSON file with a .json extension.");
      return;
    }
    if (file.size > MAX_ASSESSMENT_FILE_BYTES) {
      setLoadedFilename(undefined);
      setFileError("JSON files must be 1.5 MB or smaller.");
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("error", () => {
      setLoadedFilename(undefined);
      setFileError("The selected JSON file could not be read.");
    });
    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string") {
        setLoadedFilename(undefined);
        setFileError("The selected JSON file could not be read as text.");
        return;
      }
      setLoadedFilename(file.name);
      setFileError(undefined);
      onChange(reader.result);
    });
    reader.readAsText(file);
  };

  const updatePastedSource = (nextValue: string) => {
    setLoadedFilename(undefined);
    setFileError(undefined);
    onChange(nextValue);
  };

  const noticeId = loadedFilename || fileError
    ? `${textareaId}-file-notice`
    : undefined;

  return (
    <section className="assessment-paste">
      <div className="assessment-source-heading">
        <label htmlFor={textareaId}>Assessment JSON</label>
        <label className="json-upload-button" htmlFor={fileInputId}>
          Upload JSON file
          <input
            id={fileInputId}
            type="file"
            accept=".json,application/json"
            disabled={disabled}
            onChange={loadFile}
          />
        </label>
      </div>
      {loadedFilename && (
        <p className="json-file-notice" id={noticeId} role="status">
          Loaded {loadedFilename}
        </p>
      )}
      {fileError && (
        <p className="json-file-error" id={noticeId} role="alert">
          {fileError}
        </p>
      )}
      <textarea
        id={textareaId}
        value={value}
        disabled={disabled}
        spellCheck={false}
        aria-describedby={noticeId}
        placeholder="Upload a .json file or paste the JSON document from your external LLM here…"
        onChange={(event) => updatePastedSource(event.target.value)}
      />
    </section>
  );
}

function isJsonFile(file: File): boolean {
  return (
    file.name.toLowerCase().endsWith(".json") ||
    file.type === "application/json" ||
    file.type.endsWith("/json")
  );
}
