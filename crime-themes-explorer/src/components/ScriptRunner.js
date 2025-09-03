import React, { useState, useEffect, useRef } from "react";

const ScriptRunner = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState([]);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [duration, setDuration] = useState(0);
  const [selectedDataFile, setSelectedDataFile] = useState("");
  const [availableFiles, setAvailableFiles] = useState([]);

  // New parsed status state
  const [analysisStatus, setAnalysisStatus] = useState({
    phase: "Idle",
    currentCase: null,
    totalCases: 0,
    processedCases: 0,
    currentBatch: 0,
    recentCompletions: [],
    uniqueCodesCount: 0,
    estimatedTimeRemaining: null,
    apiCalls: 0,
    errors: [],
    currentDataFile: null, // Track which file is being processed
  });

  const [showRawLogs, setShowRawLogs] = useState(false);
  const [showAllCodes, setShowAllCodes] = useState(false);
  const [editingCodes, setEditingCodes] = useState({});
  const [savingCodes, setSavingCodes] = useState({}); // Track which codes are being saved
  const [regeneratingCodes, setRegeneratingCodes] = useState({}); // Track which codes are being regenerated
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [regenerateModalData, setRegenerateModalData] = useState(null);
  const [regenerateInstructions, setRegenerateInstructions] = useState("");
  const [globalInstructions, setGlobalInstructions] = useState(""); // Global instructions for all analysis
  const [bulkRegenerating, setBulkRegenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(null);
  const [model, setModel] = useState("gemini-2.0-flash");

  const wsRef = useRef(null);
  const outputRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    connectWebSocket();
    checkScriptStatus();
    loadAvailableFiles();

    // Update duration every second when running
    const interval = setInterval(() => {
      if (isRunning && startTime) {
        setDuration(Date.now() - startTime);
      }
    }, 1000);

    // Handle custom events for tab switching
    const handleSwitchToDataBrowser = (event) => {
      if (event.detail && event.detail.filename) {
        // Switch to data browser tab with specific file
        window.dispatchEvent(
          new CustomEvent("switchTab", {
            detail: { tab: 0, filename: event.detail.filename },
          })
        );
      } else {
        // Switch to data browser tab
        window.dispatchEvent(
          new CustomEvent("switchTab", { detail: { tab: 0 } })
        );
      }
    };

    window.addEventListener("switchToDataBrowser", handleSwitchToDataBrowser);

    return () => {
      clearInterval(interval);
      window.removeEventListener(
        "switchToDataBrowser",
        handleSwitchToDataBrowser
      );
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [isRunning, startTime]);

  // Auto-scroll to bottom of output
  useEffect(() => {
    if (outputRef.current && showRawLogs) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, showRawLogs]);

  const connectWebSocket = () => {
    const ws = new WebSocket("ws://localhost:9000");
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected");
    };

    ws.onmessage = (event) => {
      handleMessage(event);
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
      // Try to reconnect after 3 seconds
      setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  };

  const handleMessage = (event) => {
    try {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case "progressUpdate":
          // Handle case completion updates
          const progressData = message.data;
          console.log("Progress update received:", progressData); // Debug log

          setAnalysisStatus((prev) => {
            const newCompletion = {
              caseId: progressData.case_id,
              codesText: Array.isArray(progressData.codes)
                ? JSON.stringify(progressData.codes)
                : typeof progressData.codes === "string"
                ? progressData.codes
                : JSON.stringify([progressData.codes]),
              timestamp: new Date(progressData.timestamp),
              caseText: progressData.progress.case_text || "",
            };

            console.log("New completion object:", newCompletion); // Debug log

            // Check if this case already exists to prevent duplicates
            const existingIndex = prev.recentCompletions.findIndex(
              (completion) => completion.caseId === progressData.case_id
            );

            let updatedCompletions;
            if (existingIndex >= 0) {
              // Update existing completion (overwrite with new data)
              updatedCompletions = [...prev.recentCompletions];
              updatedCompletions[existingIndex] = newCompletion;
            } else {
              // Add new completion to the beginning (most recent first)
              updatedCompletions = [newCompletion, ...prev.recentCompletions];
            }

            // Keep only the most recent 100 completions to prevent memory issues
            updatedCompletions = updatedCompletions.slice(0, 100);

            return {
              ...prev,
              processedCases: progressData.progress.processed,
              totalCases: progressData.progress.total,
              uniqueCodesCount: progressData.progress.unique_codes,
              currentCase: progressData.case_id,
              recentCompletions: updatedCompletions,
              apiCalls: prev.apiCalls + 1,
            };
          });
          break;

        case "phaseUpdate":
          // Handle phase changes
          const phaseData = message.data;
          setAnalysisStatus((prev) => ({
            ...prev,
            phase: phaseData.phase,
            totalCases: phaseData.details.total_cases || prev.totalCases,
            processedCases:
              phaseData.details.processed_cases || prev.processedCases,
            uniqueCodesCount:
              phaseData.details.unique_codes || prev.uniqueCodesCount,
            currentDataFile:
              phaseData.details.data_file || prev.currentDataFile,
          }));
          break;

        case "bulkProgressUpdate":
          // Handle bulk regeneration progress updates
          const bulkData = message.data;
          setBulkProgress({
            current: bulkData.current,
            total: bulkData.total,
            status: bulkData.status,
            percentage: bulkData.percentage,
            currentCaseId: bulkData.case_id,
          });

          // Add log entry for visible progress
          if (bulkData.case_id) {
            addOutput(
              `🔄 Regenerating case ${bulkData.case_id}... (${bulkData.current}/${bulkData.total})`,
              "info"
            );
          } else if (
            bulkData.current === bulkData.total &&
            bulkData.total > 0
          ) {
            addOutput(
              `✅ Bulk regeneration completed! Updated ${bulkData.total} cases.`,
              "success"
            );
          }
          break;

        case "output":
          // Handle regular log output
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

        case "script_started":
          setIsRunning(true);
          setStartTime(Date.now());
          setAnalysisStatus((prev) => ({
            ...prev,
            phase: "Starting",
            apiCalls: 0,
            errors: [],
            currentDataFile: selectedDataFile || prev.currentDataFile,
          }));
          break;

        case "script_stopped":
        case "script_finished":
          setIsRunning(false);
          setAnalysisStatus((prev) => ({
            ...prev,
            phase: message.type === "script_finished" ? "Complete" : "Stopped",
          }));
          break;

        case "script_error":
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
          // Handle legacy message format
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
      console.error("Error parsing WebSocket message:", error);
    }
  };

  const checkScriptStatus = async () => {
    try {
      const response = await fetch("/api/script/status");
      const data = await response.json();
      setIsRunning(data.running);
      if (data.running) {
        fetchResults();
      }
    } catch (error) {
      console.error("Failed to check script status:", error);
    }
  };

  const startScript = async () => {
    try {
      setError(null);
      try {
        console.log(`[AI] Starting Phase 2 analysis with model: ${model}`);
      } catch {}
      const response = await fetch("/api/script/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          globalInstructions: globalInstructions.trim(),
          model,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsRunning(true);
        setStartTime(Date.now());
        const methodUsed = globalInstructions.trim()
          ? "with custom instructions"
          : "using best practices";
        addOutput(`🔄 Starting Phase 2 analysis ${methodUsed}...`, "info");
      } else {
        setError(data.error || "Failed to start script");
        addOutput(`❌ Error: ${data.error}`, "error");
      }
    } catch (error) {
      setError("Failed to start script: " + error.message);
      addOutput(`❌ Error: ${error.message}`, "error");
    }
  };

  const stopScript = async () => {
    try {
      const response = await fetch("/api/script/stop", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (response.ok) {
        setIsRunning(false);
        addOutput("⏹️ Stop request sent...", "warning");
      } else {
        setError(data.error || "Failed to stop script");
      }
    } catch (error) {
      setError("Failed to stop script: " + error.message);
    }
  };

  const fetchResults = async () => {
    try {
      const response = await fetch("/api/results/latest");
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error("Failed to fetch results:", error);
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
    setProgress(null);
    setError(null);
    setAnalysisStatus({
      phase: "Idle",
      currentCase: null,
      totalCases: 0,
      processedCases: 0,
      currentBatch: 0,
      recentCompletions: [],
      uniqueCodesCount: 0,
      estimatedTimeRemaining: null,
      apiCalls: 0,
      errors: [],
      currentDataFile: null,
    });
  };

  const loadAvailableFiles = async () => {
    try {
      const response = await fetch("/api/data-files");
      const files = await response.json();
      setAvailableFiles(files);
    } catch (error) {
      console.error("Failed to load files:", error);
    }
  };

  const handleDeleteSelectedFile = async () => {
    if (!selectedDataFile) return;
    const confirmDelete = window.confirm(
      `Delete file "${selectedDataFile}" from uploads? This cannot be undone.`
    );
    if (!confirmDelete) return;

    try {
      const response = await fetch(`/api/data/${selectedDataFile}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      const result = await response.json();
      if (response.ok) {
        addOutput(`🗑️ Deleted file ${selectedDataFile}`, "warning");
        setSelectedDataFile("");
        setAnalysisStatus((prev) => ({
          ...prev,
          totalCases: 0,
          processedCases: 0,
          uniqueCodesCount: 0,
          recentCompletions: [],
          currentDataFile: null,
        }));
        await loadAvailableFiles();
      } else {
        throw new Error(result.error || "Failed to delete file");
      }
    } catch (error) {
      console.error("Error deleting file:", error);
      addOutput(`❌ Failed to delete file: ${error.message}`, "error");
    }
  };

  const handleDeleteAllCodes = async () => {
    const currentFile = analysisStatus.currentDataFile || selectedDataFile;
    if (!currentFile) {
      addOutput("❌ No data file selected", "error");
      return;
    }
    const filename = currentFile.includes("/")
      ? currentFile.split("/").pop()
      : currentFile;

    const confirmed = window.confirm(
      `Delete all initial codes in "${filename}"? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/data/${filename}/codes`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to delete codes");
      }

      addOutput(
        `🗑️ Deleted initial codes in ${result.casesCleared} cases from ${filename}`,
        "warning"
      );

      // Clear UI state of generated codes
      setAnalysisStatus((prev) => ({
        ...prev,
        processedCases: 0,
        uniqueCodesCount: 0,
        recentCompletions: [],
      }));

      // Reload existing codes to reflect cleared state
      if (filename) {
        await loadExistingCodes(filename);
      }
    } catch (error) {
      console.error("Failed to delete all codes:", error);
      addOutput(`❌ Failed to delete all codes: ${error.message}`, "error");
    }
  };

  const startScriptWithFile = async (filename = null) => {
    try {
      setError(null);
      try {
        console.log(
          `[AI] Starting Phase 2 analysis for file ${
            filename || "(default)"
          } with model: ${model}`
        );
      } catch {}
      const response = await fetch("/api/script/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dataFile: filename,
          globalInstructions: globalInstructions.trim(),
          model,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsRunning(true);
        setStartTime(Date.now());
        const methodUsed = globalInstructions.trim()
          ? "with custom instructions"
          : "using best practices";
        addOutput(
          `🔄 Starting Phase 2 analysis${
            filename ? ` with file: ${filename}` : ""
          } ${methodUsed}...`,
          "info"
        );
      } else {
        setError(data.error || "Failed to start script");
        addOutput(`❌ Error: ${data.error}`, "error");
      }
    } catch (error) {
      setError("Failed to start script: " + error.message);
      addOutput(`❌ Error: ${error.message}`, "error");
    }
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

  // Helper functions for the new interface
  const getEstimatedCompletion = () => {
    if (analysisStatus.processedCases === 0 || duration === 0)
      return "Calculating...";

    const avgTimePerCase = duration / analysisStatus.processedCases;
    const remainingCases =
      analysisStatus.totalCases - analysisStatus.processedCases;
    const estimatedMs = remainingCases * avgTimePerCase;

    if (estimatedMs < 60000) return `${Math.round(estimatedMs / 1000)}s`;
    if (estimatedMs < 3600000) return `${Math.round(estimatedMs / 60000)}m`;
    return `${Math.round(estimatedMs / 3600000)}h`;
  };

  const getCodeTypeDistribution = () => {
    const codeTypes = {};
    let totalCodes = 0;

    analysisStatus.recentCompletions.forEach((completion) => {
      try {
        const codes = JSON.parse(completion.codesText.replace(/'/g, '"'));
        if (Array.isArray(codes)) {
          codes.forEach((code) => {
            const type = code.split("_")[0] || "other";
            codeTypes[type] = (codeTypes[type] || 0) + 1;
            totalCodes++;
          });
        }
      } catch (e) {
        // Handle parsing errors gracefully
      }
    });

    return Object.entries(codeTypes)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        count,
        percentage: totalCodes > 0 ? (count / totalCodes) * 100 : 0,
      }));
  };

  const getPhaseIcon = (phase) => {
    switch (phase) {
      case "Idle":
        return "⚪";
      case "Starting":
        return "🔄";
      case "Initializing":
        return "🚀";
      case "Processing Cases":
        return "⚙️";
      case "Complete":
        return "✅";
      case "Stopped":
        return "⏹️";
      default:
        return "❓";
    }
  };

  const getPhaseDescription = (phase) => {
    switch (phase) {
      case "Idle":
        return "Ready to start analysis";
      case "Starting":
        return "Initializing analysis environment";
      case "Initializing":
        return "Loading data and preparing prompts";
      case "Processing Cases":
        return "Generating initial codes for each case";
      case "Complete":
        return "Analysis completed successfully";
      case "Stopped":
        return "Analysis was stopped by user";
      default:
        return "Unknown phase";
    }
  };

  const handleCodeEdit = (caseId, newCodes) => {
    setEditingCodes((prev) => ({
      ...prev,
      [caseId]: newCodes,
    }));
  };

  const handleCodeSave = async (caseId, codes) => {
    try {
      // Set saving state
      setSavingCodes((prev) => ({ ...prev, [caseId]: true }));

      // Get the current data file being processed
      const currentFile = analysisStatus.currentDataFile || selectedDataFile;

      if (!currentFile) {
        console.error("No data file available for saving");
        addOutput(
          "❌ Error: No data file available for saving changes",
          "error"
        );
        return;
      }

      // Extract just the filename from the path if it's a full path
      const filename = currentFile.includes("/")
        ? currentFile.split("/").pop()
        : currentFile;

      // Send update to server
      const response = await fetch(`/api/data/${filename}/case/${caseId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ codes }),
      });

      const result = await response.json();

      if (response.ok) {
        // Update local state on successful save
        setAnalysisStatus((prev) => ({
          ...prev,
          recentCompletions: prev.recentCompletions.map((completion) =>
            completion.caseId === caseId
              ? { ...completion, codesText: JSON.stringify(codes) }
              : completion
          ),
        }));

        // Remove from editing state
        setEditingCodes((prev) => {
          const updated = { ...prev };
          delete updated[caseId];
          return updated;
        });

        addOutput(
          `✅ Saved codes for case ${caseId} to ${filename}`,
          "success"
        );
        console.log(`Successfully saved codes for case ${caseId}:`, codes);
      } else {
        throw new Error(result.error || "Failed to save codes");
      }
    } catch (error) {
      console.error(`Error saving codes for case ${caseId}:`, error);
      addOutput(
        `❌ Failed to save codes for case ${caseId}: ${error.message}`,
        "error"
      );

      // Keep the editing state since save failed
      // User can try again or cancel manually
    } finally {
      // Clear saving state
      setSavingCodes((prev) => {
        const updated = { ...prev };
        delete updated[caseId];
        return updated;
      });
    }
  };

  const downloadGeneratedCodes = () => {
    const codesData = {
      export_timestamp: new Date().toISOString(),
      total_cases_processed: analysisStatus.processedCases,
      generated_codes: analysisStatus.recentCompletions.map((completion) => ({
        case_id: completion.caseId,
        codes: completion.codesText,
        timestamp: completion.timestamp.toISOString(),
      })),
    };

    const blob = new Blob([JSON.stringify(codesData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `generated_codes_${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/:/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // CodeGenerationItem component
  const CodeGenerationItem = ({
    completion,
    onEdit,
    onSave,
    onRegenerate,
    isSaving,
    isRegenerating,
  }) => {
    const [editedCodes, setEditedCodes] = useState([]);
    const [editingIndex, setEditingIndex] = useState(-1);
    const [editValue, setEditValue] = useState("");
    const [caseTextExpanded, setCaseTextExpanded] = useState(false);

    const truncateLength = 200;
    const shouldTruncate =
      completion.caseText && completion.caseText.length > truncateLength;
    const displayText =
      shouldTruncate && !caseTextExpanded
        ? completion.caseText.substring(0, truncateLength) + "..."
        : completion.caseText;

    useEffect(() => {
      try {
        let codes;

        // Handle different types of codesText input
        if (Array.isArray(completion.codesText)) {
          // Already an array, use directly
          codes = completion.codesText;
        } else if (typeof completion.codesText === "string") {
          // Try to parse as JSON first
          try {
            codes = JSON.parse(completion.codesText.replace(/'/g, '"'));
          } catch (e) {
            // If JSON parsing fails, treat as a single string code
            codes = [completion.codesText];
          }
        } else {
          codes = [String(completion.codesText)];
        }

        // Ensure codes is always an array
        const codesArray = Array.isArray(codes) ? codes : [codes];

        // Filter out empty codes and convert to strings
        const cleanCodes = codesArray
          .map((code) => String(code).trim())
          .filter((code) => code.length > 0);

        setEditedCodes(
          cleanCodes.length > 0 ? cleanCodes : ["No codes generated"]
        );
      } catch (e) {
        console.error("Error parsing codes:", e, completion.codesText);
        setEditedCodes([completion.codesText || "Error parsing codes"]);
      }
    }, [completion.codesText]);

    const handleStartEdit = (index) => {
      setEditingIndex(index);
      setEditValue(editedCodes[index]);
    };

    const handleSaveEdit = () => {
      if (editValue.trim()) {
        const updatedCodes = [...editedCodes];
        updatedCodes[editingIndex] = editValue.trim();
        setEditedCodes(updatedCodes);
        onSave(completion.caseId, updatedCodes);
      }
      setEditingIndex(-1);
      setEditValue("");
    };

    const handleCancelEdit = () => {
      setEditingIndex(-1);
      setEditValue("");
    };

    const handleDeleteCode = (index) => {
      const updatedCodes = editedCodes.filter((_, i) => i !== index);
      // Ensure at least one code remains
      const finalCodes =
        updatedCodes.length > 0 ? updatedCodes : ["No codes generated"];
      setEditedCodes(finalCodes);
      onSave(completion.caseId, finalCodes);
    };

    const handleAddNewCode = () => {
      const updatedCodes = [
        ...editedCodes.filter((code) => code !== "No codes generated"),
        "",
      ];
      setEditedCodes(updatedCodes);
      setEditingIndex(updatedCodes.length - 1);
      setEditValue("");
    };

    const handleKeyPress = (e) => {
      if (e.key === "Enter") {
        handleSaveEdit();
      } else if (e.key === "Escape") {
        handleCancelEdit();
      }
    };

    const handleRegenerate = () => {
      onRegenerate(
        completion.caseId,
        completion.caseText,
        completion.codesText
      );
    };

    return (
      <div className="code-generation-item">
        <div className="item-header">
          <div className="case-info">
            <span className="case-id">Case {completion.caseId}</span>
            {completion.isExisting && (
              <span
                className="existing-indicator"
                title="Existing codes from file"
              >
                📁 Existing
              </span>
            )}
            {completion.isRegenerated && (
              <span
                className="regenerated-indicator"
                title="Codes regenerated with custom instructions"
              >
                🔄 Regenerated
              </span>
            )}
            <span className="generation-time">
              {completion.timestamp.toLocaleTimeString()}
            </span>
          </div>
          <div className="item-actions">
            <button
              className="regenerate-btn"
              onClick={handleRegenerate}
              type="button"
              title="Regenerate codes with custom instructions"
              disabled={isSaving || isRegenerating}
            >
              {isRegenerating ? "🔄 Regenerating..." : "🔄 Regenerate"}
            </button>
            <button
              className="add-code-btn"
              onClick={handleAddNewCode}
              type="button"
              title="Add new code"
              disabled={isSaving || isRegenerating}
            >
              {isSaving ? "💾 Saving..." : "➕ Add Code"}
            </button>
          </div>
        </div>

        {/* Case Text Display */}
        {completion.caseText && (
          <div className="case-text-section">
            <div className="case-text-header">
              <h6>📄 Case Description</h6>
              {shouldTruncate && (
                <button
                  className="expand-text-btn"
                  onClick={() => setCaseTextExpanded(!caseTextExpanded)}
                  type="button"
                >
                  {caseTextExpanded ? "Show Less" : "Show More"}
                </button>
              )}
            </div>
            <div className="case-text-content">
              <p className="case-text">{displayText}</p>
            </div>
          </div>
        )}

        <div className="codes-content">
          <div className="codes-display">
            <div className="codes-tags">
              {editedCodes.map((code, index) => (
                <div key={index} className="code-tag-container">
                  {editingIndex === index ? (
                    <div className="code-edit-inline">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyPress}
                        onBlur={handleSaveEdit}
                        className="code-edit-input"
                        placeholder="Enter code..."
                        autoFocus
                      />
                      <div className="edit-buttons">
                        <button
                          className="save-inline-btn"
                          onClick={handleSaveEdit}
                          type="button"
                          title="Save"
                        >
                          ✓
                        </button>
                        <button
                          className="cancel-inline-btn"
                          onClick={handleCancelEdit}
                          type="button"
                          title="Cancel"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="code-tag-wrapper">
                      <span className="code-tag">{code}</span>
                      {code !== "No codes generated" &&
                        code !== "Error parsing codes" && (
                          <div className="code-actions">
                            <button
                              className="edit-code-btn"
                              onClick={() => handleStartEdit(index)}
                              type="button"
                              title="Edit code"
                              disabled={isSaving}
                            >
                              ✏️
                            </button>
                            {editedCodes.length > 1 && (
                              <button
                                className="delete-code-btn"
                                onClick={() => handleDeleteCode(index)}
                                type="button"
                                title="Delete code"
                                disabled={isSaving}
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const loadExistingCodes = async (filename) => {
    try {
      const response = await fetch(`/api/data/${filename}/codes?limit=100`);
      const result = await response.json();

      if (response.ok) {
        // Convert the API format to our internal format
        const existingCompletions = result.cases.map((case_) => ({
          caseId: case_.caseId,
          codesText: Array.isArray(case_.codes)
            ? case_.codes // Keep arrays as arrays, don't stringify
            : typeof case_.codes === "string"
            ? case_.codes
            : [case_.codes], // Wrap non-array values in an array
          timestamp: new Date(case_.timestamp),
          caseText: case_.caseText || "",
          isExisting: true, // Mark as existing code
        }));

        // Update analysis status with existing data
        setAnalysisStatus((prev) => ({
          ...prev,
          totalCases: result.statistics.totalCases,
          processedCases: result.statistics.processedCases,
          uniqueCodesCount: result.statistics.uniqueCodesCount,
          recentCompletions: existingCompletions,
          currentDataFile: filename,
        }));

        addOutput(
          `📂 Loaded ${result.statistics.processedCases} existing codes from ${filename}`,
          "info"
        );
      } else {
        throw new Error(result.error || "Failed to load existing codes");
      }
    } catch (error) {
      console.error("Error loading existing codes:", error);
      addOutput(`❌ Failed to load existing codes: ${error.message}`, "error");
    }
  };

  const handleRegenerateRequest = (caseId, caseText, currentCodes) => {
    setRegenerateModalData({ caseId, caseText, currentCodes });
    setRegenerateInstructions("");
    setShowRegenerateModal(true);
  };

  const handleRegenerateSubmit = async () => {
    if (!regenerateModalData) {
      return;
    }

    const { caseId, caseText } = regenerateModalData;

    try {
      // Set regenerating state
      setRegeneratingCodes((prev) => ({ ...prev, [caseId]: true }));
      setShowRegenerateModal(false);

      // Get the current data file being processed
      const currentFile = analysisStatus.currentDataFile || selectedDataFile;

      if (!currentFile) {
        throw new Error("No data file available for regeneration");
      }

      // Extract just the filename from the path if it's a full path
      const filename = currentFile.includes("/")
        ? currentFile.split("/").pop()
        : currentFile;

      addOutput(`🔄 Regenerating codes for case ${caseId}...`, "info");
      try {
        console.log(
          `[AI] Regenerating single case ${caseId} with model: ${model}`
        );
      } catch {}

      // Send regeneration request to server
      const response = await fetch(
        `/api/data/${filename}/case/${caseId}/regenerate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            instructions: regenerateInstructions.trim(),
            model,
          }),
        }
      );

      const result = await response.json();

      if (response.ok) {
        // Update local state with regenerated codes
        setAnalysisStatus((prev) => ({
          ...prev,
          recentCompletions: prev.recentCompletions.map((completion) =>
            completion.caseId === caseId
              ? {
                  ...completion,
                  codesText: JSON.stringify(result.codes),
                  timestamp: new Date(), // Update timestamp to show it was regenerated
                  isRegenerated: true, // Mark as regenerated
                }
              : completion
          ),
        }));

        const methodUsed = regenerateInstructions.trim()
          ? `with custom instructions using model: ${model}`
          : `using best practices with model: ${model}`;
        addOutput(
          `✅ Successfully regenerated codes for case ${caseId} ${methodUsed}`,
          "success"
        );
        console.log(
          `Successfully regenerated codes for case ${caseId} (model: ${model}):`,
          result.codes
        );
      } else {
        throw new Error(result.error || "Failed to regenerate codes");
      }
    } catch (error) {
      console.error(`Error regenerating codes for case ${caseId}:`, error);
      addOutput(
        `❌ Failed to regenerate codes for case ${caseId}: ${error.message}`,
        "error"
      );
    } finally {
      // Clear regenerating state
      setRegeneratingCodes((prev) => {
        const updated = { ...prev };
        delete updated[caseId];
        return updated;
      });

      // Reset modal data
      setRegenerateModalData(null);
      setRegenerateInstructions("");
    }
  };

  const handleRegenerateCancel = () => {
    setShowRegenerateModal(false);
    setRegenerateModalData(null);
    setRegenerateInstructions("");
  };

  const handleExampleClick = (exampleText) => {
    const cleanExample = exampleText.replace(/"/g, "");
    if (globalInstructions.trim()) {
      setGlobalInstructions(
        (prev) =>
          prev +
          (prev.endsWith(".") || prev.endsWith(",") ? " " : ". ") +
          cleanExample
      );
    } else {
      setGlobalInstructions(cleanExample);
    }
  };

  const handleBulkRegenerate = async () => {
    if (!globalInstructions.trim()) {
      addOutput(
        "❌ Please enter instructions before bulk regenerating codes",
        "error"
      );
      return;
    }

    const currentFile = analysisStatus.currentDataFile || selectedDataFile;
    if (!currentFile) {
      addOutput("❌ No data file selected for bulk regeneration", "error");
      return;
    }

    // Extract just the filename from the path if it's a full path
    const filename = currentFile.includes("/")
      ? currentFile.split("/").pop()
      : currentFile;

    try {
      setBulkRegenerating(true);
      setBulkProgress({ current: 0, total: 0, status: "Starting..." });

      addOutput(
        `🔄 Starting bulk regeneration of existing codes with instructions: "${globalInstructions.trim()}"`,
        "info"
      );

      // Send bulk regeneration request to server
      const response = await fetch(`/api/data/${filename}/bulk-regenerate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ instructions: globalInstructions.trim() }),
      });

      const result = await response.json();

      if (response.ok) {
        addOutput(
          `✅ Bulk regeneration completed successfully. Updated ${result.updated_cases} cases.`,
          "success"
        );

        // Reload existing codes to show updated results
        if (selectedDataFile) {
          loadExistingCodes(selectedDataFile);
        }
      } else {
        throw new Error(result.error || "Failed to start bulk regeneration");
      }
    } catch (error) {
      console.error("Error in bulk regeneration:", error);
      addOutput(
        `❌ Failed to bulk regenerate codes: ${error.message}`,
        "error"
      );
    } finally {
      setBulkRegenerating(false);
      setBulkProgress(null);
    }
  };

  return (
    <div className="script-runner">
      {/* Controls */}
      <div className="toolbar">
        <button
          onClick={startScript}
          disabled={isRunning}
          className="btn primary"
        >
          {isRunning ? "Running..." : "Start analysis"}
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
          <label htmlFor="model-select" className="muted">
            Model
          </label>
          <select
            id="model-select"
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

      {/* Progress Bar */}
      {progress && (
        <div className="progress-section">
          <div className="progress-info">
            <span>
              Progress: {progress.current}/{progress.total} (
              {progress.percentage}%)
            </span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress.percentage}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && <div className="badge warning">{error}</div>}

      {/* File Selection Section */}
      <section className="card">
        <div className="card-header row">
          <h3>Select data file for analysis</h3>
        </div>
        <div className="card-body">
          {availableFiles.length === 0 ? (
            <div className="no-files-available">
              <p>No files available for analysis.</p>
              <p>
                <button
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent("switchToDataBrowser"))
                  }
                  className="btn subtle"
                >
                  Go to Data Browser to upload files
                </button>
              </p>
            </div>
          ) : (
            <div className="row" style={{ alignItems: "end", gap: 12 }}>
              <div className="selector-group" style={{ minWidth: 320 }}>
                <label htmlFor="file-select">Choose a file to analyze</label>
                <select
                  id="file-select"
                  value={selectedDataFile}
                  onChange={(e) => {
                    const filename = e.target.value;
                    setSelectedDataFile(filename);
                    if (filename) {
                      loadExistingCodes(filename);
                    } else {
                      setAnalysisStatus((prev) => ({
                        ...prev,
                        totalCases: 0,
                        processedCases: 0,
                        uniqueCodesCount: 0,
                        recentCompletions: [],
                        currentDataFile: null,
                      }));
                    }
                  }}
                  className="select"
                >
                  <option value="">-- Select a file --</option>
                  {availableFiles.map((file) => (
                    <option key={file.name} value={file.name}>
                      {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </option>
                  ))}
                </select>
              </div>
              {selectedDataFile && (
                <div className="row" style={{ gap: 8 }}>
                  <button
                    onClick={() => startScriptWithFile(selectedDataFile)}
                    disabled={isRunning}
                    className="btn primary"
                  >
                    {isRunning ? "Running..." : "Start with this file"}
                  </button>
                  <button
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent("switchToDataBrowser", {
                          detail: { filename: selectedDataFile },
                        })
                      )
                    }
                    className="btn subtle"
                  >
                    Browse this file
                  </button>
                  <button
                    onClick={handleDeleteSelectedFile}
                    disabled={isRunning}
                    className="btn danger"
                    title="Delete this uploaded file"
                  >
                    Delete file
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Global Instructions Section */}
      <section className="card">
        <div className="card-header row">
          <h3>Code generation instructions</h3>
        </div>
        <div className="card-body">
          <div className="instructions-container">
            <div className="instruction-examples-global">
              <p>
                <strong>Example instructions:</strong>
              </p>
              <div className="examples-grid">
                {[
                  "Focus on victim characteristics",
                  "Emphasize environmental factors",
                  "Use specific crime terminology",
                  "Highlight offender behavior patterns",
                  "Create detailed, specific codes",
                  "Focus on temporal aspects",
                ].map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    className="badge"
                    onClick={() => handleExampleClick(ex)}
                    title={ex}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={globalInstructions}
              onChange={(e) => setGlobalInstructions(e.target.value)}
              placeholder="Enter your instructions for code generation across all cases, or leave blank to use comprehensive best practices..."
              className="global-instructions-textarea"
              rows={3}
            />

            <div className="row" style={{ gap: 8 }}>
              {globalInstructions.trim() ? (
                <span className="badge success">Using custom instructions</span>
              ) : (
                <span className="badge info">
                  Using comprehensive best practices
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Analysis Progress */}
      <section className="card">
        <div className="card-header row">
          <h3>Progress</h3>
        </div>
        <div className="card-body">
          <div className="progress-overview">
            <div className="progress-ring-container">
              <div className="progress-ring">
                <svg width="120" height="120" viewBox="0 0 120 120">
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="transparent"
                    strokeWidth="8"
                    style={{ stroke: "var(--border)" }}
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="transparent"
                    strokeWidth="8"
                    style={{ stroke: "var(--accent-500)" }}
                    strokeDasharray={`${2 * Math.PI * 50}`}
                    strokeDashoffset={`${
                      2 *
                      Math.PI *
                      50 *
                      (1 -
                        analysisStatus.processedCases /
                          Math.max(analysisStatus.totalCases, 1))
                    }`}
                    strokeLinecap="round"
                    transform="rotate(-90 60 60)"
                    className="progress-circle"
                  />
                </svg>
                <div className="progress-text">
                  <div className="progress-percentage">
                    {analysisStatus.totalCases > 0
                      ? Math.round(
                          (analysisStatus.processedCases /
                            analysisStatus.totalCases) *
                            100
                        )
                      : 0}
                    %
                  </div>
                  <div className="progress-label">Complete</div>
                </div>
              </div>
            </div>

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
                  {analysisStatus.uniqueCodesCount}
                </div>
                <div className="stat-label">Unique Codes</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">{analysisStatus.apiCalls}</div>
                <div className="stat-label">API Calls</div>
              </div>
            </div>
          </div>

          {/* Current processing */}
          {analysisStatus.phase === "Processing Cases" &&
            analysisStatus.currentCase && (
              <div className="current-processing">
                <h4>Currently processing</h4>
                <div className="current-case">
                  <span className="case-label">Case ID:</span>
                  <span className="case-id">{analysisStatus.currentCase}</span>
                  <span className="case-progress">
                    ({analysisStatus.currentBatch} of{" "}
                    {analysisStatus.totalCases})
                  </span>
                </div>
                <div className="processing-indicator">
                  <div className="pulse-dot"></div>
                  <span>Generating initial codes…</span>
                </div>
              </div>
            )}

          {/* Live code generation */}
          {analysisStatus.recentCompletions.length > 0 && (
            <div className="live-codes-section">
              <div className="section-header">
                <h4>
                  Generated codes{" "}
                  {analysisStatus.recentCompletions.length > 0
                    ? `(${analysisStatus.recentCompletions.length})`
                    : ""}
                </h4>
                <div className="codes-actions">
                  <button
                    className="btn subtle"
                    onClick={downloadGeneratedCodes}
                  >
                    Export codes
                  </button>
                  <button
                    className="btn danger"
                    onClick={handleDeleteAllCodes}
                    disabled={
                      isRunning ||
                      (!selectedDataFile && !analysisStatus.currentDataFile)
                    }
                    title="Delete all initial codes in this file"
                  >
                    Delete all codes
                  </button>
                </div>
              </div>

              <div className="codes-list">
                {analysisStatus.recentCompletions
                  .slice(0, 10)
                  .map((completion, index) => (
                    <CodeGenerationItem
                      key={completion.caseId}
                      completion={completion}
                      onEdit={handleCodeEdit}
                      onSave={handleCodeSave}
                      onRegenerate={handleRegenerateRequest}
                      isSaving={savingCodes[completion.caseId] || false}
                      isRegenerating={
                        regeneratingCodes[completion.caseId] || false
                      }
                    />
                  ))}
              </div>

              {analysisStatus.recentCompletions.length > 10 && (
                <div className="more-codes-indicator">
                  <span>
                    + {analysisStatus.recentCompletions.length - 10} more
                    completed cases
                  </span>
                  <button
                    className="view-all-btn"
                    onClick={() => setShowAllCodes(true)}
                  >
                    View All Generated Codes
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Regeneration Modal */}
          {showRegenerateModal && regenerateModalData && (
            <div className="modal-overlay">
              <div className="modal-content regenerate-modal">
                <div className="modal-header">
                  <h3>
                    🔄 Regenerate Codes for Case {regenerateModalData.caseId}
                  </h3>
                </div>
                <div className="modal-body">
                  <div className="case-preview">
                    <h4>📄 Case Text:</h4>
                    <p className="case-text-preview">
                      {regenerateModalData.caseText?.substring(0, 300)}
                      {regenerateModalData.caseText?.length > 300 ? "..." : ""}
                    </p>
                  </div>

                  <div className="current-codes">
                    <h4>🏷️ Current Codes:</h4>
                    <div className="current-codes-display">
                      {(() => {
                        try {
                          const codes = JSON.parse(
                            regenerateModalData.currentCodes
                          );
                          return Array.isArray(codes)
                            ? codes.join(", ")
                            : codes;
                        } catch (e) {
                          return regenerateModalData.currentCodes;
                        }
                      })()}
                    </div>
                  </div>

                  <div className="instructions-input">
                    <h4>📝 Regeneration Instructions:</h4>
                    <p className="instructions-help">
                      Provide specific instructions for how you want the codes
                      to be generated. The AI will prioritize your guidance
                      while ensuring accuracy. Leave blank for comprehensive
                      automatic coding.
                    </p>

                    <div className="instruction-examples">
                      <p>
                        <strong>Examples of useful instructions:</strong>
                      </p>
                      <ul className="example-list">
                        <li>
                          "Focus more on victim characteristics and
                          vulnerability factors"
                        </li>
                        <li>
                          "Use more specific terminology for the type of
                          theft/crime"
                        </li>
                        <li>
                          "Emphasize environmental and contextual factors"
                        </li>
                        <li>
                          "Create codes that highlight offender behavior
                          patterns"
                        </li>
                        <li>
                          "Generate fewer, more general codes" or "Create more
                          detailed, specific codes"
                        </li>
                        <li>
                          "Focus on temporal aspects and timing of the crime"
                        </li>
                      </ul>
                    </div>

                    <textarea
                      value={regenerateInstructions}
                      onChange={(e) =>
                        setRegenerateInstructions(e.target.value)
                      }
                      placeholder="Enter your specific instructions here, or leave blank for comprehensive automatic coding based on best practices..."
                      className="instructions-textarea"
                      rows={4}
                      autoFocus
                    />

                    <div className="instruction-tip">
                      💡 <strong>Tip:</strong> The more specific your
                      instructions, the better the AI can tailor the codes to
                      your research needs.
                    </div>
                  </div>
                </div>
                <div className="modal-actions">
                  <button
                    onClick={handleRegenerateCancel}
                    className="cancel-btn"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRegenerateSubmit}
                    className="regenerate-confirm-btn"
                    disabled={false}
                  >
                    🔄{" "}
                    {regenerateInstructions.trim()
                      ? "Regenerate with Instructions"
                      : "Regenerate with Best Practices"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Results Section */}
      {results && (
        <div className="results-section">
          <h3>📊 Analysis Results</h3>

          {results.progress && (
            <div className="results-progress">
              <h4>Overall Progress</h4>
              <div className="progress-stats">
                <div className="stat">
                  <span className="stat-label">Total Cases:</span>
                  <span className="stat-value">{results.progress.total}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Processed:</span>
                  <span className="stat-value">
                    {results.progress.processed}
                  </span>
                </div>
                <div className="stat">
                  <span className="stat-label">Completion:</span>
                  <span className="stat-value">
                    {results.progress.percentage}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {results.recentResults && results.recentResults.length > 0 && (
            <div className="recent-results">
              <h4>Recent Results (Last 10)</h4>
              <div className="results-list">
                {results.recentResults.map((result, index) => (
                  <div key={index} className="result-item">
                    <div className="result-id">{result.id}</div>
                    <div className="result-code">"{result.code}"</div>
                    <div className="result-text">{result.text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ScriptRunner;
