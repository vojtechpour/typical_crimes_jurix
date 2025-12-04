import React, { useState } from "react";

interface ThemeData {
  caseId: string | number;
  theme: string;
  timestamp: string | number | Date;
  initialCodes?: string[] | string;
  caseText?: string;
}

interface Props {
  themeData: ThemeData;
  onEdit: (t: ThemeData) => void;
  onSave: (caseId: string | number, newTheme: string) => void;
  onRegenerate: (t: ThemeData) => void;
  isSaving: boolean;
  isRegenerating: boolean;
}

const ExistingThemeItem: React.FC<Props> = ({
  themeData,
  onEdit,
  onSave,
  onRegenerate,
  isSaving,
  isRegenerating,
}) => {
  const [editingTheme, setEditingTheme] = useState(themeData.theme);
  const [isEditing, setIsEditing] = useState(false);

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditingTheme(themeData.theme);
  };

  const handleSaveEdit = () => {
    if (editingTheme.trim()) {
      onSave(themeData.caseId, editingTheme.trim());
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingTheme(themeData.theme);
  };

  return (
    <div className="theme-generation-item">
      <div className="item-header">
        <div className="case-info">
          <span className="case-id">Case {themeData.caseId}</span>
          <span className="generation-time">
            {new Date(themeData.timestamp).toLocaleTimeString()}
          </span>
        </div>
        <div className="item-actions">
          <button
            className="regenerate-btn"
            onClick={() => onRegenerate(themeData)}
            disabled={isRegenerating}
            type="button"
            title="Regenerate theme"
          >
            {isRegenerating ? "🔄" : "🎯"} Regenerate
          </button>
        </div>
      </div>

      <div className="theme-content">
        <div className="theme-display">
          <h6>🎯 Candidate Theme</h6>
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
                  disabled={isSaving}
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
              <span className="theme-tag">{themeData.theme}</span>
              <button
                className="edit-theme-btn"
                onClick={handleStartEdit}
                type="button"
                title="Edit theme"
                disabled={isSaving}
              >
                ✏️
              </button>
            </div>
          )}
        </div>

        {themeData.initialCodes && (
          <div className="initial-codes-display">
            <h6>🏷️ Source Initial Codes</h6>
            <div className="codes-tags">
              {Array.isArray(themeData.initialCodes) ? (
                themeData.initialCodes.map((code, index) => (
                  <span key={index} className="source-code-tag">
                    {code}
                  </span>
                ))
              ) : (
                <span className="source-code-tag">
                  {themeData.initialCodes}
                </span>
              )}
            </div>
          </div>
        )}

        {themeData.caseText && (
          <div className="case-text-section">
            <div className="case-text-header">
              <h6>📄 Case Text</h6>
            </div>
            <div className="case-text-content">
              <p className="case-text">
                {themeData.caseText.length > 200
                  ? `${themeData.caseText.substring(0, 200)}...`
                  : themeData.caseText}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExistingThemeItem;
