import React from "react";

const P3bResults = ({ p3bStatus }) => {
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
                  const blob = new Blob([p3bStatus.finalThemes], {
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
