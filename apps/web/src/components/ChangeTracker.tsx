import React from "react";

export type Change = {
  id: string | number;
  type: string;
  description: string;
  timestamp: Date;
  reverted?: boolean;
  details?: Record<string, unknown>;
};

interface Props {
  changes: Change[];
  onClearChanges: () => void;
  onRevertChange: (id: string | number) => void;
  onRevertAllChanges: () => void;
}

const ChangeTracker: React.FC<Props> = ({
  changes,
  onClearChanges,
  onRevertChange,
  onRevertAllChanges,
}) => {
  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getChangeIcon = (type: string) => {
    switch (type) {
      case "theme":
        return ">";
      case "candidate_theme":
        return "*";
      case "main_theme":
        return "~";
      case "ai_suggestion":
        return "AI";
      default:
        return "-";
    }
  };

  return (
    <div className="change-tracker">
      <div className="change-tracker-header">
        <h5>Recent Changes</h5>
        {changes.length > 0 && (
          <div className="change-tracker-buttons">
            <button
              onClick={onClearChanges}
              className="clear-changes-btn"
              title="Clear all changes"
            >
              Clear
            </button>
            {changes.some((c) => !c.reverted) && (
              <button
                onClick={onRevertAllChanges}
                className="revert-all-changes-btn"
                title="Revert all changes"
              >
                Revert All
              </button>
            )}
          </div>
        )}
      </div>

      <div className="changes-list">
        {changes.length === 0 ? (
          <div className="no-changes">No changes made yet</div>
        ) : (
          changes.map((change) => (
            <div
              key={change.id}
              className={`change-item ${change.reverted ? "reverted" : ""}`}
            >
              <span className="change-icon">{getChangeIcon(change.type)}</span>
              <span className="change-description">
                {change.reverted ? "(reverted) " : ""}
                {change.description}
              </span>
              <span className="change-time">
                {formatTimestamp(change.timestamp)}
              </span>
              {!change.reverted && (
                <button
                  onClick={() => onRevertChange(change.id)}
                  className="revert-change-btn"
                  title="Revert this change"
                >
                  Undo
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ChangeTracker;
