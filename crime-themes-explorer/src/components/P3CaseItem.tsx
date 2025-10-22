import React, { useState, useEffect } from "react";
import "./P3CaseItem.css";

export type ThemeField = "candidate_theme" | "theme";

export interface CaseThemeItem {
  caseId: string | number;
  candidate_theme?: string | null;
  theme?: string | null;
  caseText?: string | null;
  initialCodes?: string[] | string | null;
  [key: string]: unknown;
}

interface Props {
  caseItem: CaseThemeItem;
  expandedCases: Set<string | number>;
  toggleCaseExpansion: (caseId: string | number) => void;
  onThemeUpdate?: (
    caseId: string | number,
    field: ThemeField,
    value: string | null
  ) => Promise<void> | void;
  onCodeUpdate?: (
    caseId: string | number,
    codes: string[]
  ) => Promise<void> | void;
}

const P3CaseItem: React.FC<Props> = ({
  caseItem,
  expandedCases,
  toggleCaseExpansion,
  onThemeUpdate,
  onCodeUpdate,
}) => {
  const [editingCandidateTheme, setEditingCandidateTheme] =
    useState<boolean>(false);
  const [editingTheme, setEditingTheme] = useState<boolean>(false);
  const [candidateThemeValue, setCandidateThemeValue] = useState<string>(
    caseItem.candidate_theme ?? ""
  );
  const [themeValue, setThemeValue] = useState<string>(caseItem.theme ?? "");
  const [addingCandidateTheme, setAddingCandidateTheme] =
    useState<boolean>(false);
  const [addingTheme, setAddingTheme] = useState<boolean>(false);

  // Code editing state
  const [editedCodes, setEditedCodes] = useState<string[]>([]);
  const [editingIndex, setEditingIndex] = useState<number>(-1);
  const [editValue, setEditValue] = useState<string>("");

  useEffect(() => {
    const initialCodesList: string[] = Array.isArray(caseItem.initialCodes)
      ? caseItem.initialCodes
      : caseItem.initialCodes
      ? [String(caseItem.initialCodes)]
      : [];
    setEditedCodes(initialCodesList);
  }, [caseItem.initialCodes]);

  const handleSaveCandidateTheme = async () => {
    const value = candidateThemeValue.trim();
    if (!value) return;

    try {
      if (onThemeUpdate) {
        await onThemeUpdate(caseItem.caseId, "candidate_theme", value);
      }
      setEditingCandidateTheme(false);
      setAddingCandidateTheme(false);
    } catch (error) {
      console.error("Error saving candidate theme:", error);
    }
  };

  const handleSaveTheme = async () => {
    const value = themeValue.trim();
    if (!value) return;

    try {
      if (onThemeUpdate) {
        await onThemeUpdate(caseItem.caseId, "theme", value);
      }
      setEditingTheme(false);
      setAddingTheme(false);
    } catch (error) {
      console.error("Error saving theme:", error);
    }
  };

  const handleDeleteCandidateTheme = async () => {
    if (
      !window.confirm("Are you sure you want to delete this candidate theme?")
    ) {
      return;
    }

    try {
      if (onThemeUpdate) {
        await onThemeUpdate(caseItem.caseId, "candidate_theme", null);
      }
      setCandidateThemeValue("");
    } catch (error) {
      console.error("Error deleting candidate theme:", error);
    }
  };

  const handleDeleteTheme = async () => {
    if (window.confirm("Are you sure you want to delete this theme?")) {
      try {
        if (onThemeUpdate) {
          await onThemeUpdate(caseItem.caseId, "theme", null);
        }
        setThemeValue("");
      } catch (error) {
        console.error("Error deleting theme:", error);
      }
    }
  };

  const startAddingCandidateTheme = () => {
    setAddingCandidateTheme(true);
    setCandidateThemeValue("");
  };

  const startAddingTheme = () => {
    setAddingTheme(true);
    setThemeValue("");
  };

  const cancelEdit = (type: "candidate" | "theme") => {
    if (type === "candidate") {
      setEditingCandidateTheme(false);
      setAddingCandidateTheme(false);
      setCandidateThemeValue(caseItem.candidate_theme ?? "");
    } else {
      setEditingTheme(false);
      setAddingTheme(false);
      setThemeValue(caseItem.theme ?? "");
    }
  };

  // Code editing handlers
  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditValue(editedCodes[index] || "");
  };

  const handleSaveEdit = async () => {
    if (editingIndex < 0) return;

    const trimmedValue = editValue.trim();

    if (trimmedValue) {
      const updatedCodes = [...editedCodes];
      updatedCodes[editingIndex] = trimmedValue;
      setEditedCodes(updatedCodes);
      if (onCodeUpdate) {
        await onCodeUpdate(caseItem.caseId, updatedCodes);
      }
      setEditingIndex(-1);
      setEditValue("");
      return;
    }

    // If empty, remove the code
    const isNewEmptyCode = editedCodes[editingIndex] === "";
    if (isNewEmptyCode) {
      const updatedCodes = editedCodes.filter((_, idx) => idx !== editingIndex);
      setEditedCodes(updatedCodes.length > 0 ? updatedCodes : []);
      if (onCodeUpdate && updatedCodes.length > 0) {
        await onCodeUpdate(caseItem.caseId, updatedCodes);
      }
    }

    setEditingIndex(-1);
    setEditValue("");
  };

  const handleCancelEdit = () => {
    if (editingIndex >= 0 && editedCodes[editingIndex] === "") {
      const updatedCodes = editedCodes.filter((_, idx) => idx !== editingIndex);
      setEditedCodes(updatedCodes.length > 0 ? updatedCodes : []);
    }
    setEditingIndex(-1);
    setEditValue("");
  };

  const handleDeleteCode = async (index: number) => {
    const updatedCodes = editedCodes.filter((_, i) => i !== index);
    setEditedCodes(updatedCodes);
    if (onCodeUpdate && updatedCodes.length > 0) {
      await onCodeUpdate(caseItem.caseId, updatedCodes);
    }
  };

  const handleAddNewCode = () => {
    const updatedCodes = [...editedCodes, ""];
    setEditedCodes(updatedCodes);
    setEditingIndex(updatedCodes.length - 1);
    setEditValue("");
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSaveEdit();
    else if (e.key === "Escape") handleCancelEdit();
  };

  const renderCaseText = (): string => {
    const text = caseItem.caseText ?? "";
    if (!text) return "No description available";
    if (expandedCases.has(caseItem.caseId) || text.length <= 200) {
      return text;
    }
    return `${text.substring(0, 200)}...`;
  };

  return (
    <div className="code-generation-item">
      <div className="item-header">
        <div className="case-info">
          <div className="case-metadata">
            <span className="case-id">Case {caseItem.caseId}</span>
          </div>
          {(caseItem.candidate_theme ||
            caseItem.theme ||
            addingCandidateTheme ||
            addingTheme) && (
            <div className="themes-tags-header">
              {(caseItem.candidate_theme || addingCandidateTheme) && (
                <div className="theme-item">
                  <span className="theme-label">Candidate Theme:</span>
                  {editingCandidateTheme || addingCandidateTheme ? (
                    <div className="theme-edit-container">
                      <input
                        type="text"
                        value={candidateThemeValue}
                        onChange={(e) => setCandidateThemeValue(e.target.value)}
                        className="theme-edit-input"
                        placeholder="Enter candidate theme..."
                        autoFocus
                      />
                      <div className="theme-edit-actions">
                        <button
                          onClick={handleSaveCandidateTheme}
                          className="theme-save-btn"
                          disabled={!candidateThemeValue.trim()}
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => cancelEdit("candidate")}
                          className="theme-cancel-btn"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="theme-display-container">
                      <span
                        className="theme-tag candidate-theme"
                        title="P3 Candidate Theme"
                      >
                        {caseItem.candidate_theme}
                      </span>
                      <div className="theme-actions">
                        <button
                          onClick={() => {
                            setEditingCandidateTheme(true);
                            setCandidateThemeValue(
                              caseItem.candidate_theme ?? ""
                            );
                          }}
                          className="theme-edit-btn"
                          title="Edit candidate theme"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={handleDeleteCandidateTheme}
                          className="theme-delete-btn"
                          title="Delete candidate theme"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(caseItem.theme || addingTheme) && (
                <div className="theme-item">
                  <span className="theme-label">Theme:</span>
                  {editingTheme || addingTheme ? (
                    <div className="theme-edit-container">
                      <input
                        type="text"
                        value={themeValue}
                        onChange={(e) => setThemeValue(e.target.value)}
                        className="theme-edit-input"
                        placeholder="Enter theme..."
                        autoFocus
                      />
                      <div className="theme-edit-actions">
                        <button
                          onClick={handleSaveTheme}
                          className="theme-save-btn"
                          disabled={!themeValue.trim()}
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => cancelEdit("theme")}
                          className="theme-cancel-btn"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="theme-display-container">
                      <span
                        className="theme-tag final-theme"
                        title="P3b Finalized Theme"
                      >
                        {caseItem.theme}
                      </span>
                      <div className="theme-actions">
                        <button
                          onClick={() => {
                            setEditingTheme(true);
                            setThemeValue(caseItem.theme ?? "");
                          }}
                          className="theme-edit-btn"
                          title="Edit theme"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={handleDeleteTheme}
                          className="theme-delete-btn"
                          title="Delete theme"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="add-theme-buttons">
                {!caseItem.candidate_theme && !addingCandidateTheme && (
                  <button
                    onClick={startAddingCandidateTheme}
                    className="add-theme-btn candidate"
                  >
                    + Add Candidate Theme
                  </button>
                )}
                {!caseItem.theme && !addingTheme && (
                  <button
                    onClick={startAddingTheme}
                    className="add-theme-btn final"
                  >
                    + Add Theme
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="item-actions">
          <button
            className="regenerate-btn"
            type="button"
            title="Regenerate themes with custom instructions"
          >
            🔄 Regenerate
          </button>
          <button
            className="add-code-btn"
            type="button"
            title="Add new code"
            onClick={handleAddNewCode}
          >
            ➕ Add Code
          </button>
        </div>
      </div>

      <div className="case-text-section">
        <div className="case-text-header">
          <h6>Case Description</h6>
          {typeof caseItem.caseText === "string" &&
            caseItem.caseText.length > 200 && (
              <button
                className="expand-text-btn"
                type="button"
                onClick={() => toggleCaseExpansion(caseItem.caseId)}
              >
                {expandedCases.has(caseItem.caseId) ? "Show Less" : "Show More"}
              </button>
            )}
        </div>
        <div className="case-text-content">
          <p className="case-text">{renderCaseText()}</p>
        </div>
      </div>

      {editedCodes.length > 0 && (
        <div className="codes-content">
          <div className="codes-header">
            <h6>🏷️ Initial Codes</h6>
          </div>
          <div className="codes-display">
            <div className="codes-tags">
              {editedCodes.map((code, codeIndex) => (
                <div
                  key={`${caseItem.caseId}-code-${codeIndex}`}
                  className="code-tag-container"
                >
                  {editingIndex === codeIndex ? (
                    <div className="code-edit-inline">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyPress}
                        onBlur={handleSaveEdit}
                        className="code-edit-input"
                        placeholder="Enter code..."
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
                    <div className="code-tag-wrapper">
                      <span className="code-tag initial-code">{code}</span>
                      <div className="code-actions">
                        <button
                          className="edit-code-btn"
                          type="button"
                          title="Edit initial code"
                          onClick={() => handleStartEdit(codeIndex)}
                        >
                          ✏️
                        </button>
                        {editedCodes.length > 1 && (
                          <button
                            className="delete-code-btn"
                            type="button"
                            title="Delete initial code"
                            onClick={() => handleDeleteCode(codeIndex)}
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!caseItem.candidate_theme &&
        !caseItem.theme &&
        editedCodes.length === 0 && (
          <div className="no-content">
            <span>No themes or codes generated yet</span>
          </div>
        )}
    </div>
  );
};

export default P3CaseItem;
