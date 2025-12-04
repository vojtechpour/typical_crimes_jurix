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
    } else {
      setInitialCodesStats(null);
      setCandidateThemesCount(0);
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
            error: message.error || "P3b analysis failed",
          }));
          addOutput(
            `❌ P3b failed: ${message.error || "Unknown error"}`,
            "error"
          );
          break;
        }
        case "p3b_script_error": {
          setP3bStatus((prev) => ({
            ...prev,
            error: message.data,
          }));
          addOutput(`❌ P3b error: ${message.data}`, "error");
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
      const res = await fetch(`/api/data/${filename}/themes?limit=1`);
      const data = await res.json();
      if (res.ok && data.cases) {
        const count = data.cases.filter(
          (c: any) => c.candidate_theme && c.candidate_theme.trim()
        ).length;
        setCandidateThemesCount(count);
      }
    } catch {}
  };

  const startP3b = async () => {
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
          `🎯 Starting Phase 3b theme finalization (model: ${model})...`,
          "info"
        );
      } else {
        setError(data.error || "Failed to start P3b script");
        addOutput(`❌ Error: ${data.error}`, "error");
      }
    } catch (e: any) {
      setError("Failed to start P3b script: " + e.message);
      addOutput(`❌ Error: ${e.message}`, "error");
    }
  };

  const stopP3b = async () => {
    try {
      const response = await fetch("/api/p3/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (response.ok) {
        setP3bStatus((prev) => ({ ...prev, isRunning: false }));
        addOutput("⏹️ P3b stop request sent...", "warning");
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
        <span className="spacer" />
        <span className="badge">
          {p3bStatus.isRunning ? "Running" : "Stopped"}
        </span>
      </div>

      {error && <div className="badge warning">{error}</div>}

      <P3FileSelector
        availableFiles={availableFiles}
        selectedDataFile={selectedDataFile}
        setSelectedDataFile={setSelectedDataFile}
        isLoadingFiles={availableFiles.length === 0 && !selectedDataFile}
        initialCodesStats={initialCodesStats || undefined}
      />

      {/* Status Card */}
      {selectedDataFile && (
        <section className="card soft" style={{ marginTop: 16 }}>
          <div className="card-header row">
            <h3>📊 Phase 3b Status</h3>
          </div>
          <div className="card-body">
            <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
              <div className="stat-card">
                <div className="stat-label">Candidate Themes</div>
                <div className="stat-value">{candidateThemesCount}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Status</div>
                <div className="stat-value">
                  {p3bStatus.phase === "P3b Complete"
                    ? "✅ Complete"
                    : p3bStatus.phase === "P3b Failed"
                    ? "❌ Failed"
                    : p3bStatus.isRunning
                    ? "🔄 " + p3bStatus.phase
                    : p3bStatus.phase}
                </div>
              </div>
            </div>
            {candidateThemesCount === 0 && (
              <div
                className="info-box"
                style={{
                  marginTop: 16,
                  padding: 12,
                  backgroundColor: "rgba(255, 193, 7, 0.1)",
                  borderRadius: 8,
                  color: "rgba(255, 193, 7, 0.9)",
                }}
              >
                <strong>⚠️ No candidate themes found.</strong>
                <p style={{ marginTop: 8, fontSize: 14 }}>
                  Please run Phase 3 analysis first to generate candidate themes
                  before starting Phase 3b.
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Output Log */}
      {output.length > 0 && (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <h3>Output Log</h3>
          </div>
          <div className="card-body">
            <div
              className="output-log"
              style={{
                maxHeight: 400,
                overflowY: "auto",
                fontFamily: "monospace",
                fontSize: 13,
                backgroundColor: "rgba(0, 0, 0, 0.2)",
                padding: 12,
                borderRadius: 6,
              }}
            >
              {output.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    padding: "4px 0",
                    color:
                      entry.type === "error"
                        ? "#ff6b6b"
                        : entry.type === "success"
                        ? "#51cf66"
                        : entry.type === "warning"
                        ? "#ffd43b"
                        : "rgba(255, 255, 255, 0.8)",
                  }}
                >
                  <span style={{ opacity: 0.5 }}>[{entry.timestamp}]</span>{" "}
                  {entry.text}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* P3b Results */}
      <P3bResults p3bStatus={p3bStatus} />
    </div>
  );
};

export default P3bAnalysis;







