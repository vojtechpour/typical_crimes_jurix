import React from "react";

const Statistics = ({ modifiedThemes, originalThemes, changesLog }) => {
  const getTotalChanges = () => changesLog.length;

  const getThemesModified = () => {
    const changedThemes = new Set();
    changesLog.forEach((change) => {
      if (change.action === "move") {
        changedThemes.add(change.from);
        changedThemes.add(change.to);
      } else if (change.action === "reorder") {
        changedThemes.add(change.theme);
      }
    });
    return changedThemes.size;
  };

  const getLargestTheme = () => {
    if (!modifiedThemes || Object.keys(modifiedThemes).length === 0) {
      return { name: "No data", count: 0 };
    }

    let largestTheme = "";
    let largestCount = 0;

    Object.entries(modifiedThemes).forEach(([themeName, subThemes]) => {
      if (subThemes.length > largestCount) {
        largestCount = subThemes.length;
        largestTheme = themeName;
      }
    });

    return { name: largestTheme, count: largestCount };
  };

  const largest = getLargestTheme();

  return (
    <div className="statistics">
      <h3>📈 Summary Statistics</h3>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{getTotalChanges()}</div>
          <div className="stat-label">Total Changes Made</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">{getThemesModified()}</div>
          <div className="stat-label">Themes Modified</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">{largest.name}</div>
          <div className="stat-label">
            Largest Theme ({largest.count} items)
          </div>
        </div>
      </div>

      <div className="detailed-stats">
        <h4>Current Theme Sizes</h4>
        <div className="theme-sizes">
          {Object.entries(modifiedThemes).map(([themeName, subThemes]) => {
            const originalCount = originalThemes[themeName]?.length || 0;
            const currentCount = subThemes.length;
            const change = currentCount - originalCount;

            return (
              <div key={themeName} className="theme-size-item">
                <span className="theme-name">{themeName}</span>
                <span className="theme-count">
                  {currentCount} items
                  {change !== 0 && (
                    <span
                      className={`change ${
                        change > 0 ? "positive" : "negative"
                      }`}
                    >
                      ({change > 0 ? "+" : ""}
                      {change})
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Statistics;
