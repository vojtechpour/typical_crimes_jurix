import React from "react";

interface Props {
  themeNames: string[];
  leftTheme: string;
  rightTheme: string;
  onLeftThemeChange: (v: string) => void;
  onRightThemeChange: (v: string) => void;
}

const ThemeSelector: React.FC<Props> = ({
  themeNames,
  leftTheme,
  rightTheme,
  onLeftThemeChange,
  onRightThemeChange,
}) => {
  const rightThemeOptions = themeNames.filter((name) => name !== leftTheme);

  return (
    <div className="theme-selector">
      <div className="selector-column">
        <label htmlFor="left-theme">📂 Left Container - Select Theme:</label>
        <select
          id="left-theme"
          value={leftTheme}
          onChange={(e) => onLeftThemeChange(e.target.value)}
          className="theme-select"
        >
          {themeNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="selector-column">
        <label htmlFor="right-theme">📂 Right Container - Select Theme:</label>
        <select
          id="right-theme"
          value={rightTheme}
          onChange={(e) => onRightThemeChange(e.target.value)}
          className="theme-select"
        >
          {rightThemeOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="quick-actions">
        <button
          className="swap-button"
          onClick={() => {
            onLeftThemeChange(rightTheme);
            onRightThemeChange(leftTheme);
          }}
          title="Swap themes"
        >
          🔀 Swap
        </button>
      </div>
    </div>
  );
};

export default ThemeSelector;
