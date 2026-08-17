export interface EditorSettings {
  fontSize: number;
  tabSize: number;
  wordWrap: "on" | "off";
  autocomplete: boolean;
}

export const defaultEditorSettings: EditorSettings = {
  fontSize: 14,
  tabSize: 4,
  wordWrap: "on",
  autocomplete: true,
};

const key = "gca-practice:editor-settings";

export function loadEditorSettings(): EditorSettings {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? "null") as Partial<EditorSettings> | null;
    if (!value) return defaultEditorSettings;
    return {
      fontSize: validNumber(value.fontSize, 11, 22) ? value.fontSize : defaultEditorSettings.fontSize,
      tabSize: value.tabSize === 2 || value.tabSize === 4 ? value.tabSize : defaultEditorSettings.tabSize,
      wordWrap: value.wordWrap === "off" ? "off" : "on",
      autocomplete: typeof value.autocomplete === "boolean" ? value.autocomplete : defaultEditorSettings.autocomplete,
    };
  } catch {
    return defaultEditorSettings;
  }
}

export function saveEditorSettings(settings: EditorSettings): void {
  window.localStorage.setItem(key, JSON.stringify(settings));
}

function validNumber(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum;
}
