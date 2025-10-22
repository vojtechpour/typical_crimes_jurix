import React, { useEffect, useRef, useState } from "react";
import ThemeGenerationItem from "./ThemeGenerationItem";
import P3FileSelector from "./P3FileSelector";
import P3bResults from "./P3bResults";
import P3CaseItem from "./P3CaseItem";
import ThemesOrganizer from "./ThemesOrganizer";

type OutputEntry = {
  id: number;
  text: string;
  type: string;
  timestamp: string;
};

type ThemeItem = {
  caseId: string | number;
  theme: string;
  initialCodes: string[];
  timestamp: Date;
};

type AnalysisStatus = {
  phase: string;
  currentCase: string | number | null;
  totalCases: number;
  processedCases: number;
  recentThemes: ThemeItem[];
  uniqueThemesCount: number;
  estimatedTimeRemaining: string | null;
  apiCalls: number;
  errors: Array<{ message?: string; timestamp?: Date } | string>;
  currentDataFile: string | null;
};

type P3bStatus = {
  isRunning: boolean;
  phase: string;
  output: OutputEntry[];
  finalThemes: string | null;
  error: string | null;
};

const P3Analysis: React.FC = () => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [output, setOutput] = useState<OutputEntry[]>([]);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [selectedDataFile, setSelectedDataFile] = useState<string>("");
  const [availableFiles, setAvailableFiles] = useState<any[]>([]);
  const [model, setModel] = useState<string>("gemini-2.0-flash");
  const [initialCodesStats, setInitialCodesStats] = useState<{
    processedCases: number;
    totalCases: number;
    uniqueCodesCount: number;
  } | null>(null);

  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>({
    phase: "Idle",
    currentCase: null,
    totalCases: 0,
    processedCases: 0,
    recentThemes: [],
    uniqueThemesCount: 0,
    estimatedTimeRemaining: null,
    apiCalls: 0,
    errors: [],
    currentDataFile: null,
  });

  const [p3bStatus, setP3bStatus] = useState<P3bStatus>({
    isRunning: false,
    phase: "Idle",
    output: [],
    finalThemes: null,
    error: null,
  });

  const [existingThemes, setExistingThemes] = useState<any[]>([]);
  const [loadingExistingThemes, setLoadingExistingThemes] =
    useState<boolean>(false);
  const [showAllThemes, setShowAllThemes] = useState<boolean>(false);
  const [expandedCases, setExpandedCases] = useState<Set<string | number>>(
    new Set()
  );

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    connectWebSocket();
    checkScriptStatus();
    loadAvailableFiles();

    const interval = window.setInterval(() => {
      if (isRunning && startTime) {
        setDuration(Date.now() - startTime);
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [isRunning, startTime]);

  useEffect(() => {
    if (selectedDataFile) {
      loadExistingThemes();
      loadInitialCodesStats(selectedDataFile);
    } else {
      setExistingThemes([]);
      setInitialCodesStats(null);
    }
  }, [selectedDataFile]);

  const connectWebSocket = () => {
    const ws = new WebSocket("ws://localhost:9000");
    wsRef.current = ws;

    ws.onopen = () => {};
    ws.onmessage = (event: MessageEvent<string>) => {
      handleMessage(event);
    };
    ws.onclose = () => {
      setTimeout(connectWebSocket, 3000);
    };
    ws.onerror = () => {};
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
    const escapeCsv = (value: any): string => {
      const text = value == null ? "" : String(value);
      const needsQuoting = /[",\n]/.test(text);
      const escaped = text.replace(/"/g, '""');
      return needsQuoting ? `"${escaped}"` : escaped;
    };

    const rows = existingThemes.map((t: any) => {
      const initialCodes = Array.isArray(t.initialCodes)
        ? t.initialCodes.join(" | ")
        : String(t.initialCodes || "");
      return [
        escapeCsv(t.caseId),
        escapeCsv(t.candidate_theme ?? t.theme ?? ""),
        escapeCsv(t.theme ?? ""),
        escapeCsv(initialCodes),
        escapeCsv(t.caseText || ""),
        escapeCsv(
          (t.timestamp && (t.timestamp.toISOString?.() || t.timestamp)) || ""
        ),
      ].join(",");
    });

    const csvContent = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `themes_${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/:/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportThemesHTML = () => {
    const rowsHtml = existingThemes
      .map((t: any) => {
        const safe = (s: string) =>
          (s || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
        const initialCodes = Array.isArray(t.initialCodes)
          ? t.initialCodes.join(" | ")
          : String(t.initialCodes || "");
        const ts =
          (t.timestamp && (t.timestamp.toISOString?.() || t.timestamp)) || "";
        return `<tr><td>${safe(String(t.caseId))}</td><td>${safe(
          t.candidate_theme ?? t.theme ?? ""
        )}</td><td>${safe(t.theme ?? "")}</td><td>${safe(
          initialCodes
        )}</td><td>${safe(t.caseText || "")}</td><td>${safe(ts)}</td></tr>`;
      })
      .join("");

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Themes Report</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:24px;color:#222}
    h1{margin:0 0 12px 0;font-size:20px}
    .meta{color:#666;margin-bottom:16px}
    table{border-collapse:collapse;width:100%}
    th,td{border:1px solid #ddd;padding:8px;vertical-align:top}
    th{background:#f6f6f6;text-align:left}
    tr:nth-child(even){background:#fafafa}
  </style>
  </head>
  <body>
    <h1>Themes</h1>
    <div class="meta">Exported at ${new Date().toISOString()}</div>
    <table>
      <thead><tr><th>Case ID</th><th>Candidate Theme</th><th>Final Theme</th><th>Initial Codes</th><th>Case Text</th><th>Timestamp</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </body>
  </html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `themes_${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/:/g, "-")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleMessage = (event: MessageEvent<string>) => {
    try {
      const message = JSON.parse(event.data);
      switch (message.type) {
        case "p3ProgressUpdate": {
          const progressData = message.data as any;
          setAnalysisStatus((prev) => {
            const newTheme: ThemeItem = {
              caseId: progressData.case_id,
              theme: progressData.candidate_theme,
              initialCodes: progressData.initial_codes || [],
              timestamp: new Date(progressData.timestamp),
            };

            const existingIndex = prev.recentThemes.findIndex(
              (theme) => theme.caseId === progressData.case_id
            );

            let updatedThemes: ThemeItem[];
            if (existingIndex >= 0) {
              updatedThemes = [...prev.recentThemes];
              updatedThemes[existingIndex] = newTheme;
            } else {
              updatedThemes = [newTheme, ...prev.recentThemes];
            }
            updatedThemes = updatedThemes.slice(0, 100);

            return {
              ...prev,
              processedCases: progressData.progress.processed,
              totalCases: progressData.progress.total,
              uniqueThemesCount: progressData.progress.unique_themes,
              currentCase: progressData.case_id,
              recentThemes: updatedThemes,
              apiCalls: prev.apiCalls + 1,
            };
          });
          break;
        }
        case "p3PhaseUpdate": {
          const phaseData = message.data as any;
          setAnalysisStatus((prev) => ({
            ...prev,
            phase: phaseData.phase,
            totalCases: phaseData.details.total_cases || prev.totalCases,
            processedCases:
              phaseData.details.processed_cases || prev.processedCases,
            uniqueThemesCount:
              phaseData.details.unique_themes || prev.uniqueThemesCount,
            currentDataFile:
              phaseData.details.data_file || prev.currentDataFile,
          }));
          break;
        }
        case "p3_completed_starting_p3b": {
          setAnalysisStatus((prev) => ({
            ...prev,
            phase: "P3 Complete - Starting P3b",
          }));
          setP3bStatus((prev) => ({ ...prev, phase: "Starting P3b" }));
          addOutput(
            "✅ P3 analysis completed! Automatically starting P3b theme finalization...",
            "success"
          );
          break;
        }
        case "p3b_script_started": {
          setP3bStatus((prev) => ({
            ...prev,
            isRunning: true,
            phase: "Finalizing Themes",
            output: [],
            error: null,
          }));
          addOutput("🎯 P3b: Starting theme finalization process...", "info");
          break;
        }
        case "p3b_output": {
          setP3bStatus((prev) => ({
            ...prev,
            output: [
              ...prev.output,
              {
                id: Date.now() + Math.random(),
                text: message.text,
                timestamp: message.timestamp,
                type: "info",
              },
            ].slice(-100),
          }));
          addOutput(`P3b: ${message.text}`, "info");
          break;
        }
        case "p3b_script_finished": {
          setP3bStatus((prev) => ({
            ...prev,
            isRunning: false,
            phase: "P3b Complete",
            finalThemes: message.output,
          }));
          setIsRunning(false);
          setAnalysisStatus((prev) => ({
            ...prev,
            phase: "Complete (P3 + P3b)",
          }));
          addOutput(
            "✅ P3b theme finalization completed successfully!",
            "success"
          );
          break;
        }
        case "p3b_script_failed": {
          setP3bStatus((prev) => ({
            ...prev,
            isRunning: false,
            phase: "P3b Failed",
            error: `P3b script failed with code ${message.code}`,
          }));
          setIsRunning(false);
          addOutput(
            `❌ P3b theme finalization failed with code ${message.code}`,
            "error"
          );
          break;
        }
        case "p3b_script_error": {
          setP3bStatus((prev) => ({ ...prev, error: message.data }));
          addOutput(`❌ P3b Error: ${message.data}`, "error");
          break;
        }
        case "p3_scripts_stopped": {
          setIsRunning(false);
          setP3bStatus((prev) => ({
            ...prev,
            isRunning: false,
            phase: "Stopped",
          }));
          setAnalysisStatus((prev) => ({ ...prev, phase: "Stopped" }));
          addOutput(
            `⏹️ Scripts stopped: ${message.stoppedProcesses.join(" and ")}`,
            "warning"
          );
          break;
        }
        case "output": {
          setOutput((prev) =>
            [
              ...prev,
              {
                id: Date.now() + Math.random(),
                text: message.text,
                timestamp: message.timestamp,
                type: message.level || "info",
              },
            ].slice(-1000)
          );
          break;
        }
        case "p3_script_started": {
          setIsRunning(true);
          setStartTime(Date.now());
          setAnalysisStatus((prev) => ({
            ...prev,
            phase: "Starting",
            apiCalls: 0,
            errors: [],
            currentDataFile: selectedDataFile || prev.currentDataFile,
          }));
          setP3bStatus({
            isRunning: false,
            phase: "Idle",
            output: [],
            finalThemes: null,
            error: null,
          });
          break;
        }
        case "p3_script_stopped": {
          if (!p3bStatus.isRunning) {
            setIsRunning(false);
            setAnalysisStatus((prev) => ({ ...prev, phase: "Stopped" }));
          }
          break;
        }
        case "p3_script_error": {
          setAnalysisStatus((prev) => ({
            ...prev,
            errors: [
              ...prev.errors,
              { message: message.data, timestamp: new Date(message.timestamp) },
            ].slice(-100),
          }));
          break;
        }
        default: {
          if (message.data && (message.data as string).includes) {
            setOutput((prev) =>
              [
                ...prev,
                {
                  id: Date.now() + Math.random(),
                  text: message.data,
                  timestamp: new Date().toLocaleTimeString(),
                  type: "info",
                },
              ].slice(-1000)
            );
          }
        }
      }
    } catch {
      // ignore parse errors
    }
  };

  const checkScriptStatus = async () => {
    try {
      const response = await fetch("/api/p3/status");
      const data = await response.json();
      setIsRunning(!!data.running);
      if (data.running) fetchResults();
    } catch {}
  };

  const startScript = async () => {
    try {
      setError(null);
      const response = await fetch("/api/p3/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataFile: selectedDataFile, model }),
      });
      const data = await response.json();
      if (response.ok) {
        setIsRunning(true);
        setStartTime(Date.now());
        addOutput(
          `🎯 Starting Phase 3 candidate theme generation (model: ${model})...`,
          "info"
        );
      } else {
        setError(data.error || "Failed to start P3 script");
        addOutput(`❌ Error: ${data.error}`, "error");
      }
    } catch (e: any) {
      setError("Failed to start P3 script: " + e.message);
      addOutput(`❌ Error: ${e.message}`, "error");
    }
  };

  const stopScript = async () => {
    try {
      const response = await fetch("/api/p3/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (response.ok) {
        setIsRunning(false);
        addOutput("⏹️ P3 stop request sent...", "warning");
      } else {
        setError(data.error || "Failed to stop P3 script");
      }
    } catch (e: any) {
      setError("Failed to stop P3 script: " + e.message);
    }
  };

  const fetchResults = async () => {
    try {
      const response = await fetch("/api/p3/results/latest");
      const data = await response.json();
      setResults(data);
    } catch {}
  };

  const loadAvailableFiles = async () => {
    try {
      const response = await fetch("/api/data-files");
      const files = await response.json();
      const filesWithCodes = files.filter(
        (file: any) =>
          file.name.includes("codes") ||
          file.name.includes("initial") ||
          file.name.includes("p2")
      );
      setAvailableFiles(filesWithCodes.length > 0 ? filesWithCodes : files);
    } catch {}
  };

  const loadInitialCodesStats = async (filename: string) => {
    try {
      const res = await fetch(`/api/data/${filename}/codes?limit=1`);
      const data = await res.json();
      if (res.ok && data.statistics) {
        setInitialCodesStats({
          processedCases: data.statistics.processedCases || 0,
          totalCases: data.statistics.totalCases || 0,
          uniqueCodesCount: data.statistics.uniqueCodesCount || 0,
        });
      } else {
        setInitialCodesStats(null);
      }
    } catch {
      setInitialCodesStats(null);
    }
  };

  const loadExistingThemes = async () => {
    if (!selectedDataFile) return;
    setLoadingExistingThemes(true);
    try {
      const response = await fetch(
        `/api/data/${selectedDataFile}/themes?limit=10000`
      );
      const data = await response.json();
      if (response.ok) {
        setExistingThemes(data.cases || []);
      }
    } catch {
    } finally {
      setLoadingExistingThemes(false);
    }
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const clearOutput = () => {
    setOutput([]);
    setError(null);
    setAnalysisStatus({
      phase: "Idle",
      currentCase: null,
      totalCases: 0,
      processedCases: 0,
      recentThemes: [],
      uniqueThemesCount: 0,
      estimatedTimeRemaining: null,
      apiCalls: 0,
      errors: [],
      currentDataFile: null,
    });
  };

  const addOutput = (text: string, type: string = "output") => {
    const timestamp = new Date().toLocaleTimeString();
    setOutput((prev) => [
      ...prev,
      { text, type, timestamp, id: Date.now() + Math.random() },
    ]);
  };

  const toggleCaseExpansion = (caseId: string | number) => {
    setExpandedCases((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(caseId)) newSet.delete(caseId);
      else newSet.add(caseId);
      return newSet;
    });
  };

  const handleThemeUpdate = async (
    caseId: string | number,
    themeType: string,
    newValue: string
  ) => {
    try {
      setExistingThemes((prevThemes: any[]) =>
        prevThemes.map((theme: any) =>
          theme.caseId === caseId ? { ...theme, [themeType]: newValue } : theme
        )
      );
      const response = await fetch(
        `/api/data/${selectedDataFile}/case/${caseId}/update-theme`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ themeType, theme: newValue }),
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update theme");
      }
      addOutput(`✅ Updated ${themeType} for case ${caseId}`, "success");
    } catch (e: any) {
      addOutput(`❌ Failed to update ${themeType}: ${e.message}`, "error");
      loadExistingThemes();
    }
  };

  return (
    <div className="p3-analysis">
      <div className="runner-header">
        <h2>Phase 3 Candidate Theme Analysis</h2>
        <p>Generate candidate themes from Phase 2 initial codes</p>
      </div>

      <div className="toolbar">
        <button
          onClick={startScript}
          disabled={isRunning || !selectedDataFile}
          className="btn primary"
        >
          {isRunning ? "Running..." : "Start P3 analysis"}
        </button>
        <button
          onClick={stopScript}
          disabled={!isRunning}
          className="btn danger"
        >
          Stop
        </button>
        <button onClick={clearOutput} className="btn subtle">
          Clear output
        </button>
        <button onClick={fetchResults} className="btn subtle">
          Refresh results
        </button>
        <div className="row" style={{ alignItems: "center" }}>
          <label htmlFor="p3-model-select" className="muted">
            Model
          </label>
          <select
            id="p3-model-select"
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
          <span className="badge info">{formatDuration(duration)}</span>
        )}
      </div>

      {error && <div className="badge warning">{error}</div>}

      <P3FileSelector
        availableFiles={availableFiles}
        selectedDataFile={selectedDataFile}
        setSelectedDataFile={setSelectedDataFile}
        isLoadingFiles={availableFiles.length === 0 && !selectedDataFile}
        initialCodesStats={initialCodesStats || undefined}
      />

      {existingThemes.length > 0 && (
        <section className="card">
          <div className="card-header row">
            <h3>Generated themes ({existingThemes.length})</h3>
            <span className="spacer" />
            <div className="row" style={{ gap: 8 }}>
              <button
                className="btn subtle"
                onClick={exportThemesCSV}
                title="Export themes as CSV"
              >
                Export CSV
              </button>
              <button
                className="btn subtle"
                onClick={exportThemesHTML}
                title="Export themes as HTML report"
              >
                Export HTML
              </button>
            </div>
          </div>
          <div className="card-body">
            <div className="codes-list">
              {existingThemes
                .slice(0, showAllThemes ? existingThemes.length : 20)
                .map((caseItem: any, index: number) => (
                  <P3CaseItem
                    key={caseItem.caseId || index}
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
                  View all generated themes
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

      {existingThemes.length > 0 && (
        <ThemesOrganizer
          themesData={existingThemes}
          onThemeUpdate={handleThemeUpdate}
        />
      )}

      {analysisStatus.recentThemes.length > 0 && (
        <section className="card">
          <div className="card-header row">
            <h3>
              Generated candidate themes ({analysisStatus.recentThemes.length})
            </h3>
          </div>
          <div className="card-body">
            <div className="themes-list">
              {analysisStatus.recentThemes.slice(0, 10).map((theme) => (
                <ThemeGenerationItem
                  key={theme.caseId}
                  theme={theme as any}
                  onEdit={() => {}}
                  onSave={(caseId, newTheme) =>
                    handleThemeUpdate(caseId, "candidate_theme", newTheme)
                  }
                  isSaving={false}
                />
              ))}
            </div>
            {analysisStatus.recentThemes.length > 10 && (
              <div className="more-themes-indicator">
                <span>
                  + {analysisStatus.recentThemes.length - 10} more themes
                  generated
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      <P3bResults p3bStatus={p3bStatus} />
    </div>
  );
};

export default P3Analysis;
