import React, { useEffect, useState } from "react";
import "./design-system.css";
import "./index.css";
import "./App.css";

import Starting from "./components/Starting"; // Introduction
import DataBrowser from "./components/DataBrowser";
import ScriptRunner from "./components/ScriptRunner"; // Phase 2
import P3Analysis from "./components/P3Analysis"; // Phase 3
import P3bAnalysis from "./components/P3bAnalysis"; // Phase 3b
import P4AssignThemes from "./components/P4AssignThemes"; // Phase 4
import ProcessSummary from "./components/ProcessSummary";
import MockupDataGenerator from "./components/MockupDataGenerator";

type NavItem = {
  key: "starting" | "data" | "mockup" | "p2" | "p3" | "p3b" | "p4";
  label: string;
};

const NAV: NavItem[] = [
  { key: "starting", label: "Getting Started" },
  { key: "data", label: "Data & Theme Explorer" },
  { key: "mockup", label: "Create Mockup Data" },
  { key: "p2", label: "Initial Codes (P2)" },
  { key: "p3", label: "Candidate Themes (P3)" },
  { key: "p3b", label: "Final Themes (P3b)" },
  { key: "p4", label: "Assign Final Themes (P4)" },
];

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavItem["key"]>("starting");
  const [theme, setTheme] = useState<"auto" | "dark" | "light">("auto");
  const [specificDataFile, setSpecificDataFile] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu when clicking a nav item
  const handleNavClick = (key: NavItem["key"]) => {
    setCurrentTab(key);
    setMobileMenuOpen(false);
  };

  // optional: allow manual overrides on <html>
  useEffect(() => {
    const root = document.documentElement;
    root.removeAttribute("data-theme");
    if (theme === "dark") root.setAttribute("data-theme", "dark");
    if (theme === "light") root.setAttribute("data-theme", "light");
  }, [theme]);

  // window events compatibility (existing behavior)
  useEffect(() => {
    const onSwitch = (event: Event) => {
      const customEvent = event as CustomEvent<{ filename?: string }>;
      setCurrentTab("data");
      if (customEvent.detail?.filename) {
        setSpecificDataFile(customEvent.detail.filename);
      }
    };
    const onClear = () => {
      setSpecificDataFile(null);
    };
    window.addEventListener("switchToDataBrowser", onSwitch);
    window.addEventListener("clearSpecificFile", onClear);
    return () => {
      window.removeEventListener("switchToDataBrowser", onSwitch);
      window.removeEventListener("clearSpecificFile", onClear);
    };
  }, []);

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div
          className="mobile-menu-overlay"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`app-sidebar ${mobileMenuOpen ? "mobile-open" : ""}`}
        aria-label="Primary"
      >
        <div className="sidebar-header-mobile">
          <span className="nav-section">Workspace</span>
          <button
            className="mobile-close-btn"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="nav-section desktop-only">Workspace</div>
        <nav className="nav-group" role="tablist" aria-label="Main">
          {NAV.map((n) => (
            <button
              key={n.key}
              role="tab"
              aria-selected={currentTab === n.key}
              aria-current={currentTab === n.key ? "page" : undefined}
              className="nav-item"
              onClick={() => handleNavClick(n.key)}
            >
              {n.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Header */}
      <header className="app-header">
        {/* Hamburger menu button - visible on mobile */}
        <button
          className="hamburger-btn"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open menu"
          aria-expanded={mobileMenuOpen}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="title">Crime Themes Explorer</div>
        <span className="muted header-subtitle">Academic Edition</span>
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
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setTheme(e.target.value as "auto" | "dark" | "light")
              }
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
        {currentTab === "starting" && (
          <section className="card">
            <div className="card-body">
              <Starting />
            </div>
          </section>
        )}
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
        {currentTab === "mockup" && (
          <section className="card">
            <div className="card-header">
              <h2>Create Mockup Data</h2>
            </div>
            <div className="card-body">
              <MockupDataGenerator />
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
              <h2>Candidate Themes (Phase 3)</h2>
            </div>
            <div className="card-body">
              <P3Analysis />
            </div>
          </section>
        )}
        {currentTab === "p3b" && (
          <section className="card">
            <div className="card-header row">
              <h2>Final Themes (Phase 3b)</h2>
            </div>
            <div className="card-body">
              <P3bAnalysis />
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
