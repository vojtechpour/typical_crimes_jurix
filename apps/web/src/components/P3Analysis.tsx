import React, { useEffect, useRef, useState } from "react";
import ThemeGenerationItem from "./ThemeGenerationItem";
import P3FileSelector from "./P3FileSelector";
import P3bResults from "./P3bResults";
import P3CaseItem from "./P3CaseItem";
import ThemesOrganizer from "./ThemesOrganizer";
import DeleteConfirmModal from "./ui/DeleteConfirmModal";

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
  const [model, setModel] = useState<string>("gemini-3-pro-preview");
  const [customInstructions, setCustomInstructions] = useState<string>("");
  const [showInstructions, setShowInstructions] = useState<boolean>(false);
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
  const [expandedCases, setExpandedCases] = useState<Set<string | number>>(
    new Set()
  );

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Search, filter, and sort state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterType, setFilterType] = useState<"all" | "candidate" | "final">(
    "all"
  );
  const [sortBy, setSortBy] = useState<"time" | "caseId" | "theme">("time");

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(20);

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
    // Use the correct protocol and host for production vs development
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = import.meta.env.DEV
      ? `${wsProtocol}//${window.location.host}/ws` // Goes through Vite proxy
      : `${wsProtocol}//${window.location.host}`; // Direct in production

    console.log("[P3 WS] Connecting to:", wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[P3 WS] Connected to WebSocket");
    };
    ws.onmessage = (event: MessageEvent<string>) => {
      console.log("[P3 WS] Received message:", event.data.substring(0, 100));
      handleMessage(event);
    };
    ws.onclose = () => {
      console.log("[P3 WS] WebSocket closed, reconnecting in 3s...");
      setTimeout(connectWebSocket, 3000);
    };
    ws.onerror = (error) => {
      console.error("[P3 WS] WebSocket error:", error);
    };
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

          // Add to activity log
          const themePreview = progressData.candidate_theme
            ? progressData.candidate_theme.substring(0, 60) +
              (progressData.candidate_theme.length > 60 ? "..." : "")
            : "No theme";
          addOutput(
            `Case ${progressData.case_id}: ${themePreview} (${progressData.progress.processed}/${progressData.progress.total})`,
            "success"
          );

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

          // Update existingThemes immediately for live updates
          setExistingThemes((prevThemes: any[]) => {
            const existingThemeData = {
              caseId: progressData.case_id,
              candidate_theme: progressData.candidate_theme,
              initialCodes: progressData.initial_codes || [],
              caseText: progressData.case_text || "",
              timestamp: new Date(progressData.timestamp),
            };

            const existingIndex = prevThemes.findIndex(
              (t: any) => t.caseId === progressData.case_id
            );

            if (existingIndex >= 0) {
              // Update existing theme
              const updatedThemes = [...prevThemes];
              updatedThemes[existingIndex] = {
                ...updatedThemes[existingIndex],
                ...existingThemeData,
              };
              return updatedThemes;
            } else {
              // Add new theme at the beginning
              return [existingThemeData, ...prevThemes];
            }
          });

          // Reload existing themes every 10 cases to sync with backend
          if (progressData.progress.processed % 10 === 0) {
            loadExistingThemes();
          }
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
            "P3 analysis completed! Automatically starting P3b theme finalization...",
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
          addOutput("P3b: Starting theme finalization process...", "info");
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
            "P3b theme finalization completed successfully!",
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
            `P3b theme finalization failed with code ${message.code}`,
            "error"
          );
          break;
        }
        case "p3b_script_error": {
          setP3bStatus((prev) => ({ ...prev, error: message.data }));
          addOutput(`P3b Error: ${message.data}`, "error");
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
            `Scripts stopped: ${message.stoppedProcesses.join(" and ")}`,
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
          addOutput("Phase 3 analysis started...", "info");
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
            addOutput("Phase 3 analysis stopped", "warning");
          }
          break;
        }
        case "p3_script_error": {
          addOutput(`Error: ${message.data}`, "error");
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
        body: JSON.stringify({
          dataFile: selectedDataFile,
          model,
          customInstructions: customInstructions.trim() || undefined,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setIsRunning(true);
        setStartTime(Date.now());
        addOutput(
          `Starting Phase 3 candidate theme generation (model: ${model})...`,
          "info"
        );
        if (customInstructions.trim()) {
          addOutput(
            `Custom instructions: "${customInstructions.trim()}"`,
            "info"
          );
        }
      } else {
        setError(data.error || "Failed to start P3 script");
        addOutput(`Error: ${data.error}`, "error");
      }
    } catch (e: any) {
      setError("Failed to start P3 script: " + e.message);
      addOutput(`Error: ${e.message}`, "error");
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
        addOutput("P3 stop request sent...", "warning");
      } else {
        setError(data.error || "Failed to stop P3 script");
      }
    } catch (e: any) {
      setError("Failed to stop P3 script: " + e.message);
    }
  };

  const startP3bManually = async () => {
    try {
      setError(null);
      const response = await fetch("/api/p3b/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataFile: selectedDataFile, model }),
      });
      const data = await response.json();
      if (response.ok) {
        setP3bStatus((prev) => ({
          ...prev,
          isRunning: true,
          phase: "Starting P3b",
          error: null,
        }));
        addOutput(
          `Manually starting Phase 3b theme finalization (model: ${model})...`,
          "info"
        );
      } else {
        setError(data.error || "Failed to start P3b script");
        addOutput(`Error: ${data.error}`, "error");
      }
    } catch (e: any) {
      setError("Failed to start P3b script: " + e.message);
      addOutput(`Error: ${e.message}`, "error");
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
    newValue: string | null
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
      addOutput(`Updated ${themeType} for case ${caseId}`, "success");
    } catch (e: any) {
      addOutput(`Failed to update ${themeType}: ${e.message}`, "error");
      loadExistingThemes();
    }
  };

  const handleCodeUpdate = async (caseId: string | number, codes: string[]) => {
    try {
      setExistingThemes((prevThemes: any[]) =>
        prevThemes.map((theme: any) =>
          theme.caseId === caseId ? { ...theme, initialCodes: codes } : theme
        )
      );
      const filename = selectedDataFile.includes("/")
        ? selectedDataFile.split("/").pop()!
        : selectedDataFile;
      const response = await fetch(
        `/api/data/${encodeURIComponent(filename)}/case/${encodeURIComponent(
          caseId
        )}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ codes }),
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update codes");
      }
      addOutput(`Updated codes for case ${caseId}`, "success");
    } catch (e: any) {
      addOutput(`Failed to update codes: ${e.message}`, "error");
      loadExistingThemes();
    }
  };

  const handleDeleteAllCandidateThemes = async () => {
    if (!selectedDataFile) return;

    setIsDeleting(true);
    try {
      const filename = selectedDataFile.includes("/")
        ? selectedDataFile.split("/").pop()!
        : selectedDataFile;

      const response = await fetch(
        `/api/data/${encodeURIComponent(filename)}/delete-all-candidate-themes`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete candidate themes");
      }

      const result = await response.json();
      addOutput(
        `Successfully deleted ${result.deletedCount} candidate theme${
          result.deletedCount !== 1 ? "s" : ""
        }`,
        "success"
      );

      // Reload themes to reflect the changes
      await loadExistingThemes();
      setShowDeleteModal(false);
    } catch (e: any) {
      addOutput(`Failed to delete candidate themes: ${e.message}`, "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const getCandidateThemesCount = () => {
    return existingThemes.filter((t: any) => t.candidate_theme && !t.theme)
      .length;
  };

  // Filter and sort themes
  const getFilteredAndSortedThemes = () => {
    let filtered = [...existingThemes];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((theme: any) => {
        const caseIdMatch = String(theme.caseId || "")
          .toLowerCase()
          .includes(query);
        const candidateMatch = (theme.candidate_theme || "")
          .toLowerCase()
          .includes(query);
        const finalMatch = (theme.theme || "").toLowerCase().includes(query);
        const codesMatch = Array.isArray(theme.initialCodes)
          ? theme.initialCodes.some((code: string) =>
              code.toLowerCase().includes(query)
            )
          : false;
        const caseTextMatch = (theme.caseText || "")
          .toLowerCase()
          .includes(query);
        return (
          caseIdMatch ||
          candidateMatch ||
          finalMatch ||
          codesMatch ||
          caseTextMatch
        );
      });
    }

    // Apply type filter
    if (filterType === "candidate") {
      filtered = filtered.filter((t: any) => t.candidate_theme && !t.theme);
    } else if (filterType === "final") {
      filtered = filtered.filter((t: any) => t.theme);
    }

    // Apply sort
    filtered.sort((a: any, b: any) => {
      switch (sortBy) {
        case "time":
          return (
            new Date(b.timestamp || 0).getTime() -
            new Date(a.timestamp || 0).getTime()
          );
        case "caseId":
          return String(a.caseId || "").localeCompare(String(b.caseId || ""));
        case "theme": {
          const aTheme = (a.theme || a.candidate_theme || "").toLowerCase();
          const bTheme = (b.theme || b.candidate_theme || "").toLowerCase();
          return aTheme.localeCompare(bTheme);
        }
        default:
          return 0;
      }
    });

    return filtered;
  };

  // Get paginated themes
  const getPaginatedThemes = () => {
    const filtered = getFilteredAndSortedThemes();
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filtered.slice(startIndex, endIndex);
  };

  // Calculate total pages
  const totalPages = Math.ceil(
    getFilteredAndSortedThemes().length / itemsPerPage
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType, sortBy, itemsPerPage]);

  return (
    <div className="p3-analysis">
      <div className="runner-header">
        <h2>Phase 3: Candidate Theme Generation</h2>
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
            <option value="gemini-3-pro-preview">
              Gemini 3 Pro Preview (suggested)
            </option>
            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
            <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite</option>
            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
            <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash-Lite</option>
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
          style={{
            position: "relative",
          }}
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
          <span className="badge info">{formatDuration(duration)}</span>
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
              htmlFor="custom-instructions"
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
            id="custom-instructions"
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            placeholder="Add specific instructions for theme generation...&#10;&#10;Examples:&#10;• Focus on themes related to emotional responses&#10;• Group similar concepts under broader categories&#10;• Pay attention to temporal patterns&#10;• Use academic/formal language for theme names"
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
            These instructions will be included in the AI prompt to guide how
            themes are generated. Leave empty to use default behavior.
          </p>
        </div>
      )}

      {error && <div className="badge warning">{error}</div>}

      <P3FileSelector
        availableFiles={availableFiles}
        selectedDataFile={selectedDataFile}
        setSelectedDataFile={setSelectedDataFile}
        isLoadingFiles={availableFiles.length === 0 && !selectedDataFile}
        initialCodesStats={initialCodesStats || undefined}
      />

      {/* Progress Section */}
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
                <div className="stat-number">{analysisStatus.apiCalls}</div>
                <div className="stat-label">API Calls</div>
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
                  {analysisStatus.currentCase &&
                    `: Case ${analysisStatus.currentCase}`}
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
                Activity Log (last {Math.min(output.length, 20)} entries)
              </h5>
              <div className="log-entries">
                {output.slice(-20).map((entry) => (
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
              Generated themes{" "}
              {existingThemes.length > 0
                ? `(${getFilteredAndSortedThemes().length}${
                    getFilteredAndSortedThemes().length !==
                    existingThemes.length
                      ? ` of ${existingThemes.length}`
                      : ""
                  })`
                : ""}
            </h3>
            <span className="spacer" />
            <div className="row" style={{ gap: 8 }}>
              {getCandidateThemesCount() > 0 && (
                <button
                  className="btn danger"
                  onClick={() => setShowDeleteModal(true)}
                  title="Delete all candidate themes"
                  disabled={isRunning}
                >
                  Delete All Candidate Themes
                </button>
              )}
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
            {/* Search, Filter, and Sort Controls */}
            <div className="controls-bar">
              <input
                type="text"
                className="search-input"
                placeholder="Search by case ID, themes, codes, or text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              <select
                className="filter-select"
                value={filterType}
                onChange={(e) =>
                  setFilterType(e.target.value as "all" | "candidate" | "final")
                }
              >
                <option value="all">All themes</option>
                <option value="candidate">Candidate only</option>
                <option value="final">Final only</option>
              </select>

              <select
                className="filter-select"
                value={sortBy}
                onChange={(e) =>
                  setSortBy(e.target.value as "time" | "caseId" | "theme")
                }
              >
                <option value="time">Sort by: Time (newest)</option>
                <option value="caseId">Sort by: Case ID</option>
                <option value="theme">Sort by: Theme</option>
              </select>

              <select
                className="filter-select"
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
              >
                <option value={10}>Show: 10</option>
                <option value={20}>Show: 20</option>
                <option value={50}>Show: 50</option>
                <option value={100}>Show: 100</option>
                <option value={999999}>Show: All</option>
              </select>

              {(searchQuery || filterType !== "all") && (
                <button
                  className="btn subtle"
                  onClick={() => {
                    setSearchQuery("");
                    setFilterType("all");
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>

            <div className="codes-list">
              {getFilteredAndSortedThemes().length === 0 ? (
                <div className="codes-list-empty">
                  No themes match your search or filters.
                </div>
              ) : (
                getPaginatedThemes().map((caseItem: any, index: number) => (
                  <P3CaseItem
                    key={caseItem.caseId || index}
                    caseItem={caseItem}
                    expandedCases={expandedCases}
                    toggleCaseExpansion={toggleCaseExpansion}
                    onThemeUpdate={handleThemeUpdate}
                    onCodeUpdate={handleCodeUpdate}
                  />
                ))
              )}
            </div>

            {/* Pagination Controls */}
            {getFilteredAndSortedThemes().length > 0 && totalPages > 1 && (
              <div className="pagination-bar">
                <div className="pagination-info">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                  {Math.min(
                    currentPage * itemsPerPage,
                    getFilteredAndSortedThemes().length
                  )}{" "}
                  of {getFilteredAndSortedThemes().length} cases
                </div>

                <div className="pagination-controls">
                  <button
                    className="btn subtle"
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={currentPage === 1}
                  >
                    ← Previous
                  </button>

                  <div className="page-numbers">
                    {(() => {
                      const pages: React.ReactNode[] = [];
                      const maxPagesToShow = 5;
                      let startPage = Math.max(
                        1,
                        currentPage - Math.floor(maxPagesToShow / 2)
                      );
                      let endPage = Math.min(
                        totalPages,
                        startPage + maxPagesToShow - 1
                      );

                      if (endPage - startPage < maxPagesToShow - 1) {
                        startPage = Math.max(1, endPage - maxPagesToShow + 1);
                      }

                      if (startPage > 1) {
                        pages.push(
                          <button
                            key={1}
                            className="btn subtle"
                            onClick={() => setCurrentPage(1)}
                          >
                            1
                          </button>
                        );
                        if (startPage > 2) {
                          pages.push(
                            <span
                              key="ellipsis-start"
                              className="page-ellipsis"
                            >
                              ...
                            </span>
                          );
                        }
                      }

                      for (let i = startPage; i <= endPage; i++) {
                        pages.push(
                          <button
                            key={i}
                            className={`btn ${
                              i === currentPage ? "primary" : "subtle"
                            }`}
                            onClick={() => setCurrentPage(i)}
                          >
                            {i}
                          </button>
                        );
                      }

                      if (endPage < totalPages) {
                        if (endPage < totalPages - 1) {
                          pages.push(
                            <span key="ellipsis-end" className="page-ellipsis">
                              ...
                            </span>
                          );
                        }
                        pages.push(
                          <button
                            key={totalPages}
                            className="btn subtle"
                            onClick={() => setCurrentPage(totalPages)}
                          >
                            {totalPages}
                          </button>
                        );
                      }

                      return pages;
                    })()}
                  </div>

                  <button
                    className="btn subtle"
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={currentPage === totalPages}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}

            {/* Show summary when showing all items */}
            {getFilteredAndSortedThemes().length > 0 && totalPages <= 1 && (
              <div className="more-codes-indicator">
                <span>
                  Showing all {getFilteredAndSortedThemes().length} cases
                </span>
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

      {isRunning && analysisStatus.recentThemes.length > 0 && (
        <div className="live-themes-section">
          <div className="section-header">
            <h4>
              Live: Generated candidate themes (
              {analysisStatus.recentThemes.length})
            </h4>
            <div className="section-stats">
              <span className="badge">
                {analysisStatus.processedCases}/{analysisStatus.totalCases}{" "}
                cases
              </span>
              <span className="badge info">
                {analysisStatus.uniqueThemesCount} unique themes
              </span>
            </div>
          </div>
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
                generated (scroll down to see all saved themes)
              </span>
            </div>
          )}
        </div>
      )}

      <P3bResults
        p3bStatus={p3bStatus}
        candidateThemes={[
          ...new Set(
            existingThemes
              .filter((t: any) => t.candidate_theme)
              .map((t: any) => t.candidate_theme.trim())
          ),
        ]}
        onClear={async () => {
          if (!selectedDataFile) return;
          try {
            const res = await fetch(
              `/api/data/${selectedDataFile}/delete-all-final-themes`,
              { method: "DELETE" }
            );
            if (res.ok) {
              setP3bStatus((prev) => ({
                ...prev,
                isRunning: false,
                phase: "Cleared",
                finalThemes: null,
                error: null,
              }));
              addOutput("Final themes deleted successfully", "success");
            } else {
              const data = await res.json();
              addOutput(
                `Failed to delete final themes: ${data.error}`,
                "error"
              );
            }
          } catch (err) {
            addOutput(`Failed to delete final themes: ${err}`, "error");
          }
        }}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAllCandidateThemes}
        title="Delete All Candidate Themes?"
        description={
          <>
            This will permanently delete{" "}
            <strong style={{ color: "#ef4444" }}>
              {getCandidateThemesCount()} candidate theme
              {getCandidateThemesCount() !== 1 ? "s" : ""}
            </strong>{" "}
            from the selected data file. This action cannot be undone.
          </>
        }
        warningMessage="Final themes will not be affected by this action."
        confirmText={isDeleting ? "Deleting..." : "Delete All"}
        isDeleting={isDeleting}
      />
    </div>
  );
};

export default P3Analysis;
