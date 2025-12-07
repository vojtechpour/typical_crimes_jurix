import React, { useEffect, useRef, useState } from "react";
import P3bResults from "./P3bResults";
import P3FileSelector from "./P3FileSelector";

type OutputEntry = {
  id: number;
  text: string;
  type: string;
  timestamp: string;
};

type P3bStatus = {
  isRunning: boolean;
  phase: string;
  output: OutputEntry[];
  finalThemes: string | null;
  error: string | null;
};

const P3bAnalysis: React.FC = () => {
  const [selectedDataFile, setSelectedDataFile] = useState<string>("");
  const [availableFiles, setAvailableFiles] = useState<any[]>([]);
  const [model, setModel] = useState<string>("gemini-2.0-flash");
  const [customInstructions, setCustomInstructions] = useState<string>("");
  const [showInstructions, setShowInstructions] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<OutputEntry[]>([]);
  const [initialCodesStats, setInitialCodesStats] = useState<{
    processedCases: number;
    totalCases: number;
    uniqueCodesCount: number;
  } | null>(null);

  const [p3bStatus, setP3bStatus] = useState<P3bStatus>({
    isRunning: false,
    phase: "Idle",
    output: [],
    finalThemes: null,
    error: null,
  });

  const [candidateThemesCount, setCandidateThemesCount] = useState<number>(0);
  const [candidateThemesList, setCandidateThemesList] = useState<string[]>([]);
  const [existingFinalThemesCount, setExistingFinalThemesCount] =
    useState<number>(0);

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    connectWebSocket();
    loadAvailableFiles();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (selectedDataFile) {
      loadInitialCodesStats(selectedDataFile);
      loadCandidateThemesCount(selectedDataFile);
      loadExistingFinalThemes(selectedDataFile);
    } else {
      setInitialCodesStats(null);
      setCandidateThemesCount(0);
      setExistingFinalThemesCount(0);
      // Reset P3b status when no file is selected
      setP3bStatus({
        isRunning: false,
        phase: "Idle",
        output: [],
        finalThemes: null,
        error: null,
      });
    }
  }, [selectedDataFile]);

  const connectWebSocket = () => {
    const ws = new WebSocket("ws://localhost:9000");
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[P3b WS] Connected to WebSocket");
    };
    ws.onmessage = (event: MessageEvent<string>) => {
      console.log("[P3b WS] Received message:", event.data.substring(0, 100));
      handleMessage(event);
    };
    ws.onclose = () => {
      console.log("[P3b WS] WebSocket closed, reconnecting in 3s...");
      setTimeout(connectWebSocket, 3000);
    };
    ws.onerror = (error) => {
      console.error("[P3b WS] WebSocket error:", error);
    };
  };

  const handleMessage = (event: MessageEvent<string>) => {
    try {
      const message = JSON.parse(event.data);
      switch (message.type) {
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
          addOutput(
            "P3b theme finalization completed successfully!",
            "success"
          );
          // Reload the themes data to update the counts
          if (selectedDataFile) {
            loadCandidateThemesCount(selectedDataFile);
            loadExistingFinalThemes(selectedDataFile);
          }
          break;
        }
        case "p3b_script_failed": {
          setP3bStatus((prev) => ({
            ...prev,
            isRunning: false,
            phase: "P3b Failed",
            error: message.error || "P3b analysis failed",
          }));
          addOutput(`P3b failed: ${message.error || "Unknown error"}`, "error");
          break;
        }
        case "p3b_script_error": {
          setP3bStatus((prev) => ({
            ...prev,
            error: message.data,
          }));
          addOutput(`P3b error: ${message.data}`, "error");
          break;
        }
        case "p3b_script_stopped": {
          setP3bStatus((prev) => ({
            ...prev,
            isRunning: false,
            phase: "Stopped",
          }));
          addOutput("P3b analysis stopped", "warning");
          break;
        }
        case "output": {
          addOutput(message.text || message.data, message.level || "info");
          break;
        }
        default:
          break;
      }
    } catch (error) {
      console.error("Error parsing WebSocket message:", error);
    }
  };

  const addOutput = (text: string, type: string = "output") => {
    const timestamp = new Date().toLocaleTimeString();
    setOutput((prev) => [
      ...prev,
      { text, type, timestamp, id: Date.now() + Math.random() },
    ]);
  };

  const loadAvailableFiles = async () => {
    try {
      const response = await fetch("/api/data-files");
      const files = await response.json();
      const filesWithCodes = files.filter(
        (file: any) =>
          file.name.includes("codes") ||
          file.name.includes("initial") ||
          file.name.includes("p2") ||
          file.name.includes("p3")
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
          processedCases: data.statistics.processedCases,
          totalCases: data.statistics.totalCases,
          uniqueCodesCount: data.statistics.uniqueCodesCount,
        });
      }
    } catch {}
  };

  const loadCandidateThemesCount = async (filename: string) => {
    try {
      const res = await fetch(`/api/data/${filename}/themes?limit=10000`);
      const data = await res.json();
      if (res.ok && data.cases) {
        const casesWithCandidates = data.cases.filter(
          (c: any) => c.candidate_theme && c.candidate_theme.trim()
        );
        setCandidateThemesCount(casesWithCandidates.length);

        // Extract unique candidate themes
        const uniqueThemes = [
          ...new Set(
            casesWithCandidates.map((c: any) => c.candidate_theme.trim())
          ),
        ] as string[];
        setCandidateThemesList(uniqueThemes);
      } else if (res.ok && data.statistics) {
        setCandidateThemesCount(data.statistics.casesWithCandidateThemes || 0);
      }
    } catch {}
  };

  const loadExistingFinalThemes = async (filename: string) => {
    try {
      const res = await fetch(`/api/data/${filename}/themes?limit=10000`);
      const data = await res.json();
      if (res.ok) {
        // Get cases with final themes for count
        const casesWithFinalThemes = (data.cases || []).filter(
          (c: any) => c.theme && c.theme.trim()
        );

        setExistingFinalThemesCount(casesWithFinalThemes.length);

        // Check if we have stored P3b output metadata (preferred source)
        if (data.p3bOutput && data.p3bOutput.finalThemes) {
          const p3bData = {
            finalThemes: data.p3bOutput.finalThemes,
            mappings: data.p3bOutput.mappings || {},
          };
          setP3bStatus((prev) => ({
            ...prev,
            phase: casesWithFinalThemes.length > 0 ? "P3b Complete" : "Cleared",
            finalThemes: JSON.stringify(p3bData, null, 2),
          }));
          return;
        }

        // Fallback: reconstruct from case assignments (legacy behavior)
        if (casesWithFinalThemes.length > 0) {
          const finalThemesMap = new Map<
            string,
            {
              name: string;
              description: string;
              mergedFrom: string[];
              count: number;
            }
          >();
          const mappings: Record<string, string> = {};

          for (const caseItem of casesWithFinalThemes) {
            const finalTheme = caseItem.theme;
            const candidateTheme = caseItem.candidate_theme;

            // Track final themes
            if (!finalThemesMap.has(finalTheme)) {
              finalThemesMap.set(finalTheme, {
                name: finalTheme,
                description: `Theme covering ${finalTheme.toLowerCase()} patterns`,
                mergedFrom: [],
                count: 0,
              });
            }
            const themeData = finalThemesMap.get(finalTheme)!;
            themeData.count++;

            // Track mappings from candidate to final
            if (candidateTheme && candidateTheme !== finalTheme) {
              if (!themeData.mergedFrom.includes(candidateTheme)) {
                themeData.mergedFrom.push(candidateTheme);
              }
              mappings[candidateTheme] = finalTheme;
            }
          }

          // Convert to the expected format
          const finalThemes = Array.from(finalThemesMap.values())
            .sort((a, b) => b.count - a.count)
            .map(({ name, description, mergedFrom }) => ({
              name,
              description,
              mergedFrom,
            }));

          const reconstructedData = {
            finalThemes,
            mappings,
          };

          // Update P3b status with existing data
          setP3bStatus((prev) => ({
            ...prev,
            phase: "P3b Complete",
            finalThemes: JSON.stringify(reconstructedData, null, 2),
            error: null,
          }));
        } else {
          // No final themes exist yet
          setP3bStatus((prev) => ({
            ...prev,
            phase: "Idle",
            finalThemes: null,
          }));
        }
      }
    } catch (err) {
      console.error("[P3b] Error loading existing final themes:", err);
    }
  };

  const startP3b = async () => {
    try {
      setError(null);
      const response = await fetch("/api/p3b/execute", {
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
        setP3bStatus((prev) => ({
          ...prev,
          isRunning: true,
          phase: "Starting P3b",
          error: null,
        }));
        addOutput(
          `Starting Phase 3b theme finalization (model: ${model})...`,
          "info"
        );
        if (customInstructions.trim()) {
          addOutput(
            `Custom instructions: "${customInstructions.trim()}"`,
            "info"
          );
        }
      } else {
        setError(data.error || "Failed to start P3b script");
        addOutput(`Error: ${data.error}`, "error");
      }
    } catch (e: any) {
      setError("Failed to start P3b script: " + e.message);
      addOutput(`Error: ${e.message}`, "error");
    }
  };

  const stopP3b = async () => {
    try {
      const response = await fetch("/api/p3b/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (response.ok) {
        setP3bStatus((prev) => ({
          ...prev,
          isRunning: false,
          phase: "Stopped",
        }));
        addOutput("P3b stop request sent...", "warning");
      } else {
        setError(data.error || "Failed to stop P3b script");
      }
    } catch (e: any) {
      setError("Failed to stop P3b script: " + e.message);
    }
  };

  const clearOutput = () => {
    setOutput([]);
    setError(null);
  };

  return (
    <div className="p3b-analysis">
      <div className="runner-header">
        <h2>Phase 3b: Theme Finalization</h2>
        <p>
          Refine and finalize candidate themes from Phase 3, creating a
          comprehensive set of final themes that cover the entire spectrum of
          patterns in your dataset.
        </p>
      </div>

      <div className="toolbar">
        <button
          onClick={startP3b}
          disabled={
            p3bStatus.isRunning ||
            !selectedDataFile ||
            candidateThemesCount === 0
          }
          className="btn primary"
          title={
            candidateThemesCount === 0
              ? "No candidate themes available. Run P3 analysis first."
              : "Start Phase 3b theme finalization"
          }
        >
          {p3bStatus.isRunning ? "Running P3b..." : "Start P3b Finalization"}
        </button>
        <button
          onClick={stopP3b}
          disabled={!p3bStatus.isRunning}
          className="btn danger"
        >
          Stop
        </button>
        <button onClick={clearOutput} className="btn subtle">
          Clear output
        </button>
        <button
          onClick={() => {
            if (selectedDataFile) {
              loadCandidateThemesCount(selectedDataFile);
              loadExistingFinalThemes(selectedDataFile);
              addOutput("Refreshed themes data from file", "info");
            }
          }}
          disabled={!selectedDataFile}
          className="btn subtle"
        >
          Refresh
        </button>
        <div className="row" style={{ alignItems: "center" }}>
          <label htmlFor="p3b-model-select" className="muted">
            Model
          </label>
          <select
            id="p3b-model-select"
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
        <span className="badge">
          {p3bStatus.isRunning ? "Running" : "Stopped"}
        </span>
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
              htmlFor="p3b-custom-instructions"
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
            id="p3b-custom-instructions"
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            placeholder="Add specific instructions for theme finalization...&#10;&#10;Examples:&#10;• Merge themes that are conceptually similar&#10;• Create broader category themes&#10;• Use formal academic terminology&#10;• Focus on behavioral patterns"
            disabled={p3bStatus.isRunning}
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
            These instructions will guide how the AI merges and finalizes
            candidate themes. Leave empty to use default behavior.
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
                <div className="stat-number">{candidateThemesCount}</div>
                <div className="stat-label">Candidate Themes</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">{existingFinalThemesCount}</div>
                <div className="stat-label">Final Themes Applied</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Status</div>
                <div
                  className={`stat-status ${
                    p3bStatus.phase === "P3b Complete"
                      ? "success"
                      : p3bStatus.phase === "P3b Failed"
                      ? "error"
                      : p3bStatus.isRunning
                      ? "running"
                      : "idle"
                  }`}
                >
                  {p3bStatus.phase === "P3b Complete"
                    ? "Done"
                    : p3bStatus.phase === "P3b Failed"
                    ? "Failed"
                    : p3bStatus.isRunning
                    ? "Running"
                    : existingFinalThemesCount > 0
                    ? "Previously Completed"
                    : "Idle"}
                </div>
              </div>
              <div className="stat-item">
                <div className="stat-number">{p3bStatus.output.length}</div>
                <div className="stat-label">Updates</div>
              </div>
            </div>
          </div>

          {/* Current processing status - show whenever running */}
          {p3bStatus.isRunning && (
            <div className="progress-card">
              <div className="progress-header">
                <div className="pulse-dot" />
                <h4 className="progress-title">{p3bStatus.phase}</h4>
              </div>
              <div className="progress-text">
                Phase 3b analyzes all candidate themes to create a refined set
                of final themes. This may take a few minutes depending on the
                number of themes.
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: "100%",
                    animation: "pulse 2s infinite",
                  }}
                />
              </div>
            </div>
          )}

          {/* Warning when no candidate themes */}
          {candidateThemesCount === 0 && selectedDataFile && (
            <div
              className="badge warning"
              style={{ display: "block", padding: 12, marginTop: 16 }}
            >
              <strong>No candidate themes found.</strong>
              <p style={{ marginTop: 8, fontSize: 14, marginBottom: 0 }}>
                Please run Phase 3 analysis first to generate candidate themes
                before starting Phase 3b.
              </p>
            </div>
          )}

          {/* Live activity log */}
          {output.length > 0 && (
            <div className="activity-log" style={{ marginTop: 16 }}>
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

      {/* P3b Results */}
      <P3bResults
        p3bStatus={p3bStatus}
        candidateThemes={candidateThemesList}
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
              setExistingFinalThemesCount(0);
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
    </div>
  );
};

export default P3bAnalysis;
