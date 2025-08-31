import React from "react";

const P3LogsSection = ({ showRawLogs, setShowRawLogs, output, outputRef }) => {
  return (
    <div className="logs-section">
      <div className="logs-header">
        <h4>🔍 Technical Logs</h4>
        <button
          onClick={() => setShowRawLogs(!showRawLogs)}
          className="toggle-logs-btn"
        >
          {showRawLogs ? "Hide Logs" : "Show Logs"}
        </button>
      </div>

      {showRawLogs && (
        <div className="output-terminal" ref={outputRef}>
          {output.length === 0 ? (
            <div className="no-output">No logs yet.</div>
          ) : (
            output.map((entry) => (
              <div key={entry.id} className={`output-line ${entry.type}`}>
                <span className="timestamp">[{entry.timestamp}]</span>
                <span className="content">{entry.text}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default P3LogsSection;
