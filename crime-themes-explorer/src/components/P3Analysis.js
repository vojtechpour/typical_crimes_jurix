import React, { useState, useEffect, useRef } from "react";
import ThemeGenerationItem from "./ThemeGenerationItem";
import P3FileSelector from "./P3FileSelector";
import P3bResults from "./P3bResults";
import P3CaseItem from "./P3CaseItem";
import ThemesOrganizer from "./ThemesOrganizer";

const P3Analysis = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState([]);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [duration, setDuration] = useState(0);
  const [selectedDataFile, setSelectedDataFile] = useState("");
  const [availableFiles, setAvailableFiles] = useState([]);
  const [model, setModel] = useState("gemini-2.0-flash");

  // P3-specific state
  const [analysisStatus, setAnalysisStatus] = useState({
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

  // P3b-specific state
  const [p3bStatus, setP3bStatus] = useState({
    isRunning: false,
    phase: "Idle",
    output: [],
    finalThemes: null,
    error: null,
  });

  // Theme management state (simplified)
  const [existingThemes, setExistingThemes] = useState([]);
  const [loadingExistingThemes, setLoadingExistingThemes] = useState(false);
  const [showAllThemes, setShowAllThemes] = useState(false);
  const [expandedCases, setExpandedCases] = useState(new Set());

  const wsRef = useRef(null);

  useEffect(() => {
    connectWebSocket();
    checkScriptStatus();
    loadAvailableFiles();

    const interval = setInterval(() => {
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

  // Load existing themes when file is selected (but don't display them)
  useEffect(() => {
    if (selectedDataFile) {
      loadExistingThemes();
    } else {
      setExistingThemes([]);
    }
  }, [selectedDataFile]);

  const connectWebSocket = () => {
    const ws = new WebSocket("ws://localhost:9000");
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("P3 WebSocket connected");
    };

    ws.onmessage = (event) => {
      handleMessage(event);
    };

    ws.onclose = () => {
      console.log("P3 WebSocket disconnected");
      setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (error) => {
      console.error("P3 WebSocket error:", error);
    };
  };

  const handleMessage = (event) => {
    try {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case "p3ProgressUpdate":
          const progressData = message.data;
          console.log("P3 Progress update received:", progressData);

          setAnalysisStatus((prev) => {
            const newTheme = {
              caseId: progressData.case_id,
              theme: progressData.candidate_theme,
              initialCodes: progressData.initial_codes || [],
              timestamp: new Date(progressData.timestamp),
            };

            const existingIndex = prev.recentThemes.findIndex(
              (theme) => theme.caseId === progressData.case_id
            );

            let updatedThemes;
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

        case "p3PhaseUpdate":
          const phaseData = message.data;
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

        case "p3_completed_starting_p3b":
          setAnalysisStatus((prev) => ({
            ...prev,
            phase: "P3 Complete - Starting P3b",
          }));
          setP3bStatus((prev) => ({
            ...prev,
            phase: "Starting P3b",
          }));
          addOutput(
            "✅ P3 analysis completed! Automatically starting P3b theme finalization...",
            "success"
          );
          break;

        case "p3b_script_started":
          setP3bStatus((prev) => ({
            ...prev,
            isRunning: true,
            phase: "Finalizing Themes",
            output: [],
            error: null,
          }));
          addOutput("🎯 P3b: Starting theme finalization process...", "info");
          break;

        case "p3b_output":
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
            ].slice(-100), // Keep last 100 lines
          }));

          // Also add to main output
          addOutput(`P3b: ${message.text}`, "info");
          break;

        case "p3b_script_finished":
          setP3bStatus((prev) => ({
            ...prev,
            isRunning: false,
            phase: "P3b Complete",
            finalThemes: message.output, // Store the final themes output
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

        case "p3b_script_failed":
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

        case "p3b_script_error":
          setP3bStatus((prev) => ({
            ...prev,
            error: message.data,
          }));
          addOutput(`❌ P3b Error: ${message.data}`, "error");
          break;

        case "p3_scripts_stopped":
          setIsRunning(false);
          setP3bStatus((prev) => ({
            ...prev,
            isRunning: false,
            phase: "Stopped",
          }));
          setAnalysisStatus((prev) => ({
            ...prev,
            phase: "Stopped",
          }));
          addOutput(
            `⏹️ Scripts stopped: ${message.stoppedProcesses.join(" and ")}`,
            "warning"
          );
          break;

        case "output":
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

        case "p3_script_started":
          setIsRunning(true);
          setStartTime(Date.now());
          setAnalysisStatus((prev) => ({
            ...prev,
            phase: "Starting",
            apiCalls: 0,
            errors: [],
            currentDataFile: selectedDataFile || prev.currentDataFile,
          }));
          // Reset P3b status when starting new P3 analysis
          setP3bStatus({
            isRunning: false,
            phase: "Idle",
            output: [],
            finalThemes: null,
            error: null,
          });
          break;

        case "p3_script_stopped":
          // Only handle this if we're not transitioning to P3b
          if (!p3bStatus.isRunning) {
            setIsRunning(false);
            setAnalysisStatus((prev) => ({
              ...prev,
              phase: "Stopped",
            }));
          }
          break;

        case "p3_script_error":
          setAnalysisStatus((prev) => ({
            ...prev,
            errors: [
              ...prev.errors,
              {
                message: message.data,
                timestamp: new Date(message.timestamp),
              },
            ].slice(-100),
          }));
          break;

        default:
          if (message.data && message.data.includes) {
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
          break;
      }
    } catch (error) {
      console.error("Error parsing P3 WebSocket message:", error);
    }
  };

  const checkScriptStatus = async () => {
    try {
      const response = await fetch("/api/p3/status");
      const data = await response.json();
      setIsRunning(data.running);
      if (data.running) {
        fetchResults();
      }
    } catch (error) {
      console.error("Failed to check P3 script status:", error);
    }
  };

  const startScript = async () => {
    try {
      setError(null);
      try {
        console.log(`[AI] Starting P3 analysis with model: ${model}`);
      } catch {}
      const response = await fetch("/api/p3/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dataFile: selectedDataFile,
          model,
        }),
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
    } catch (error) {
      setError("Failed to start P3 script: " + error.message);
      addOutput(`❌ Error: ${error.message}`, "error");
    }
  };

  const stopScript = async () => {
    try {
      const response = await fetch("/api/p3/stop", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (response.ok) {
        setIsRunning(false);
        addOutput("⏹️ P3 stop request sent...", "warning");
      } else {
        setError(data.error || "Failed to stop P3 script");
      }
    } catch (error) {
      setError("Failed to stop P3 script: " + error.message);
    }
  };

  const fetchResults = async () => {
    try {
      const response = await fetch("/api/p3/results/latest");
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error("Failed to fetch P3 results:", error);
    }
  };

  const loadAvailableFiles = async () => {
    try {
      const response = await fetch("/api/data-files");
      const files = await response.json();
      // Filter for files that might have initial codes (P2 output)
      const filesWithCodes = files.filter(
        (file) =>
          file.name.includes("codes") ||
          file.name.includes("initial") ||
          file.name.includes("p2")
      );
      setAvailableFiles(filesWithCodes.length > 0 ? filesWithCodes : files);
    } catch (error) {
      console.error("Failed to load files:", error);
    }
  };

  const loadExistingThemes = async () => {
    if (!selectedDataFile) return;

    setLoadingExistingThemes(true);
    try {
      // Request all themes by setting a high limit to ensure we get all cases
      const response = await fetch(
        `/api/data/${selectedDataFile}/themes?limit=10000`
      );
      const data = await response.json();

      if (response.ok) {
        console.log("Loaded themes data:", data);
        setExistingThemes(data.cases || []);
      } else {
        console.error("Failed to load existing themes:", data.error);
      }
    } catch (error) {
      console.error("Error loading existing themes:", error);
    } finally {
      setLoadingExistingThemes(false);
    }
  };

  const formatDuration = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
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

  const addOutput = (text, type = "output") => {
    const timestamp = new Date().toLocaleTimeString();
    setOutput((prev) => [
      ...prev,
      {
        text,
        type,
        timestamp,
        id: Date.now() + Math.random(),
      },
    ]);
  };

  const toggleCaseExpansion = (caseId) => {
    setExpandedCases((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(caseId)) {
        newSet.delete(caseId);
      } else {
        newSet.add(caseId);
      }
      return newSet;
    });
  };

  const handleThemeUpdate = async (caseId, themeType, newValue) => {
    try {
      // Update the local state immediately for UI responsiveness
      setExistingThemes((prevThemes) =>
        prevThemes.map((theme) =>
          theme.caseId === caseId ? { ...theme, [themeType]: newValue } : theme
        )
      );

      // Save to backend
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

      const result = await response.json();
      console.log(
        `Successfully updated ${themeType} for case ${caseId}:`,
        newValue
      );

      // Show success message
      addOutput(`✅ Updated ${themeType} for case ${caseId}`, "success");
    } catch (error) {
      console.error("Error updating theme:", error);
      addOutput(`❌ Failed to update ${themeType}: ${error.message}`, "error");

      // Revert local state on error
      loadExistingThemes();
    }
  };

  return (
    <div className="p3-analysis">
      <div className="runner-header">
        <h2>Phase 3 Candidate Theme Analysis</h2>
        <p>Generate candidate themes from Phase 2 initial codes</p>
      </div>

      {/* Controls */}
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
          </select>
        </div>
        <span className="spacer" />
        <span className="badge">{isRunning ? "Running" : "Stopped"}</span>
        {duration > 0 && (
          <span className="badge info">{formatDuration(duration)}</span>
        )}
      </div>

      {error && <div className="badge warning">{error}</div>}

      {/* File Selection */}
      <P3FileSelector
        availableFiles={availableFiles}
        selectedDataFile={selectedDataFile}
        setSelectedDataFile={setSelectedDataFile}
      />

      {/* Theme Data Browser */}
      {existingThemes.length > 0 && (
        <section className="card">
          <div className="card-header row">
            <h3>Generated themes ({existingThemes.length})</h3>
            <span className="spacer" />
            <button className="btn subtle">Export themes</button>
          </div>
          <div className="card-body">
            <div className="codes-list">
              {existingThemes
                .slice(0, showAllThemes ? existingThemes.length : 20)
                .map((caseItem, index) => (
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

      {/* Theme Organization Tool */}
      {existingThemes.length > 0 && (
        <ThemesOrganizer
          themesData={existingThemes}
          onThemeUpdate={handleThemeUpdate}
        />
      )}

      {/* Generated Themes Display */}
      {analysisStatus.recentThemes.length > 0 && (
        <section className="card">
          <div className="card-header row">
            <h3>
              Generated candidate themes ({analysisStatus.recentThemes.length})
            </h3>
          </div>
          <div className="card-body">
            <div className="themes-list">
              {analysisStatus.recentThemes.slice(0, 10).map((theme, index) => (
                <ThemeGenerationItem
                  key={theme.caseId}
                  theme={theme}
                  onEdit={() => {}}
                  onSave={() => {}}
                  isSaving={false}
                  onThemeUpdate={handleThemeUpdate}
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

      {/* P3b Theme Finalization Display */}
      <P3bResults p3bStatus={p3bStatus} />
    </div>
  );
};

export default P3Analysis;
