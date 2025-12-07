import React, { useMemo, useState } from "react";
import { FiDownload, FiFileText, FiCode, FiTrash2 } from "react-icons/fi";
import DeleteConfirmModal from "./ui/DeleteConfirmModal";

interface FinalTheme {
  name: string;
  description: string;
  mergedFrom: string[];
}

interface ParsedThemes {
  finalThemes: FinalTheme[];
  mappings: Record<string, string>;
}

interface P3bStatus {
  isRunning: boolean;
  phase: string;
  error?: string | null;
  finalThemes?: string | null;
  output: Array<{ id: string | number; timestamp: string; text: string }>;
}

interface P3bResultsProps {
  p3bStatus: P3bStatus;
  candidateThemes?: string[];
  onClear?: () => void;
}

const P3bResults: React.FC<P3bResultsProps> = ({
  p3bStatus,
  candidateThemes = [],
  onClear,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const parsedThemes = useMemo((): ParsedThemes | null => {
    if (!p3bStatus.finalThemes) return null;
    try {
      const parsed = JSON.parse(p3bStatus.finalThemes);
      if (parsed.finalThemes && Array.isArray(parsed.finalThemes)) {
        return parsed as ParsedThemes;
      }
    } catch {
      // Fallback for non-JSON content
    }
    return null;
  }, [p3bStatus.finalThemes]);

  const hasThemes = !!p3bStatus.finalThemes;

  return (
    <div className="live-themes-section">
      <div className="section-header">
        <h4>Theme Finalization (P3b)</h4>
        <div className="p3b-status">
          <span
            className={`status-badge ${
              p3bStatus.isRunning
                ? "running"
                : hasThemes
                ? "success"
                : p3bStatus.phase === "P3b Failed"
                ? "error"
                : ""
            }`}
          >
            {p3bStatus.isRunning
              ? "Processing..."
              : hasThemes
              ? "Complete"
              : p3bStatus.phase === "P3b Failed"
              ? "Failed"
              : "Not started"}
          </span>
        </div>
      </div>

      <div className="p3b-content">
        <div className="p3b-description">
          <p>
            P3b automatically refines and finalizes the candidate themes from
            P3, creating a mutually exclusive and comprehensive set of final
            themes that cover the entire spectrum of criminal behaviors in the
            dataset.
          </p>
        </div>

        {p3bStatus.error && (
          <div className="p3b-error">
            <h6>Error</h6>
            <p>{p3bStatus.error}</p>
          </div>
        )}

        {!p3bStatus.finalThemes && !p3bStatus.isRunning && (
          <div className="p3b-candidates">
            {candidateThemes.length > 0 ? (
              <>
                <h6 style={{ marginBottom: 12 }}>
                  Candidate Themes to Finalize ({candidateThemes.length})
                </h6>
                <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
                  These candidate themes from P3 will be refined and merged into
                  final themes.
                </p>
                <div className="candidate-themes-list">
                  {candidateThemes.map((theme, index) => (
                    <div
                      key={index}
                      className="candidate-theme-item"
                      style={{
                        padding: "12px 16px",
                        background: "var(--surface-2)",
                        borderRadius: "var(--radius-m)",
                        marginBottom: 8,
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <span
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          background: "var(--primary-100)",
                          color: "var(--primary-600)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          fontWeight: 600,
                          flexShrink: 0,
                        }}
                      >
                        {index + 1}
                      </span>
                      <span style={{ color: "var(--text-primary)" }}>
                        {theme}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div
                style={{
                  padding: "24px",
                  textAlign: "center",
                  color: "var(--text-secondary)",
                  background: "var(--surface-2)",
                  borderRadius: "var(--radius-m)",
                }}
              >
                <p style={{ margin: 0 }}>
                  No candidate themes found. Run P3 analysis first to generate
                  candidate themes.
                </p>
              </div>
            )}
          </div>
        )}

        {p3bStatus.finalThemes && (
          <div className="p3b-results">
            <h6 style={{ marginBottom: 16 }}>
              Final Themes{" "}
              {parsedThemes && `(${parsedThemes.finalThemes.length})`}
            </h6>

            {parsedThemes ? (
              <div className="final-themes-cards">
                {parsedThemes.finalThemes.map((theme, index) => (
                  <div key={index} className="final-theme-card">
                    <div className="final-theme-header">
                      <span className="final-theme-number">{index + 1}</span>
                      <h5 className="final-theme-name">{theme.name}</h5>
                    </div>
                    <p className="final-theme-description">
                      {theme.description}
                    </p>
                    {theme.mergedFrom && theme.mergedFrom.length > 0 && (
                      <div className="merged-from">
                        <span className="merged-label">
                          Merged from {theme.mergedFrom.length} candidate
                          theme(s):
                        </span>
                        <ul className="merged-list">
                          {theme.mergedFrom.map((candidate, i) => (
                            <li key={i}>{candidate}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}

                {parsedThemes.mappings &&
                  Object.keys(parsedThemes.mappings).length > 0 && (
                    <div className="theme-mappings">
                      <h6>Theme Mappings</h6>
                      <p className="muted" style={{ fontSize: 13 }}>
                        Shows how each candidate theme maps to a final theme
                      </p>
                      <div className="mappings-table">
                        <div className="mapping-header">
                          <span>Candidate Theme</span>
                          <span>→</span>
                          <span>Final Theme</span>
                        </div>
                        {Object.entries(parsedThemes.mappings).map(
                          ([candidate, final], i) => (
                            <div key={i} className="mapping-row">
                              <span className="candidate-theme">
                                {candidate}
                              </span>
                              <span className="arrow">→</span>
                              <span className="final-theme">{final}</span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
              </div>
            ) : (
              <div className="final-themes-output">
                <pre>{p3bStatus.finalThemes}</pre>
              </div>
            )}

            <div className="p3b-export-actions">
              <button
                className="btn subtle"
                onClick={() => {
                  const blob = new Blob([p3bStatus.finalThemes as string], {
                    type: "application/json",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `p3b_final_themes_${new Date()
                    .toISOString()
                    .slice(0, 19)
                    .replace(/:/g, "-")}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <FiDownload /> Download JSON
              </button>
              <button
                className="btn subtle"
                onClick={() => {
                  // Export mappings as CSV
                  if (!parsedThemes?.mappings) return;
                  const header = ["candidate_theme", "final_theme"];
                  const escapeCsv = (v: string) => {
                    const needs = /[",\n]/.test(v);
                    const esc = v.replace(/"/g, '""');
                    return needs ? `"${esc}"` : esc;
                  };
                  const rows = Object.entries(parsedThemes.mappings).map(
                    ([candidate, final]) =>
                      [escapeCsv(candidate), escapeCsv(final)].join(",")
                  );
                  const csv = [header.join(","), ...rows].join("\n");
                  const blob = new Blob([csv], {
                    type: "text/csv;charset=utf-8",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `p3b_theme_mappings_${new Date()
                    .toISOString()
                    .slice(0, 19)
                    .replace(/:/g, "-")}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <FiFileText /> Export CSV
              </button>
              <button
                className="btn subtle"
                onClick={() => {
                  if (!parsedThemes) return;
                  const safe = (s: string) =>
                    (s || "")
                      .replace(/&/g, "&amp;")
                      .replace(/</g, "&lt;")
                      .replace(/>/g, "&gt;");

                  const themesHtml = parsedThemes.finalThemes
                    .map(
                      (t, i) => `
                    <div class="theme-card">
                      <h3>${i + 1}. ${safe(t.name)}</h3>
                      <p>${safe(t.description)}</p>
                      ${
                        t.mergedFrom?.length
                          ? `<div class="merged"><strong>Merged from:</strong><ul>${t.mergedFrom
                              .map((m) => `<li>${safe(m)}</li>`)
                              .join("")}</ul></div>`
                          : ""
                      }
                    </div>`
                    )
                    .join("");

                  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>P3b Final Themes Report</title>
  <style>
    body{font-family:system-ui,-apple-system,sans-serif;margin:24px;color:#222;max-width:900px}
    h1{margin:0 0 8px 0;font-size:24px}
    h2{margin:24px 0 12px 0;font-size:18px;color:#666}
    .meta{color:#888;margin-bottom:24px;font-size:14px}
    .theme-card{background:#f9f9f9;border:1px solid #e0e0e0;border-radius:8px;padding:16px;margin-bottom:16px}
    .theme-card h3{margin:0 0 8px 0;font-size:16px;color:#333}
    .theme-card p{margin:0 0 12px 0;color:#555;line-height:1.5}
    .merged{background:#fff;padding:12px;border-radius:4px;font-size:14px}
    .merged ul{margin:8px 0 0 0;padding-left:20px}
    .merged li{margin-bottom:4px;color:#666}
  </style>
</head>
<body>
  <h1>Final Themes Report</h1>
  <div class="meta">Generated ${new Date().toLocaleString()} • ${
                    parsedThemes.finalThemes.length
                  } themes</div>
  <h2>Themes</h2>
  ${themesHtml}
</body>
</html>`;

                  const blob = new Blob([html], {
                    type: "text/html;charset=utf-8",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `p3b_themes_report_${new Date()
                    .toISOString()
                    .slice(0, 19)
                    .replace(/:/g, "-")}.html`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <FiCode /> Export HTML
              </button>
              {onClear && (
                <button
                  className="btn subtle danger"
                  onClick={() => setShowDeleteConfirm(true)}
                  style={{ marginLeft: "auto" }}
                >
                  <FiTrash2 /> Delete
                </button>
              )}
            </div>
          </div>
        )}

        <DeleteConfirmModal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={() => {
            onClear?.();
            setShowDeleteConfirm(false);
          }}
          title="Delete Final Themes?"
          description={
            <>
              This will permanently delete{" "}
              <strong style={{ color: "#ef4444" }}>
                {parsedThemes?.finalThemes.length || 0} final theme
                {(parsedThemes?.finalThemes.length || 0) !== 1 ? "s" : ""}
              </strong>
              . This action cannot be undone.
            </>
          }
          confirmText="Delete All"
        />
      </div>
    </div>
  );
};

export default P3bResults;
