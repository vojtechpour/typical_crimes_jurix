import React, { useState } from "react";

interface ThemeItem {
  caseId: string | number;
  theme: string;
  timestamp: Date;
  initialCodes?: string[];
}

interface Props {
  theme: ThemeItem;
  onEdit: (t: ThemeItem) => void;
  onSave: (caseId: string | number, newTheme: string) => void;
  isSaving: boolean;
}

const ThemeGenerationItem: React.FC<Props> = ({
  theme,
  onEdit,
  onSave,
  isSaving,
}) => {
  const [editingTheme, setEditingTheme] = useState(theme.theme);
  const [isEditing, setIsEditing] = useState(false);

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditingTheme(theme.theme);
  };

  const handleSaveEdit = () => {
    if (editingTheme.trim()) {
      onSave(theme.caseId, editingTheme.trim());
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingTheme(theme.theme);
  };

  return (
    <div className="theme-generation-item">
      <div className="item-header">
        <div className="case-info">
          <span className="case-id">Case {theme.caseId}</span>
          <span className="generation-time">
            {theme.timestamp.toLocaleTimeString()}
          </span>
        </div>
      </div>

      <div className="theme-content">
        <div className="theme-display">
          <h6>Candidate Theme</h6>
          {isEditing ? (
            <div className="theme-edit-inline">
              <input
                type="text"
                value={editingTheme}
                onChange={(e) => setEditingTheme(e.target.value)}
                className="theme-edit-input"
                placeholder="Enter theme name..."
                autoFocus
              />
              <div className="edit-buttons">
                <button
                  className="save-inline-btn"
                  onClick={handleSaveEdit}
                  type="button"
                  title="Save"
                >
                  ✓
                </button>
                <button
                  className="cancel-inline-btn"
                  onClick={handleCancelEdit}
                  type="button"
                  title="Cancel"
                >
                  ✕
                </button>
              </div>
            </div>
          ) : (
            <div className="theme-wrapper">
              <span className="theme-tag">{theme.theme}</span>
              <button
                className="edit-theme-btn"
                onClick={handleStartEdit}
                type="button"
                title="Edit theme"
                disabled={isSaving}
              >
                Edit
              </button>
            </div>
          )}
        </div>

        {theme.initialCodes && theme.initialCodes.length > 0 && (
          <div className="initial-codes-display">
            <h6>Source Initial Codes</h6>
            <div className="codes-tags">
              {theme.initialCodes.map((code, index) => (
                <span key={index} className="source-code-tag">
                  {code}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ThemeGenerationItem;
