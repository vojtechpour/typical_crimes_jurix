import React from "react";

interface Props {
  changesCount: number;
  onReset: () => void;
  onExport: () => void;
}

const ControlPanel: React.FC<Props> = ({ changesCount, onReset, onExport }) => {
  return (
    <div className="control-panel">
      <div className="panel-left">
        <h3>🗂️ Drag & Drop Theme Reorganizer</h3>
        <p>Select two themes and drag sub-themes between them</p>
      </div>

      <div className="panel-center">
        <button
          className="reset-button"
          onClick={onReset}
          title="Reset all changes"
        >
          🔄 Reset All
        </button>
      </div>

      <div className="panel-right">
        <div className="changes-counter">
          <div className="metric">
            <div className="metric-value">{changesCount}</div>
            <div className="metric-label">Changes</div>
          </div>
        </div>
      </div>

      <div className="panel-export">
        <button
          className="export-button"
          onClick={onExport}
          disabled={changesCount === 0}
          title="Export modified themes"
        >
          💾 Export
        </button>
      </div>
    </div>
  );
};

export default ControlPanel;
