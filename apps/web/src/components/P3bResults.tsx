import React from "react";

interface P3bStatus {
  isRunning: boolean;
  phase: string;
  error?: string | null;
  finalThemes?: string | null;
  output: Array<{ id: string | number; timestamp: string; text: string }>;
}

const P3bResults: React.FC<{ p3bStatus: P3bStatus }> = ({ p3bStatus }) => {
  if (p3bStatus.phase === "Idle" && !p3bStatus.finalThemes) {
    return null;
  }

  return (
    <div className="live-themes-section">
      <div className="section-header">
        <h4>🏁 Theme Finalization (P3b)</h4>
        <div className="p3b-status">
          <span
            className={`status-badge ${
              p3bStatus.isRunning ? "running" : "completed"
            }`}
          >
            {p3bStatus.isRunning
              ? "🔄 Processing"
              : p3bStatus.phase === "P3b Complete"
              ? "✅ Complete"
              : p3bStatus.phase === "P3b Failed"
              ? "❌ Failed"
              : p3bStatus.phase}
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
            <h6>❌ P3b Error</h6>
            <p>{p3bStatus.error}</p>
          </div>
        )}

        {p3bStatus.finalThemes && (
          <div className="p3b-results">
            <h6>🏁 Final Themes Output</h6>
            <div className="final-themes-output">
              <pre>{p3bStatus.finalThemes}</pre>
            </div>
            <div className="p3b-actions">
              <button
                className="download-btn"
                onClick={() => {
                  const blob = new Blob([p3bStatus.finalThemes as string], {
                    type: "text/plain",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "p3b_final_themes.txt";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                📥 Download Final Themes
              </button>
              <button
                className="download-btn"
                onClick={() => {
                  const text = p3bStatus.finalThemes as string;
                  // Try to parse as JSON array of objects with fields like {caseId, theme}
                  let rows: Array<{
                    caseId?: string | number;
                    theme?: string;
                  }> = [];
                  try {
                    const parsed = JSON.parse(text);
                    if (Array.isArray(parsed)) {
                      rows = parsed as any;
                    }
                  } catch {
                    // Fallback: split lines as CSV-ish "caseId,theme"
                    rows = text
                      .split(/\r?\n/)
                      .map((l) => l.trim())
                      .filter((l) => l.length > 0)
                      .map((l) => {
                        const m = l.split(",");
                        return { caseId: m[0], theme: m.slice(1).join(",") };
                      });
                  }

                  const header = ["case_id", "final_theme"];
                  const escapeCsv = (v: any) => {
                    const s = v == null ? "" : String(v);
                    const needs = /[",\n]/.test(s);
                    const esc = s.replace(/"/g, '""');
                    return needs ? `"${esc}"` : esc;
                  };
                  const csv = [
                    header.join(","),
                    ...rows.map((r) =>
                      [
                        escapeCsv(r.caseId ?? ""),
                        escapeCsv(r.theme ?? ""),
                      ].join(",")
                    ),
                  ].join("\n");

                  const blob = new Blob([csv], {
                    type: "text/csv;charset=utf-8",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `p3b_final_themes_${new Date()
                    .toISOString()
                    .slice(0, 19)
                    .replace(/:/g, "-")}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                📄 Export CSV
              </button>
              <button
                className="download-btn"
                onClick={() => {
                  const text = p3bStatus.finalThemes as string;
                  let rows: Array<{
                    caseId?: string | number;
                    theme?: string;
                  }> = [];
                  try {
                    const parsed = JSON.parse(text);
                    if (Array.isArray(parsed)) {
                      rows = parsed as any;
                    }
                  } catch {
                    rows = text
                      .split(/\r?\n/)
                      .map((l) => l.trim())
                      .filter((l) => l.length > 0)
                      .map((l) => {
                        const m = l.split(",");
                        return { caseId: m[0], theme: m.slice(1).join(",") };
                      });
                  }

                  const safe = (s: string) =>
                    (s || "")
                      .replace(/&/g, "&amp;")
                      .replace(/</g, "&lt;")
                      .replace(/>/g, "&gt;");

                  const rowsHtml = rows
                    .map(
                      (r) =>
                        `<tr><td>${safe(String(r.caseId ?? ""))}</td><td>${safe(
                          String(r.theme ?? "")
                        )}</td></tr>`
                    )
                    .join("");

                  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>P3b Final Themes</title>
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
    <h1>P3b Final Themes</h1>
    <div class="meta">Exported at ${new Date().toISOString()}</div>
    <table>
      <thead><tr><th>Case ID</th><th>Final Theme</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </body>
  </html>`;

                  const blob = new Blob([html], {
                    type: "text/html;charset=utf-8",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `p3b_final_themes_${new Date()
                    .toISOString()
                    .slice(0, 19)
                    .replace(/:/g, "-")}.html`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                🧾 Export HTML
              </button>
            </div>
          </div>
        )}

        {p3bStatus.output.length > 0 && (
          <div className="p3b-live-output">
            <h6>🔍 P3b Processing Output</h6>
            <div className="p3b-output-terminal">
              {p3bStatus.output.map((entry) => (
                <div key={entry.id} className="output-line">
                  <span className="timestamp">[{entry.timestamp}]</span>
                  <span className="content">{entry.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default P3bResults;
