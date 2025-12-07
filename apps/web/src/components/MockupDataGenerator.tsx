import React, { useState, useCallback } from "react";
import { FiDatabase, FiLoader, FiCheck, FiAlertCircle } from "react-icons/fi";
import type { IconBaseProps } from "react-icons";

// Typed wrappers for icons
const IconDatabase: React.FC<IconBaseProps> =
  FiDatabase as unknown as React.FC<IconBaseProps>;
const IconLoader: React.FC<IconBaseProps> =
  FiLoader as unknown as React.FC<IconBaseProps>;
const IconCheck: React.FC<IconBaseProps> =
  FiCheck as unknown as React.FC<IconBaseProps>;
const IconAlert: React.FC<IconBaseProps> =
  FiAlertCircle as unknown as React.FC<IconBaseProps>;

type GeneratedCase = {
  id: string;
  plny_skutek_short: string;
};

type GenerationStatus = "idle" | "generating" | "success" | "error";

const MockupDataGenerator: React.FC = () => {
  const [model, setModel] = useState<string>("gemini-2.0-flash");
  const [caseCount, setCaseCount] = useState<number>(10);
  const [prompt, setPrompt] = useState<string>("");
  const [filename, setFilename] = useState<string>("");
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [progress, setProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });
  const [generatedData, setGeneratedData] = useState<GeneratedCase[] | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [savedFilename, setSavedFilename] = useState<string | null>(null);

  const generateFilename = useCallback(() => {
    const timestamp = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:.]/g, "-");
    return `mockup_${timestamp}`;
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Please provide a prompt describing the data to generate.");
      return;
    }

    const finalFilename = filename.trim() || generateFilename();

    setStatus("generating");
    setError(null);
    setGeneratedData(null);
    setSavedFilename(null);
    setProgress({ current: 0, total: caseCount });

    try {
      const response = await fetch("/api/generate-mockup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          model,
          count: caseCount,
          filename: finalFilename,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to generate mockup data");
      }

      setGeneratedData(result.cases);
      setSavedFilename(result.filename);
      setProgress({ current: caseCount, total: caseCount });
      setStatus("success");
    } catch (err: unknown) {
      setStatus("error");
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
    }
  };

  const handleReset = () => {
    setStatus("idle");
    setProgress({ current: 0, total: 0 });
    setGeneratedData(null);
    setError(null);
    setSavedFilename(null);
  };

  const promptExamples = [
    "Generate theft cases involving retail stores and shoplifting",
    "Create burglary cases targeting residential properties",
    "Generate vehicle theft incidents in urban areas",
    "Create fraud cases involving online transactions",
    "Generate assault cases in public places",
    "Create drug-related crime reports",
  ];

  return (
    <div className="mockup-generator">
      {/* Configuration Section */}
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-header row">
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconDatabase size={18} /> Generate Mockup Data
          </h3>
        </div>
        <div className="card-body">
          <p className="muted" style={{ marginBottom: 16 }}>
            Use AI to generate sample case data for testing and demonstration.
            The generated cases can be used in all analysis phases.
          </p>

          <div className="form-group" style={{ gap: 20 }}>
            {/* Model Selector */}
            <div className="form-row">
              <label htmlFor="mockup-model-select">AI Model</label>
              <select
                id="mockup-model-select"
                className="select"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={status === "generating"}
                style={{ flex: 1, maxWidth: 300 }}
              >
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                <option value="gemini-3-pro-preview">
                  Gemini 3 Pro Preview
                </option>
                <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                <option value="claude-sonnet-4-5-20250929">
                  Claude Sonnet 4.5
                </option>
                <option value="claude-3-5-sonnet-20241022">
                  Claude 3.5 Sonnet
                </option>
                <option value="claude-3-5-haiku-20241022">
                  Claude 3.5 Haiku
                </option>
                <option value="gpt-5-2025-08-07">gpt-5-2025-08-07</option>
                <option value="gpt-5-mini-2025-08-07">
                  gpt-5-mini-2025-08-07
                </option>
                <option value="gpt-5-nano-2025-08-07">
                  gpt-5-nano-2025-08-07
                </option>
              </select>
            </div>

            {/* Number of Cases */}
            <div className="form-row">
              <label htmlFor="mockup-count">Number of Cases</label>
              <div className="row" style={{ gap: 12, flex: 1 }}>
                <input
                  id="mockup-count"
                  type="range"
                  min={5}
                  max={100}
                  step={5}
                  value={caseCount}
                  onChange={(e) => setCaseCount(Number(e.target.value))}
                  disabled={status === "generating"}
                  style={{ flex: 1, maxWidth: 200 }}
                />
                <input
                  type="number"
                  className="form-input number"
                  min={5}
                  max={100}
                  value={caseCount}
                  onChange={(e) => {
                    const val = Math.min(
                      100,
                      Math.max(5, Number(e.target.value) || 5)
                    );
                    setCaseCount(val);
                  }}
                  disabled={status === "generating"}
                />
                <span className="muted">cases</span>
              </div>
            </div>

            {/* Filename */}
            <div className="form-row">
              <label htmlFor="mockup-filename">Filename</label>
              <input
                id="mockup-filename"
                type="text"
                className="form-input"
                placeholder="Auto-generated if empty"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                disabled={status === "generating"}
                style={{ flex: 1, maxWidth: 300 }}
              />
              <span className="muted">.json</span>
            </div>

            {/* Prompt */}
            <div className="form-group">
              <label htmlFor="mockup-prompt">
                Describe the data to generate
              </label>
              <div className="instruction-examples-global">
                <p className="muted" style={{ marginBottom: 8, fontSize: 13 }}>
                  <strong>Example prompts:</strong> Click to use
                </p>
                <div className="examples-grid">
                  {promptExamples.map((example) => (
                    <button
                      key={example}
                      type="button"
                      className="instruction-pill"
                      onClick={() => setPrompt(example)}
                      disabled={status === "generating"}
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                id="mockup-prompt"
                className="textarea"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe what kind of case data you want to generate. Be specific about the domain, types of incidents, locations, and any other relevant details..."
                disabled={status === "generating"}
                rows={4}
              />
            </div>

            {/* Actions */}
            <div className="row" style={{ gap: 12, marginTop: 8 }}>
              <button
                className="btn primary"
                onClick={handleGenerate}
                disabled={status === "generating" || !prompt.trim()}
              >
                {status === "generating" ? (
                  <>
                    <IconLoader size={14} className="spin" />
                    <span style={{ marginLeft: 6 }}>Generating...</span>
                  </>
                ) : (
                  <>
                    <IconDatabase size={14} />
                    <span style={{ marginLeft: 6 }}>
                      Generate {caseCount} Cases
                    </span>
                  </>
                )}
              </button>
              {(status === "success" || status === "error") && (
                <button className="btn subtle" onClick={handleReset}>
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Progress Section */}
      {status === "generating" && (
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="card-header row">
            <h3>Generation Progress</h3>
          </div>
          <div className="card-body">
            <div className="progress-card">
              <div className="progress-header">
                <div className="pulse-dot" />
                <span className="progress-title">
                  Generating case data with AI...
                </span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width:
                      progress.total > 0
                        ? `${(progress.current / progress.total) * 100}%`
                        : "0%",
                  }}
                />
              </div>
              <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
                This may take a moment depending on the number of cases and AI
                model selected.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Error Section */}
      {status === "error" && error && (
        <section
          className="card"
          style={{ marginBottom: 16, borderColor: "rgba(239, 68, 68, 0.3)" }}
        >
          <div
            className="card-body"
            style={{ display: "flex", alignItems: "flex-start", gap: 12 }}
          >
            <IconAlert
              size={20}
              style={{ color: "#ef4444", flexShrink: 0, marginTop: 2 }}
            />
            <div>
              <p style={{ color: "#ef4444", fontWeight: 500, marginBottom: 4 }}>
                Generation Failed
              </p>
              <p className="muted">{error}</p>
            </div>
          </div>
        </section>
      )}

      {/* Success / Preview Section */}
      {status === "success" && generatedData && (
        <section className="card">
          <div className="card-header row">
            <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <IconCheck size={18} style={{ color: "#22c55e" }} />
              Generated Successfully
            </h3>
            <span className="badge success">{generatedData.length} cases</span>
          </div>
          <div className="card-body">
            <div style={{ marginBottom: 16 }}>
              <p style={{ marginBottom: 8 }}>
                <strong>Saved as:</strong>{" "}
                <code
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                    padding: "2px 6px",
                    borderRadius: 4,
                  }}
                >
                  {savedFilename}
                </code>
              </p>
              <p className="muted" style={{ fontSize: 13 }}>
                This file is now available in the Data Browser and can be used
                in all analysis phases.
              </p>
            </div>

            <div style={{ marginTop: 16 }}>
              <h4 style={{ marginBottom: 12, fontSize: 14 }}>
                Preview (first 5 cases)
              </h4>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {generatedData.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: 12,
                      backgroundColor: "rgba(255, 255, 255, 0.03)",
                      borderRadius: 8,
                      border: "1px solid rgba(255, 255, 255, 0.06)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <span className="badge" style={{ fontSize: 11 }}>
                        {item.id}
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: 13,
                        lineHeight: 1.6,
                        color: "rgba(255, 255, 255, 0.85)",
                      }}
                    >
                      {item.plny_skutek_short.length > 300
                        ? item.plny_skutek_short.substring(0, 300) + "..."
                        : item.plny_skutek_short}
                    </p>
                  </div>
                ))}
              </div>
              {generatedData.length > 5 && (
                <p
                  className="muted"
                  style={{ marginTop: 12, fontSize: 13, textAlign: "center" }}
                >
                  ...and {generatedData.length - 5} more cases
                </p>
              )}
            </div>

            <div style={{ marginTop: 20 }}>
              <button
                className="btn primary"
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent("switchToDataBrowser", {
                      detail: { filename: savedFilename },
                    })
                  );
                }}
              >
                View in Data Browser
              </button>
            </div>
          </div>
        </section>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default MockupDataGenerator;
