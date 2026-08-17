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
  return (
    <label className="assessment-paste">
      <span>Assessment JSON</span>
      <textarea
        value={value}
        disabled={disabled}
        spellCheck={false}
        placeholder="Paste the JSON document from your external LLM here…"
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
