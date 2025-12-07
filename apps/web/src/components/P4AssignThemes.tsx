import React, { useEffect, useRef, useState } from "react";
import P3CaseItem, { CaseThemeItem, ThemeField } from "./P3CaseItem";
import DeleteConfirmModal from "./ui/DeleteConfirmModal";

type OutputLineType = "info" | "error" | "success" | "warning" | string;

interface OutputLine {
  id: number;
  text: string;
  type: OutputLineType;
  timestamp: string;
}

interface DataFileOption {
  name: string;
  size?: number;
  [key: string]: unknown;
}

interface AnalysisStatus {
  phase: string;
  totalCases: number;
  processedCases: number;
  uniqueThemesCount: number;
  currentDataFile: string | null;
  errors: string[];
}

const P4AssignThemes: React.FC = () => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [model, setModel] = useState<string>("gemini-2.0-flash");
  const [customInstructions, setCustomInstructions] = useState<string>("");
  const [showInstructions, setShowInstructions] = useState<boolean>(false);
  const [availableFiles, setAvailableFiles] = useState<DataFileOption[]>([]);
  const [filesLoading, setFilesLoading] = useState<boolean>(true);
  const [selectedDataFile, setSelectedDataFile] = useState<string>("");
  const [existingThemes, setExistingThemes] = useState<CaseThemeItem[]>([]);
  const [showAllThemes, setShowAllThemes] = useState<boolean>(false);
  const [expandedCases, setExpandedCases] = useState<Set<string | number>>(
    new Set()
  );
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>({
    phase: "Idle",
    totalCases: 0,
    processedCases: 0,
    uniqueThemesCount: 0,
    currentDataFile: null,
    errors: [],
  });
  const [themesFile, setThemesFile] = useState<string>(
    "kradeze_pripady_3b.json"
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const startRef = useRef<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    connectWebSocket();
    checkStatus();
    loadAvailableFiles();
    const timer = window.setInterval(() => {
      if (isRunning && startRef.current) {
        setDuration(Date.now() - startRef.current);
      }
    }, 1000);
    return () => {
      window.clearInterval(timer);
      wsRef.current?.close();
    };
  }, [isRunning]);

  const connectWebSocket = () => {
    // Use the correct protocol and host for production vs development
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = import.meta.env.DEV
      ? `${wsProtocol}//${window.location.host}/ws` // Goes through Vite proxy
      : `${wsProtocol}//${window.location.host}`; // Direct in production

    console.log("[P4 WS] Connecting to:", wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onmessage = (e: MessageEvent<string>) => {
      try {
        const msg = JSON.parse(e.data);
        switch (msg.type) {
          case "p4_script_started":
            setIsRunning(true);
            startRef.current = Date.now();
            addOutput("Phase 4 started", "info");
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
                `Assigned theme for case ${data.case_id}: ${String(
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
            addOutput(`${msg.data}`, "error");
            break;
          case "p4_script_finished":
            setIsRunning(false);
            addOutput("Phase 4 completed", "success");
            break;
          case "p4_script_failed":
            setIsRunning(false);
            addOutput(`Phase 4 failed with code ${msg.code}`, "error");
            break;
          case "p4_script_stopped":
            setIsRunning(false);
            addOutput("Phase 4 stopped", "warning");
            break;
          default:
            break;
        }
      } catch (err) {
        // ignore
      }
    };
  };

  const addOutput = (text: string, type: OutputLineType = "info") => {
    setOutput((prev) => {
      const next: OutputLine[] = [
        ...prev,
        {
          id: Date.now() + Math.random(),
          text,
          type,
          timestamp: new Date().toLocaleTimeString(),
        },
      ];
      return next.slice(-500);
    });
  };

  const checkStatus = async () => {
    try {
      const res = await fetch("/api/p4/status");
      const data = await res.json();
      setIsRunning(!!data.running);
      if (data.running) startRef.current = Date.now();
    } catch (error) {
      console.warn("Failed to check P4 status", error);
      setError("Failed to check P4 status");
    }
  };

  const loadAvailableFiles = async () => {
    try {
      setFilesLoading(true);
      const response = await fetch("/api/data-files");
      const files = await response.json();
      setAvailableFiles(Array.isArray(files) ? files : []);
    } catch (err) {
      // ignore
    } finally {
      setFilesLoading(false);
    }
  };

  const loadExistingThemes = async (filename: string) => {
    if (!filename) return;
    try {
      const response = await fetch(`/api/data/${filename}/themes?limit=10000`);
      const data = await response.json();
      if (response.ok) {
        const cases = Array.isArray(data.cases)
          ? (data.cases as CaseThemeItem[])
          : [];
        setExistingThemes(cases);
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
          `Loaded ${
            (data.statistics && data.statistics.processedCases) || 0
          } existing themes from ${filename}`,
          "info"
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown error loading existing themes";
      addOutput(`Failed to load existing themes: ${message}`, "error");
    }
  };

  const startP4 = async () => {
    try {
      setError(null);
      const body = {
        model,
        dataFile: selectedDataFile || undefined,
        themesFile: themesFile || undefined,
        customInstructions: customInstructions.trim() || undefined,
      };
      const res = await fetch("/api/p4/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const responseBody = await res.json();
        throw new Error(responseBody.error || "Failed to start P4");
      }
      if (customInstructions.trim()) {
        addOutput(
          `Starting Phase 4 with custom instructions: "${customInstructions.trim()}"`,
          "info"
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to start P4";
      setError(message);
      addOutput(`${message}`, "error");
    }
  };

  const stopP4 = async () => {
    try {
      const res = await fetch("/api/p4/stop", { method: "POST" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to stop P4");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to stop P4";
      setError(message);
      addOutput(`${message}`, "error");
    }
  };

  const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
  };

  const toggleCaseExpansion = (caseId: string | number) => {
    setExpandedCases((prev) => {
      const next = new Set(prev);
      if (next.has(caseId)) next.delete(caseId);
      else next.add(caseId);
      return next;
    });
  };

  const handleThemeUpdate = async (
    caseId: string | number,
    themeType: ThemeField,
    newValue: string | null
  ) => {
    try {
      if (!selectedDataFile) {
        addOutput("No data file selected", "error");
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
      addOutput(`Updated ${themeType} for case ${caseId}`, "success");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update theme";
      addOutput(`Failed to update theme: ${message}`, "error");
      if (selectedDataFile) {
        await loadExistingThemes(selectedDataFile);
      }
    }
  };

  const deleteAllFinalThemes = async () => {
    if (!selectedDataFile) return;
    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/data/${selectedDataFile}/delete-all-final-themes`,
        { method: "DELETE" }
      );
      if (res.ok) {
        const data = await res.json();
        addOutput(
          `Cleared theme assignments from ${data.deletedCount} cases`,
          "success"
        );
        // Reload themes to reflect the changes
        await loadExistingThemes(selectedDataFile);
        setShowDeleteConfirm(false);
      } else {
        const data = await res.json();
        addOutput(`Failed to delete final themes: ${data.error}`, "error");
      }
    } catch (err) {
      addOutput(`Failed to delete final themes: ${err}`, "error");
    } finally {
      setIsDeleting(false);
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
    const escapeCsv = (v: unknown) => {
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
            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
            <option value="gemini-3-pro-preview">Gemini 3 Pro Preview</option>
            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
            <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
            <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
            <option value="claude-sonnet-4-5-20250929">
              Claude Sonnet 4.5
            </option>
            <option value="claude-3-5-sonnet-20241022">
              Claude 3.5 Sonnet
            </option>
            <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
            <option value="gpt-5-2025-08-07">gpt-5-2025-08-07</option>
            <option value="gpt-5-mini-2025-08-07">gpt-5-mini-2025-08-07</option>
            <option value="gpt-5-nano-2025-08-07">gpt-5-nano-2025-08-07</option>
          </select>
        </div>
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className={`btn subtle ${
            customInstructions.trim() ? "has-value" : ""
          }`}
          title={customInstructions.trim() || "Add custom instructions"}
          style={{ position: "relative" }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginRight: 4 }}
          >
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <line x1="10" y1="9" x2="8" y2="9" />
          </svg>
          Instructions
          {customInstructions.trim() && (
            <span
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: "#3b82f6",
              }}
            />
          )}
        </button>
        <span className="spacer" />
        <span className="badge">{isRunning ? "Running" : "Stopped"}</span>
        {duration > 0 && (
          <span className="badge info" title="Elapsed time">
            {formatDuration(duration)}
          </span>
        )}
      </div>

      {/* Custom Instructions Panel */}
      {showInstructions && (
        <div
          style={{
            backgroundColor: "var(--card-bg)",
            border: "1px solid var(--border-color)",
            borderRadius: "8px",
            padding: "16px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "12px",
            }}
          >
            <label
              htmlFor="p4-custom-instructions"
              style={{
                fontWeight: 500,
                color: "var(--text-primary)",
                fontSize: "14px",
              }}
            >
              Custom Instructions
            </label>
            <button
              onClick={() => setShowInstructions(false)}
              className="btn subtle"
              style={{ padding: "4px 8px", fontSize: "12px" }}
            >
              Close
            </button>
          </div>
          <textarea
            id="p4-custom-instructions"
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            placeholder="Add specific instructions for theme assignment...&#10;&#10;Examples:&#10;• Prefer specific themes over general ones&#10;• Consider the case context carefully&#10;• When uncertain, assign to the most encompassing theme&#10;• Pay attention to temporal and location patterns"
            disabled={isRunning}
            style={{
              width: "100%",
              minHeight: "100px",
              padding: "12px",
              borderRadius: "6px",
              border: "1px solid var(--border-color)",
              backgroundColor: "var(--input-bg)",
              color: "var(--text-primary)",
              fontSize: "13px",
              lineHeight: "1.5",
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />
          <p
            style={{
              marginTop: "8px",
              marginBottom: 0,
              fontSize: "12px",
              color: "var(--text-muted)",
            }}
          >
            These instructions will guide how the AI assigns themes to cases.
            Leave empty to use default behavior.
          </p>
        </div>
      )}

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
                      {file.name} ({((file.size ?? 0) / 1024 / 1024).toFixed(2)}{" "}
                      MB)
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
              <div className="stat-item">
                <div className="stat-number">{output.length}</div>
                <div className="stat-label">Updates</div>
              </div>
            </div>
          </div>

          {/* Current processing status - show whenever running */}
          {isRunning && (
            <div className="progress-card">
              <div className="progress-header">
                <div className="pulse-dot" />
                <h4 className="progress-title">
                  {analysisStatus.phase || "Processing"}
                </h4>
              </div>
              <div className="progress-text">
                Progress: {analysisStatus.processedCases} /{" "}
                {analysisStatus.totalCases} cases
                {analysisStatus.totalCases > 0 && (
                  <span>
                    {" "}
                    (
                    {(
                      (analysisStatus.processedCases /
                        analysisStatus.totalCases) *
                      100
                    ).toFixed(1)}
                    %)
                  </span>
                )}
                {duration > 0 && (
                  <span style={{ marginLeft: 16 }}>
                    Elapsed: {formatDuration(duration)}
                  </span>
                )}
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width:
                      analysisStatus.totalCases > 0
                        ? `${
                            (analysisStatus.processedCases /
                              analysisStatus.totalCases) *
                            100
                          }%`
                        : "0%",
                  }}
                />
              </div>
            </div>
          )}

          {/* Live activity log */}
          {output.length > 0 && (
            <div className="activity-log">
              <h5 className="log-header">
                Activity Log (last {Math.min(output.length, 30)} entries)
              </h5>
              <div className="log-entries">
                {output.slice(-30).map((entry) => (
                  <div key={entry.id} className={`log-entry ${entry.type}`}>
                    <span className="log-timestamp">{entry.timestamp}</span>
                    {entry.text}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {existingThemes.length > 0 && (
        <section className="card">
          <div className="card-header row">
            <h3>
              {existingThemes.some((t) => t.theme)
                ? `Assigned themes (${
                    existingThemes.filter((t) => t.theme).length
                  } of ${existingThemes.length})`
                : `Cases to assign (${existingThemes.length})`}
            </h3>
            <span className="spacer" />
            <div className="row" style={{ gap: 8 }}>
              <button className="btn subtle" onClick={exportThemesCSV}>
                Export CSV
              </button>
              {existingThemes.some((t) => t.theme) && (
                <button
                  className="btn danger"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isRunning || isDeleting}
                >
                  Clear All Assignments
                </button>
              )}
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

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={deleteAllFinalThemes}
        title="Clear All Theme Assignments?"
        description={
          <>
            This will remove the assigned themes from{" "}
            <strong style={{ color: "#ef4444" }}>
              {existingThemes.filter((t) => t.theme).length} case
              {existingThemes.filter((t) => t.theme).length !== 1 ? "s" : ""}
            </strong>
            . This action cannot be undone.
          </>
        }
        warningMessage="The final theme definitions from P3b will be preserved. You can then re-run P4 to reassign themes."
        confirmText={isDeleting ? "Clearing..." : "Clear Assignments"}
        isDeleting={isDeleting}
      />
    </div>
  );
};

export default P4AssignThemes;
