import type { Language } from "@gca-practice/contracts";

export const supportedLanguages: Language[] = ["java", "cpp", "python"];

const languageLabels: Record<Language, string> = {
  java: "Java",
  cpp: "C++",
  python: "Python",
};

export interface LanguageSelectorProps {
  language: Language;
  disabled?: boolean;
  availableLanguages?: Language[];
  onChange: (language: Language) => void;
}

export function LanguageSelector({
  language,
  disabled = false,
  availableLanguages = supportedLanguages,
  onChange,
}: LanguageSelectorProps) {
  return (
    <label className="language-selector">
      <span className="sr-only">Programming language</span>
      <select
        aria-label="Programming language"
        value={language}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as Language)}
      >
        {supportedLanguages.map((value) => (
          <option key={value} value={value} disabled={!availableLanguages.includes(value)}>
            {languageLabels[value]}
          </option>
        ))}
      </select>
      <span className="select-caret" aria-hidden="true">
        ▾
      </span>
    </label>
  );
}
