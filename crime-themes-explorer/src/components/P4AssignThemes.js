import React, { useEffect, useRef, useState } from "react";
import P3CaseItem from "./P3CaseItem";

const P4AssignThemes = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState([]);
  const [error, setError] = useState(null);
  const [duration, setDuration] = useState(0);
  const [model, setModel] = useState("gemini-2.0-flash");
  const [availableFiles, setAvailableFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [selectedDataFile, setSelectedDataFile] = useState("");
  const [existingThemes, setExistingThemes] = useState([]);
  const [showAllThemes, setShowAllThemes] = useState(false);
  const [expandedCases, setExpandedCases] = useState(new Set());
  const [analysisStatus, setAnalysisStatus] = useState({
    phase: "Idle",
    totalCases: 0,
    processedCases: 0,
    uniqueThemesCount: 0,
    currentDataFile: null,
    errors: [],
  });
  const [themesFile, setThemesFile] = useState("kradeze_pripady_3b.json");

  const startRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    connectWebSocket();
    checkStatus();
    loadAvailableFiles();
    const timer = setInterval(() => {
      if (isRunning && startRef.current) {
        setDuration(Date.now() - startRef.current);
      }
    }, 1000);
    return () => {
      clearInterval(timer);
      wsRef.current?.close();
    };
  }, [isRunning]);

  const connectWebSocket = () => {
    const ws = new WebSocket("ws://localhost:9000");
    wsRef.current = ws;
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        switch (msg.type) {
          case "p4_script_started":
            setIsRunning(true);
            startRef.current = Date.now();
            addOutput("🚀 Phase 4 started", "info");
            break;
          case "p4ProgressUpdate": {
            const data = msg.data || {};
            setAnalysisStatus((prev) => ({
              ...prev,
              processedCases:
                (data.progress && data.progress.processed) ||
                prev.processedCases,
              totalCases:
                (data.progress && data.progress.total) || prev.totalCases,
              uniqueThemesCount:
                (data.progress && data.progress.unique_themes) ||
                prev.uniqueThemesCount,
            }));
            if (data.case_id && data.theme) {
              addOutput(
                `🎯 Assigned theme for case ${data.case_id}: ${String(
                  data.theme
                ).slice(0, 120)}`,
                "info"
              );
            }
            break;
          }
          case "p4PhaseUpdate": {
            const d = msg.data || {};
            setAnalysisStatus((prev) => ({
              ...prev,
              phase: d.phase || prev.phase,
              totalCases:
                (d.details && d.details.total_cases) || prev.totalCases,
              processedCases:
                (d.details && d.details.processed_cases) || prev.processedCases,
              uniqueThemesCount:
                (d.details && d.details.unique_themes) ||
                prev.uniqueThemesCount,
              currentDataFile:
                (d.details && d.details.data_file) || prev.currentDataFile,
            }));
            break;
          }
          case "p4_output":
            addOutput(msg.text, "info");
            break;
          case "p4_script_error":
            addOutput(`❌ ${msg.data}`, "error");
            break;
          case "p4_script_finished":
            setIsRunning(false);
            addOutput("✅ Phase 4 completed", "success");
            break;
          case "p4_script_failed":
            setIsRunning(false);
            addOutput(`❌ Phase 4 failed with code ${msg.code}`, "error");
            break;
          case "p4_script_stopped":
            setIsRunning(false);
            addOutput("⏹️ Phase 4 stopped", "warning");
            break;
          default:
            break;
        }
      } catch (err) {
        // ignore
      }
    };
  };

  const addOutput = (text, type = "info") => {
    setOutput((prev) =>
      [
        ...prev,
        {
          id: Date.now() + Math.random(),
          text,
          type,
          timestamp: new Date().toLocaleTimeString(),
        },
      ].slice(-500)
    );
  };

  const checkStatus = async () => {
    try {
      const res = await fetch("/api/p4/status");
      const data = await res.json();
      setIsRunning(!!data.running);
      if (data.running) startRef.current = Date.now();
    } catch (e) {
      setError("Failed to check P4 status");
    }
  };

  const loadAvailableFiles = async () => {
    try {
      setFilesLoading(true);
      const response = await fetch("/api/data-files");
      const files = await response.json();
      setAvailableFiles(files);
    } catch (e) {
      // ignore
    } finally {
      setFilesLoading(false);
    }
  };

  const loadExistingThemes = async (filename) => {
    if (!filename) return;
    try {
      const response = await fetch(`/api/data/${filename}/themes?limit=10000`);
      const data = await response.json();
      if (response.ok) {
        setExistingThemes(data.cases || []);
        setAnalysisStatus((prev) => ({
          ...prev,
          totalCases:
            (data.statistics && data.statistics.totalCases) || prev.totalCases,
          processedCases:
            (data.statistics && data.statistics.processedCases) ||
            prev.processedCases,
          uniqueThemesCount:
            (data.statistics && data.statistics.uniqueThemesCount) ||
            prev.uniqueThemesCount,
          currentDataFile: filename,
        }));
        addOutput(
          `📂 Loaded ${
            (data.statistics && data.statistics.processedCases) || 0
          } existing themes from ${filename}`,
          "info"
        );
      }
    } catch (e) {
      addOutput(`❌ Failed to load existing themes: ${e.message}`, "error");
    }
  };

  const startP4 = async () => {
    try {
      setError(null);
      const body = {
        model,
        dataFile: selectedDataFile || undefined,
        themesFile: themesFile || undefined,
      };
      const res = await fetch("/api/p4/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to start P4");
      }
    } catch (e) {
      setError(e.message);
      addOutput(`❌ ${e.message}`, "error");
    }
  };

  const stopP4 = async () => {
    try {
      const res = await fetch("/api/p4/stop", { method: "POST" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to stop P4");
      }
    } catch (e) {
      setError(e.message);
      addOutput(`❌ ${e.message}`, "error");
    }
  };

  const formatDuration = (ms) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
  };

  const toggleCaseExpansion = (caseId) => {
    setExpandedCases((prev) => {
      const next = new Set(prev);
      if (next.has(caseId)) next.delete(caseId);
      else next.add(caseId);
      return next;
    });
  };

  const handleThemeUpdate = async (caseId, themeType, newValue) => {
    try {
      if (!selectedDataFile) {
        addOutput("❌ No data file selected", "error");
        return;
      }
      const response = await fetch(
        `/api/data/${selectedDataFile}/case/${caseId}/update-theme`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ themeType, theme: newValue }),
        }
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Failed to update theme");
      setExistingThemes((prev) =>
        prev.map((t) =>
          t.caseId === caseId ? { ...t, [themeType]: newValue } : t
        )
      );
      addOutput(`✅ Updated ${themeType} for case ${caseId}`, "success");
    } catch (e) {
      addOutput(`❌ Failed to update theme: ${e.message}`, "error");
      if (selectedDataFile) loadExistingThemes(selectedDataFile);
    }
  };

  const exportThemesCSV = () => {
    const header = [
      "case_id",
      "candidate_theme",
      "final_theme",
      "initial_codes",
      "case_text",
      "timestamp",
    ];
    const escapeCsv = (v) => {
      const s = v == null ? "" : String(v);
      const needs = /[",\n]/.test(s);
      const esc = s.replace(/"/g, '""');
      return needs ? `"${esc}"` : esc;
    };
    const rows = existingThemes.map((t) => {
      const initialCodes = Array.isArray(t.initialCodes)
        ? t.initialCodes.join(" | ")
        : String(t.initialCodes || "");
      return [
        escapeCsv(t.caseId),
        escapeCsv(t.candidate_theme ?? ""),
        escapeCsv(t.theme ?? ""),
        escapeCsv(initialCodes),
        escapeCsv(t.caseText || ""),
        escapeCsv(t.timestamp || ""),
      ].join(",");
    });
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `p4_assigned_themes_${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/:/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p3-analysis p4-analysis">
      <div className="runner-header">
        <h2>Phase 4 Assign Final Themes</h2>
        <p>Assign finalized themes to all cases using Phase 3b output</p>
      </div>

      {/* Controls */}
      <div className="toolbar">
        <button
          onClick={startP4}
          disabled={isRunning || !selectedDataFile}
          className="btn primary"
        >
          {isRunning ? "Running..." : "Start Phase 4"}
        </button>
        <button onClick={stopP4} disabled={!isRunning} className="btn danger">
          Stop
        </button>
        <div className="row" style={{ alignItems: "center" }}>
          <label htmlFor="p4-model-select" className="muted">
            Model
          </label>
          <select
            id="p4-model-select"
            className="select"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
            <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
            <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
            <option value="gpt-5-2025-08-07">gpt-5-2025-08-07</option>
            <option value="gpt-5-mini-2025-08-07">gpt-5-mini-2025-08-07</option>
            <option value="gpt-5-nano-2025-08-07">gpt-5-nano-2025-08-07</option>
          </select>
        </div>
        <span className="spacer" />
        <span className="badge">{isRunning ? "Running" : "Stopped"}</span>
        {duration > 0 && (
          <span className="badge info" title="Elapsed time">
            {formatDuration(duration)}
          </span>
        )}
      </div>

      {error && <div className="badge warning">{error}</div>}

      {/* Data file selector */}
      <section className="card">
        <div className="card-header row">
          <h3>Select data file for assignment</h3>
        </div>
        <div className="card-body">
          {filesLoading ? null : availableFiles.length === 0 ? (
            <div className="no-files-available">
              <p>No files available.</p>
            </div>
          ) : (
            <div className="row" style={{ alignItems: "end", gap: 12 }}>
              <div className="selector-group" style={{ minWidth: 320 }}>
                <label htmlFor="p4-file-select">Choose a file</label>
                <select
                  id="p4-file-select"
                  className="select"
                  value={selectedDataFile}
                  onChange={(e) => {
                    const filename = e.target.value;
                    setSelectedDataFile(filename);
                    setShowAllThemes(false);
                    setExistingThemes([]);
                    if (filename) loadExistingThemes(filename);
                    else
                      setAnalysisStatus((prev) => ({
                        ...prev,
                        totalCases: 0,
                        processedCases: 0,
                        uniqueThemesCount: 0,
                        currentDataFile: null,
                      }));
                  }}
                >
                  <option value="">-- Select a file --</option>
                  {availableFiles.map((file) => (
                    <option key={file.name} value={file.name}>
                      {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </option>
                  ))}
                </select>
              </div>
              <div className="selector-group" style={{ minWidth: 320 }}>
                <label htmlFor="p4-themes-file">
                  Final themes file (optional)
                </label>
                <input
                  id="p4-themes-file"
                  className="input"
                  value={themesFile}
                  onChange={(e) => setThemesFile(e.target.value)}
                  placeholder="kradeze_pripady_3b.json"
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Progress */}
      <section className="card">
        <div className="card-header row">
          <h3>Progress</h3>
        </div>
        <div className="card-body">
          <div className="progress-overview">
            <div className="progress-stats-grid">
              <div className="stat-item">
                <div className="stat-number">
                  {analysisStatus.processedCases}
                </div>
                <div className="stat-label">Processed</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">{analysisStatus.totalCases}</div>
                <div className="stat-label">Total Cases</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">
                  {analysisStatus.uniqueThemesCount}
                </div>
                <div className="stat-label">Unique Themes</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Output */}
      <section className="card">
        <div className="card-header row">
          <h3>Phase 4 output</h3>
        </div>
        <div className="card-body">
          <div className="terminal" role="log" aria-live="polite">
            {output.length === 0 ? (
              <div className="line">No output yet</div>
            ) : (
              output.map((line) => (
                <div key={line.id} className="line">
                  <span className="tag">[{line.timestamp}]</span> {line.text}
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {existingThemes.length > 0 && (
        <section className="card">
          <div className="card-header row">
            <h3>Assigned themes ({existingThemes.length})</h3>
            <span className="spacer" />
            <div className="row" style={{ gap: 8 }}>
              <button className="btn subtle" onClick={exportThemesCSV}>
                Export CSV
              </button>
            </div>
          </div>
          <div className="card-body">
            <div className="codes-list">
              {existingThemes
                .slice(0, showAllThemes ? existingThemes.length : 20)
                .map((caseItem, idx) => (
                  <P3CaseItem
                    key={caseItem.caseId || idx}
                    caseItem={caseItem}
                    expandedCases={expandedCases}
                    toggleCaseExpansion={toggleCaseExpansion}
                    onThemeUpdate={handleThemeUpdate}
                  />
                ))}
            </div>
            {existingThemes.length > 20 && !showAllThemes && (
              <div className="more-codes-indicator">
                <span>+ {existingThemes.length - 20} more completed cases</span>
                <button
                  className="btn subtle"
                  onClick={() => setShowAllThemes(true)}
                >
                  View all assigned themes
                </button>
              </div>
            )}
            {showAllThemes && existingThemes.length > 20 && (
              <div className="more-codes-indicator">
                <span>Showing all {existingThemes.length} cases</span>
                <button
                  className="btn subtle"
                  onClick={() => setShowAllThemes(false)}
                >
                  Show less
                </button>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default P4AssignThemes;
