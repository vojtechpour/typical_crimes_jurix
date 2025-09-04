import React, { useState, useMemo } from "react";
import "./App.css";
import "./design-system.css";
import "./index.css";

import DataBrowser from "./components/DataBrowser";
import ScriptRunner from "./components/ScriptRunner"; // Phase 2
import P3Analysis from "./components/P3Analysis"; // Phase 3/3b
import P4AssignThemes from "./components/P4AssignThemes"; // Phase 4
import ProcessSummary from "./components/ProcessSummary";

const NAV: { key: string; label: string }[] = [
  { key: "data", label: "Data & Theme Explorer" },
  { key: "p2", label: "Initial Codes (P2)" },
  { key: "p3", label: "Themes (P3/P3b)" },
  { key: "p4", label: "Assign Final Themes (P4)" },
];

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>("data");
  const [theme, setTheme] = useState<string>("auto");
  const [specificDataFile, setSpecificDataFile] = useState<string | null>(null);

  // optional: allow manual overrides on <html>
  useMemo(() => {
    const root = document.documentElement;
    root.removeAttribute("data-theme");
    if (theme === "dark") root.setAttribute("data-theme", "dark");
    if (theme === "light") root.setAttribute("data-theme", "light");
  }, [theme]);

  // window events compatibility (existing behavior)
  React.useEffect(() => {
    const onSwitch = (e: Event) => {
      setCurrentTab("data");
      const detail = (e as CustomEvent<{ filename?: string }>).detail;
      if (detail && detail.filename) {
        setSpecificDataFile(detail.filename);
      }
    };
    const onClear = () => {
      setSpecificDataFile(null);
    };
    window.addEventListener("switchToDataBrowser", onSwitch as EventListener);
    window.addEventListener("clearSpecificFile", onClear as EventListener);
    return () => {
      window.removeEventListener(
        "switchToDataBrowser",
        onSwitch as EventListener
      );
      window.removeEventListener("clearSpecificFile", onClear as EventListener);
    };
  }, []);

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      {/* Sidebar */}
      <aside className="app-sidebar" aria-label="Primary">
        <div className="nav-section">Workspace</div>
        <nav className="nav-group" role="tablist" aria-label="Main">
          {NAV.map((n) => (
            <button
              key={n.key}
              role="tab"
              aria-selected={currentTab === n.key}
              aria-current={currentTab === n.key ? "page" : undefined}
              className="nav-item"
              onClick={() => setCurrentTab(n.key)}
            >
              {n.label}
            </button>
          ))}
        </nav>

        <div className="nav-section" style={{ marginTop: "auto" }}>
          Resources
        </div>
        <div className="nav-group">
          <a
            className="nav-item"
            href="https://"
            target="_blank"
            rel="noreferrer"
          >
            Documentation
          </a>
          <a
            className="nav-item"
            href="https://"
            target="_blank"
            rel="noreferrer"
          >
            API Reference
          </a>
        </div>
      </aside>

      {/* Header */}
      <header className="app-header">
        <div className="title">Crime Themes Explorer</div>
        <span className="muted">Academic Edition</span>
        <div className="header-actions">
          <ProcessSummary />
          <div className="row">
            <label className="muted" htmlFor="theme">
              Theme
            </label>
            <select
              id="theme"
              className="select"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
            >
              <option value="auto">Auto</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
        </div>
      </header>

      {/* Main */}
      <main id="main" className="app-main" role="tabpanel">
        {currentTab === "data" && (
          <section className="card">
            <div className="card-header">
              <h2>Data & Theme Explorer</h2>
            </div>
            <div className="card-body">
              <DataBrowser specificFile={specificDataFile} />
            </div>
          </section>
        )}
        {currentTab === "p2" && (
          <section className="card">
            <div className="card-header row">
              <h2>Initial Codes (Phase 2)</h2>
              <span className="badge info">Live</span>
            </div>
            <div className="card-body">
              <ScriptRunner />
            </div>
          </section>
        )}
        {currentTab === "p3" && (
          <section className="card">
            <div className="card-header row">
              <h2>Themes (Phases 3 & 3b)</h2>
            </div>
            <div className="card-body">
              <P3Analysis />
            </div>
          </section>
        )}
        {currentTab === "p4" && (
          <section className="card">
            <div className="card-header row">
              <h2>Assign Final Themes (Phase 4)</h2>
            </div>
            <div className="card-body">
              <P4AssignThemes />
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
