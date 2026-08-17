import { useState } from "react";
import { Link } from "react-router-dom";
import {
  loadEditorSettings,
  saveEditorSettings,
  type EditorSettings,
} from "../editor/editorSettings.js";

export function SettingsPage() {
  const [settings, setSettings] = useState(loadEditorSettings);
  const [saved, setSaved] = useState(false);
  const update = <Key extends keyof EditorSettings>(key: Key, value: EditorSettings[Key]) => {
    setSaved(false);
    setSettings((current) => ({ ...current, [key]: value }));
  };
  return (
    <main className="list-page">
      <header className="simple-header"><Link className="home-brand import-brand" to="/"><span className="brand-mark" aria-hidden="true">G</span><span>Coding Practice</span></Link></header>
      <div className="settings-card">
        <p className="home-eyebrow">Workspace preferences</p><h1>Editor settings</h1>
        <label><span>Font size</span><input type="number" min="11" max="22" value={settings.fontSize} onChange={(event) => update("fontSize", Number(event.target.value))} /></label>
        <label><span>Tab size</span><select value={settings.tabSize} onChange={(event) => update("tabSize", Number(event.target.value) as 2 | 4)}><option value="2">2 spaces</option><option value="4">4 spaces</option></select></label>
        <label><span>Word wrap</span><input type="checkbox" checked={settings.wordWrap === "on"} onChange={(event) => update("wordWrap", event.target.checked ? "on" : "off")} /></label>
        <label><span>Autocomplete</span><input type="checkbox" checked={settings.autocomplete} onChange={(event) => update("autocomplete", event.target.checked)} /></label>
        <button className="button button--primary" type="button" onClick={() => { saveEditorSettings(settings); setSaved(true); }}>Save settings</button>
        {saved && <span className="settings-saved" role="status">Settings saved</span>}
      </div>
    </main>
  );
}
