import React, { useEffect, useRef, useState } from "react";

const P4AssignThemes = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState([]);
  const [error, setError] = useState(null);
  const [duration, setDuration] = useState(0);
  const startRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    connectWebSocket();
    checkStatus();
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
            addOutput(`❌ Phase 4 failed with code ${msg.code}` , "error");
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
    setOutput((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), text, type, timestamp: new Date().toLocaleTimeString() },
    ].slice(-500));
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

  const startP4 = async () => {
    try {
      setError(null);
      const res = await fetch("/api/p4/execute", { method: "POST" });
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

  return (
    <div className="p3-analysis">
      <div className="runner-header">
        <h2>🏁 Phase 4 Assign Final Themes</h2>
        <p>Assign finalized themes to all cases using Phase 3b output</p>
      </div>

      <div className="runner-controls">
        <div className="control-buttons">
          <button
            onClick={startP4}
            disabled={isRunning}
            className={`control-button start-button ${isRunning ? "disabled" : ""}`}
          >
            {isRunning ? "🔄 Running..." : "▶️ Start Phase 4"}
          </button>
          <button
            onClick={stopP4}
            disabled={!isRunning}
            className={`control-button stop-button ${!isRunning ? "disabled" : ""}`}
          >
            ⏹️ Stop
          </button>
        </div>
        <div className="status-display">
          <div className={`status-indicator ${isRunning ? "running" : "stopped"}`}>
            {isRunning ? "🟢 Running" : "⚪ Stopped"}
          </div>
          {duration > 0 && <div className="duration">⏱️ {formatDuration(duration)}</div>}
        </div>
      </div>

      {error && <div className="error-display">❌ {error}</div>}

      <div className="logs-section">
        <div className="logs-header">
          <h4>Phase 4 Output</h4>
        </div>
        <div className="output-terminal">
          {output.length === 0 ? (
            <div className="no-output">No output yet</div>
          ) : (
            output.map((line) => (
              <div key={line.id} className={`output-line ${line.type}`}>
                <span className="timestamp">[{line.timestamp}]</span>
                <span className="content">{line.text}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default P4AssignThemes;


