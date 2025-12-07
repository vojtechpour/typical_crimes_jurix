import React from "react";

interface Props {
  analysisStatus: any;
  p3bStatus: any;
  isRunning: boolean;
  startTime: number | null;
  stopScript: () => void;
  formatDuration: (ms: number) => string;
}

const P3StatusDisplay: React.FC<Props> = ({
  analysisStatus,
  p3bStatus,
  isRunning,
  startTime,
  stopScript,
  formatDuration,
}) => {
  return (
    <div className="analysis-status">
      <div className="status-header">
        <h3>P3 Theme Analysis Status</h3>
        <div className="status-actions">
          {isRunning || p3bStatus.isRunning ? (
            <button className="stop-btn" onClick={stopScript} disabled={false}>
              Stop Analysis
            </button>
          ) : null}
        </div>
      </div>

      <div className="status-grid">
        <div className="status-card">
          <div className="status-label">P3 Phase</div>
          <div className="status-value">
            {analysisStatus.phase === "Complete (P3 + P3b)"
              ? "Complete"
              : analysisStatus.phase === "P3 Complete - Starting P3b"
              ? "Complete"
              : analysisStatus.phase}
          </div>
        </div>

        <div className="status-card">
          <div className="status-label">P3b Phase</div>
          <div className="status-value">
            {p3bStatus.phase === "P3b Complete"
              ? "Complete"
              : p3bStatus.phase === "P3b Failed"
              ? "Failed"
              : p3bStatus.isRunning
              ? p3bStatus.phase
              : p3bStatus.phase}
          </div>
        </div>

        {analysisStatus.currentCase && (
          <div className="status-card">
            <div className="status-label">Current Case</div>
            <div className="status-value">{analysisStatus.currentCase}</div>
          </div>
        )}

        <div className="status-card">
          <div className="status-label">Progress</div>
          <div className="status-value">
            {analysisStatus.totalCases > 0
              ? `${analysisStatus.processedCases}/${analysisStatus.totalCases}`
              : "—"}
            {analysisStatus.totalCases > 0 && (
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${
                      (analysisStatus.processedCases /
                        Math.max(analysisStatus.totalCases, 1)) *
                      100
                    }%`,
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="status-card">
          <div className="status-label">Candidate Themes</div>
          <div className="status-value">
            {analysisStatus.uniqueThemesCount || 0}
          </div>
        </div>

        <div className="status-card">
          <div className="status-label">API Calls</div>
          <div className="status-value">{analysisStatus.apiCalls}</div>
        </div>

        {startTime && (
          <div className="status-card">
            <div className="status-label">Runtime</div>
            <div className="status-value">
              {formatDuration(Date.now() - startTime)}
            </div>
          </div>
        )}

        {analysisStatus.estimatedTimeRemaining && (
          <div className="status-card">
            <div className="status-label">Est. Remaining</div>
            <div className="status-value">
              {formatDuration(analysisStatus.estimatedTimeRemaining)}
            </div>
          </div>
        )}
      </div>

      {/* Workflow Description */}
      <div className="workflow-description">
        <h5>Analysis Workflow</h5>
        <div className="workflow-steps">
          <div
            className={`workflow-step ${
              analysisStatus.phase !== "Idle" ? "active" : ""
            }`}
          >
            <span className="step-number">1</span>
            <span className="step-text">
              P3: Generate candidate themes from initial codes
            </span>
          </div>
          <div
            className={`workflow-step ${
              p3bStatus.phase !== "Idle" ? "active" : ""
            }`}
          >
            <span className="step-number">2</span>
            <span className="step-text">
              P3b: Finalize themes into mutually exclusive set
            </span>
          </div>
        </div>
      </div>

      {analysisStatus.errors.length > 0 && (
        <div className="errors-section">
          <h5>Errors ({analysisStatus.errors.length})</h5>
          {analysisStatus.errors.slice(-3).map((error: any, index: number) => (
            <div key={index} className="error-item">
              {error}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default P3StatusDisplay;
