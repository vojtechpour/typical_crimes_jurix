import React, { useState } from "react";
import { FiEdit2, FiTrash2 } from "react-icons/fi";
import "./P3CaseItem.css";

const P3CaseItem = ({
  caseItem,
  expandedCases,
  toggleCaseExpansion,
  onThemeUpdate,
}) => {
  const [editingCandidateTheme, setEditingCandidateTheme] = useState(false);
  const [editingTheme, setEditingTheme] = useState(false);
  const [candidateThemeValue, setCandidateThemeValue] = useState(
    caseItem.candidate_theme || ""
  );
  const [themeValue, setThemeValue] = useState(caseItem.theme || "");
  const [addingCandidateTheme, setAddingCandidateTheme] = useState(false);
  const [addingTheme, setAddingTheme] = useState(false);

  const handleSaveCandidateTheme = async () => {
    try {
      // Call parent callback or API to save
      if (onThemeUpdate) {
        await onThemeUpdate(
          caseItem.caseId,
          "candidate_theme",
          candidateThemeValue
        );
      }
      setEditingCandidateTheme(false);
      setAddingCandidateTheme(false);
    } catch (error) {
      console.error("Error saving candidate theme:", error);
    }
  };

  const handleSaveTheme = async () => {
    try {
      // Call parent callback or API to save
      if (onThemeUpdate) {
        await onThemeUpdate(caseItem.caseId, "theme", themeValue);
      }
      setEditingTheme(false);
      setAddingTheme(false);
    } catch (error) {
      console.error("Error saving theme:", error);
    }
  };

  const handleDeleteCandidateTheme = async () => {
    if (
      window.confirm("Are you sure you want to delete this candidate theme?")
    ) {
      try {
        if (onThemeUpdate) {
          await onThemeUpdate(caseItem.caseId, "candidate_theme", null);
        }
        setCandidateThemeValue("");
      } catch (error) {
        console.error("Error deleting candidate theme:", error);
      }
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

  const cancelEdit = (type) => {
    if (type === "candidate") {
      setEditingCandidateTheme(false);
      setAddingCandidateTheme(false);
      setCandidateThemeValue(caseItem.candidate_theme || "");
    } else {
      setEditingTheme(false);
      setAddingTheme(false);
      setThemeValue(caseItem.theme || "");
    }
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
              {/* Candidate Theme Section */}
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
                            setCandidateThemeValue(caseItem.candidate_theme);
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

              {/* Theme Section */}
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
                            setThemeValue(caseItem.theme);
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

              {/* Add Theme Buttons */}
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
          <button className="add-code-btn" type="button" title="Add new theme">
            ➕ Add Theme
          </button>
        </div>
      </div>

      <div className="case-text-section">
        <div className="case-text-header">
          <h6>📄 Case Description</h6>
          {caseItem.caseText && caseItem.caseText.length > 200 && (
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
          <p className="case-text">
            {caseItem.caseText
              ? expandedCases.has(caseItem.caseId) ||
                caseItem.caseText.length <= 200
                ? caseItem.caseText
                : `${caseItem.caseText.substring(0, 200)}...`
              : "No description available"}
          </p>
        </div>
      </div>

      {/* Initial Codes Section */}
      {caseItem.initialCodes && caseItem.initialCodes.length > 0 && (
        <div className="codes-content">
          <div className="codes-header">
            <h6>🏷️ Initial Codes</h6>
          </div>
          <div className="codes-display">
            <div className="codes-tags">
              {caseItem.initialCodes.map((code, codeIndex) => (
                <div key={codeIndex} className="code-tag-container">
                  <div className="code-tag-wrapper">
                    <span className="code-tag initial-code">{code}</span>
                    <div className="code-actions">
                      <button
                        className="edit-code-btn"
                        type="button"
                        title="Edit initial code"
                      >
                        <FiEdit2 size={12} />
                      </button>
                      <button
                        className="delete-code-btn"
                        type="button"
                        title="Delete initial code"
                      >
                        <FiTrash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* No content message */}
      {!caseItem.candidate_theme &&
        !caseItem.theme &&
        (!caseItem.initialCodes || caseItem.initialCodes.length === 0) && (
          <div className="no-content">
            <span>No themes or codes generated yet</span>
          </div>
        )}
    </div>
  );
};

export default P3CaseItem;
