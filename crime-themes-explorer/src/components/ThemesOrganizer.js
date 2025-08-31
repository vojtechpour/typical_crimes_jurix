import React, { useState, useEffect } from "react";
import "./ThemesOrganizer.css";
import CandidateThemeItem from "./CandidateThemeItem";
import ChangeTracker from "./ChangeTracker";
import AiAssistant from "./AiAssistant";
import { generateAiSuggestions } from "../utils/aiUtils";
import { useThemeHandlers } from "../hooks/useThemeHandlers";

const ThemesOrganizer = ({ themesData = [], onThemeUpdate }) => {
  const [allThemes, setAllThemes] = useState([]);
  const [selectedLeftTheme, setSelectedLeftTheme] = useState(null);
  const [selectedRightTheme, setSelectedRightTheme] = useState(null);
  const [leftCandidateThemes, setLeftCandidateThemes] = useState([]);
  const [rightCandidateThemes, setRightCandidateThemes] = useState([]);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverTarget, setDragOverTarget] = useState(null);
  const [addingNewLeft, setAddingNewLeft] = useState(false);
  const [addingNewRight, setAddingNewRight] = useState(false);
  const [newCandidateLeft, setNewCandidateLeft] = useState("");
  const [newCandidateRight, setNewCandidateRight] = useState("");
  const [changes, setChanges] = useState([]);

  // Theme editing state
  const [editingThemeLeft, setEditingThemeLeft] = useState(false);
  const [editingThemeRight, setEditingThemeRight] = useState(false);
  const [editThemeValueLeft, setEditThemeValueLeft] = useState("");
  const [editThemeValueRight, setEditThemeValueRight] = useState("");

  // AI Assistant state
  const [aiInstructions, setAiInstructions] = useState("");
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [showAiSuggestions, setShowAiSuggestions] = useState(false);

  // Helper function to add a change to the tracker
  const addChange = (type, description, details = {}) => {
    const change = {
      id: Date.now() + Math.random(),
      type,
      description,
      timestamp: new Date(),
      details,
      reverted: false,
    };
    setChanges((prev) => [change, ...prev.slice(0, 9)]); // Keep last 10 changes
  };

  // Use the custom hook for theme handlers
  const {
    revertThemeMove,
    revertCandidateThemeChange,
    revertMainThemeChange,
    handleSuggestionMove,
    handleSuggestionMoveMultiple,
    handleSuggestionRename,
    handleSuggestionThemeRename,
    handleSuggestionAdd,
    handleSuggestionDelete,
    handleSuggestionCreateTheme,
    handleSuggestionMergeThemes,
    handleSuggestionMergeCandidates,
  } = useThemeHandlers({
    themesData,
    onThemeUpdate,
    selectedLeftTheme,
    selectedRightTheme,
    setLeftCandidateThemes,
    setRightCandidateThemes,
    setAllThemes,
    setSelectedLeftTheme,
    setSelectedRightTheme,
    addChange,
  });

  // Function to revert a specific change
  const revertChange = async (changeId) => {
    const change = changes.find((c) => c.id === changeId);
    if (!change || change.reverted) return;

    try {
      switch (change.type) {
        case "theme":
          await revertThemeMove(change.details);
          break;
        case "candidate_theme":
          await revertCandidateThemeChange(change.details);
          break;
        case "main_theme":
          await revertMainThemeChange(change.details);
          break;
        default:
          console.log("Unknown change type");
          return;
      }

      // Mark the change as reverted
      setChanges((prev) =>
        prev.map((c) => (c.id === changeId ? { ...c, reverted: true } : c))
      );
    } catch (error) {
      console.error("Error reverting change:", error);
    }
  };

  // Function to revert all changes
  const revertAllChanges = async () => {
    const nonRevertedChanges = changes.filter((c) => !c.reverted);

    if (nonRevertedChanges.length === 0) return;

    if (
      !window.confirm(
        `Are you sure you want to revert all ${nonRevertedChanges.length} changes? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      // Revert changes in reverse chronological order (oldest first) to avoid conflicts
      const sortedChanges = [...nonRevertedChanges].reverse();

      for (const change of sortedChanges) {
        switch (change.type) {
          case "theme":
            await revertThemeMove(change.details);
            break;
          case "candidate_theme":
            await revertCandidateThemeChange(change.details);
            break;
          case "main_theme":
            await revertMainThemeChange(change.details);
            break;
        }
      }

      // Mark all changes as reverted
      setChanges((prev) => prev.map((c) => ({ ...c, reverted: true })));

      console.log(`Reverted ${nonRevertedChanges.length} changes`);
    } catch (error) {
      console.error("Error reverting all changes:", error);
      alert(
        "An error occurred while reverting changes. Some changes may not have been reverted."
      );
    }
  };

  // Initialize themes from data
  useEffect(() => {
    const themeMap = new Map();

    // Group candidate themes by their main theme
    themesData.forEach((item) => {
      if (item.theme && item.candidate_theme) {
        if (!themeMap.has(item.theme)) {
          themeMap.set(item.theme, new Set());
        }
        themeMap.get(item.theme).add(item.candidate_theme);
      }
    });

    // Convert to array format with unique candidate themes
    const themes = Array.from(themeMap.entries()).map(
      ([theme, candidateSet]) => ({
        name: theme,
        candidateThemes: Array.from(candidateSet), // Convert Set to Array for uniqueness
      })
    );

    setAllThemes(themes);

    // Preserve current selections if they still exist, otherwise auto-select
    const leftThemeExists = themes.find((t) => t.name === selectedLeftTheme);
    const rightThemeExists = themes.find((t) => t.name === selectedRightTheme);

    if (leftThemeExists) {
      setLeftCandidateThemes([...leftThemeExists.candidateThemes]);
    } else if (themes.length > 0) {
      setSelectedLeftTheme(themes[0].name);
      setLeftCandidateThemes([...themes[0].candidateThemes]);
    }

    if (rightThemeExists) {
      setRightCandidateThemes([...rightThemeExists.candidateThemes]);
    } else if (themes.length > 1) {
      setSelectedRightTheme(themes[1].name);
      setRightCandidateThemes([...themes[1].candidateThemes]);
    }
  }, [themesData, selectedLeftTheme, selectedRightTheme]);

  const handleThemeSelection = (side, themeName) => {
    const theme = allThemes.find((t) => t.name === themeName);
    if (!theme) return;

    if (side === "left") {
      setSelectedLeftTheme(themeName);
      setLeftCandidateThemes([...theme.candidateThemes]);
    } else {
      setSelectedRightTheme(themeName);
      setRightCandidateThemes([...theme.candidateThemes]);
    }
  };

  const handleDragStart = (e, candidateTheme, fromSide) => {
    setDraggedItem({ candidateTheme, fromSide });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", candidateTheme);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragEnter = (e, targetSide) => {
    e.preventDefault();
    if (draggedItem && draggedItem.fromSide !== targetSide) {
      setDragOverTarget(targetSide);
    }
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverTarget(null);
    }
  };

  const handleDrop = async (e, targetSide) => {
    e.preventDefault();

    if (!draggedItem || draggedItem.fromSide === targetSide) {
      setDragOverTarget(null);
      setDraggedItem(null);
      return;
    }

    const { candidateTheme, fromSide } = draggedItem;
    const targetTheme =
      targetSide === "left" ? selectedLeftTheme : selectedRightTheme;
    const sourceTheme =
      fromSide === "left" ? selectedLeftTheme : selectedRightTheme;

    // Update local state immediately
    if (fromSide === "left") {
      setLeftCandidateThemes((prev) =>
        prev.filter((ct) => ct !== candidateTheme)
      );
      setRightCandidateThemes((prev) => [...prev, candidateTheme]);
    } else {
      setRightCandidateThemes((prev) =>
        prev.filter((ct) => ct !== candidateTheme)
      );
      setLeftCandidateThemes((prev) => [...prev, candidateTheme]);
    }

    // Clear drag state immediately
    setDraggedItem(null);
    setDragOverTarget(null);

    // Update backend - find all cases with this candidate theme and update their theme
    try {
      const casesToUpdate = themesData.filter(
        (item) => item.candidate_theme === candidateTheme
      );

      for (const caseItem of casesToUpdate) {
        if (onThemeUpdate) {
          await onThemeUpdate(caseItem.caseId, "theme", targetTheme);
        }
      }

      console.log(
        `Moved "${candidateTheme}" from "${sourceTheme}" to "${targetTheme}"`
      );

      addChange(
        "theme",
        `Moved "${candidateTheme}" from "${sourceTheme}" to "${targetTheme}"`,
        {
          candidateTheme,
          fromTheme: sourceTheme,
          toTheme: targetTheme,
        }
      );
    } catch (error) {
      console.error("Error updating theme assignments:", error);
      // Revert local changes on error
      if (fromSide === "left") {
        setLeftCandidateThemes((prev) => [...prev, candidateTheme]);
        setRightCandidateThemes((prev) =>
          prev.filter((ct) => ct !== candidateTheme)
        );
      } else {
        setRightCandidateThemes((prev) => [...prev, candidateTheme]);
        setLeftCandidateThemes((prev) =>
          prev.filter((ct) => ct !== candidateTheme)
        );
      }
    }
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverTarget(null);
  };

  const handleEditCandidateTheme = async (oldName, newName, side) => {
    try {
      // Update local state
      if (side === "left") {
        setLeftCandidateThemes((prev) =>
          prev.map((ct) => (ct === oldName ? newName : ct))
        );
      } else {
        setRightCandidateThemes((prev) =>
          prev.map((ct) => (ct === oldName ? newName : ct))
        );
      }

      // Update backend - find all cases with this candidate theme and update
      const casesToUpdate = themesData.filter(
        (item) => item.candidate_theme === oldName
      );

      for (const caseItem of casesToUpdate) {
        if (onThemeUpdate) {
          await onThemeUpdate(caseItem.caseId, "candidate_theme", newName);
        }
      }

      console.log(`Renamed candidate theme from "${oldName}" to "${newName}"`);

      addChange(
        "candidate_theme",
        `Renamed candidate theme from "${oldName}" to "${newName}"`,
        {
          action: "rename",
          oldName,
          newName,
          theme: side === "left" ? selectedLeftTheme : selectedRightTheme,
        }
      );
    } catch (error) {
      console.error("Error updating candidate theme name:", error);
      // Revert on error
      if (side === "left") {
        setLeftCandidateThemes((prev) =>
          prev.map((ct) => (ct === newName ? oldName : ct))
        );
      } else {
        setRightCandidateThemes((prev) =>
          prev.map((ct) => (ct === newName ? oldName : ct))
        );
      }
    }
  };

  const handleDeleteCandidateTheme = async (candidateTheme, side) => {
    if (
      !window.confirm(`Are you sure you want to delete "${candidateTheme}"?`)
    ) {
      return;
    }

    try {
      // Update local state
      if (side === "left") {
        setLeftCandidateThemes((prev) =>
          prev.filter((ct) => ct !== candidateTheme)
        );
      } else {
        setRightCandidateThemes((prev) =>
          prev.filter((ct) => ct !== candidateTheme)
        );
      }

      // Update backend - find all cases with this candidate theme and remove it
      const casesToUpdate = themesData.filter(
        (item) => item.candidate_theme === candidateTheme
      );

      for (const caseItem of casesToUpdate) {
        if (onThemeUpdate) {
          await onThemeUpdate(caseItem.caseId, "candidate_theme", null);
        }
      }

      console.log(`Deleted candidate theme "${candidateTheme}"`);

      addChange(
        "candidate_theme",
        `Deleted candidate theme "${candidateTheme}"`,
        {
          action: "delete",
          candidateTheme,
          theme: side === "left" ? selectedLeftTheme : selectedRightTheme,
        }
      );
    } catch (error) {
      console.error("Error deleting candidate theme:", error);
      // Revert on error
      if (side === "left") {
        setLeftCandidateThemes((prev) => [...prev, candidateTheme]);
      } else {
        setRightCandidateThemes((prev) => [...prev, candidateTheme]);
      }
    }
  };

  const handleAddNewCandidate = (side) => {
    if (side === "left") {
      setAddingNewLeft(true);
      setNewCandidateLeft("");
    } else {
      setAddingNewRight(true);
      setNewCandidateRight("");
    }
  };

  const handleSaveNewCandidate = async (side) => {
    const newCandidate = side === "left" ? newCandidateLeft : newCandidateRight;
    const targetTheme =
      side === "left" ? selectedLeftTheme : selectedRightTheme;

    if (!newCandidate.trim()) {
      handleCancelNewCandidate(side);
      return;
    }

    try {
      // Update local state
      if (side === "left") {
        setLeftCandidateThemes((prev) => [...prev, newCandidate.trim()]);
        setAddingNewLeft(false);
        setNewCandidateLeft("");
      } else {
        setRightCandidateThemes((prev) => [...prev, newCandidate.trim()]);
        setAddingNewRight(false);
        setNewCandidateRight("");
      }

      console.log(
        `Added new candidate theme "${newCandidate.trim()}" to theme "${targetTheme}"`
      );

      addChange(
        "candidate_theme",
        `Added new candidate theme "${newCandidate.trim()}" to theme "${targetTheme}"`,
        {
          action: "add",
          candidateTheme: newCandidate.trim(),
          theme: targetTheme,
        }
      );
    } catch (error) {
      console.error("Error adding new candidate theme:", error);
      // Revert on error
      if (side === "left") {
        setLeftCandidateThemes((prev) =>
          prev.filter((ct) => ct !== newCandidate.trim())
        );
        setAddingNewLeft(false);
      } else {
        setRightCandidateThemes((prev) =>
          prev.filter((ct) => ct !== newCandidate.trim())
        );
        setAddingNewRight(false);
      }
    }
  };

  const handleCancelNewCandidate = (side) => {
    if (side === "left") {
      setAddingNewLeft(false);
      setNewCandidateLeft("");
    } else {
      setAddingNewRight(false);
      setNewCandidateRight("");
    }
  };

  const handleNewCandidateKeyPress = (e, side) => {
    if (e.key === "Enter") {
      handleSaveNewCandidate(side);
    } else if (e.key === "Escape") {
      handleCancelNewCandidate(side);
    }
  };

  // Theme editing functions
  const handleStartThemeEdit = (side) => {
    const themeName = side === "left" ? selectedLeftTheme : selectedRightTheme;
    if (side === "left") {
      setEditingThemeLeft(true);
      setEditThemeValueLeft(themeName);
    } else {
      setEditingThemeRight(true);
      setEditThemeValueRight(themeName);
    }
  };

  const handleSaveThemeEdit = async (side) => {
    const oldThemeName =
      side === "left" ? selectedLeftTheme : selectedRightTheme;
    const newThemeName =
      side === "left" ? editThemeValueLeft : editThemeValueRight;

    if (!newThemeName.trim() || newThemeName === oldThemeName) {
      handleCancelThemeEdit(side);
      return;
    }

    try {
      // Update local state
      setAllThemes((prev) =>
        prev.map((theme) =>
          theme.name === oldThemeName
            ? { ...theme, name: newThemeName.trim() }
            : theme
        )
      );

      // Update selected theme
      if (side === "left") {
        setSelectedLeftTheme(newThemeName.trim());
        setEditingThemeLeft(false);
        setEditThemeValueLeft("");
      } else {
        setSelectedRightTheme(newThemeName.trim());
        setEditingThemeRight(false);
        setEditThemeValueRight("");
      }

      // Update backend - find all cases with this theme and update
      const casesToUpdate = themesData.filter(
        (item) => item.theme === oldThemeName
      );
      for (const caseItem of casesToUpdate) {
        if (onThemeUpdate) {
          await onThemeUpdate(caseItem.caseId, "theme", newThemeName.trim());
        }
      }

      // Add to change tracker
      addChange(
        "main_theme",
        `Renamed theme from "${oldThemeName}" to "${newThemeName.trim()}"`,
        {
          action: "rename",
          oldName: oldThemeName,
          newName: newThemeName.trim(),
        }
      );

      console.log(
        `Renamed theme from "${oldThemeName}" to "${newThemeName.trim()}"`
      );
    } catch (error) {
      console.error("Error updating theme name:", error);
      // Revert local changes on error
      setAllThemes((prev) =>
        prev.map((theme) =>
          theme.name === newThemeName.trim()
            ? { ...theme, name: oldThemeName }
            : theme
        )
      );
      if (side === "left") {
        setSelectedLeftTheme(oldThemeName);
      } else {
        setSelectedRightTheme(oldThemeName);
      }
    }
  };

  const handleCancelThemeEdit = (side) => {
    if (side === "left") {
      setEditingThemeLeft(false);
      setEditThemeValueLeft("");
    } else {
      setEditingThemeRight(false);
      setEditThemeValueRight("");
    }
  };

  const handleThemeEditKeyPress = (e, side) => {
    if (e.key === "Enter") {
      handleSaveThemeEdit(side);
    } else if (e.key === "Escape") {
      handleCancelThemeEdit(side);
    }
  };

  // AI Assistant functions
  const handleAiAnalysis = async (followUpQuestion = null) => {
    const instructionsToUse = followUpQuestion || aiInstructions;
    const isFollowUp = followUpQuestion !== null;

    if (!instructionsToUse.trim()) {
      alert(
        "Please provide instructions describing what you want to achieve with your theme organization."
      );
      return;
    }

    setIsAiProcessing(true);

    // Only hide suggestions for initial analysis, not for follow-ups
    if (!isFollowUp) {
      setShowAiSuggestions(false);
    }

    try {
      // Prepare the context for AI analysis
      const changesContext = changes
        .filter((c) => !c.reverted)
        .map((c) => ({
          type: c.type,
          description: c.description,
          timestamp: c.timestamp.toISOString(),
          details: c.details,
        }));

      const currentThemes = allThemes.map((theme) => ({
        name: theme.name,
        candidateThemes: theme.candidateThemes,
      }));

      // Get AI suggestions based on instructions and/or changes
      const newSuggestions = await generateAiSuggestions(
        changesContext,
        currentThemes,
        instructionsToUse
      );

      if (isFollowUp) {
        // Append follow-up responses to existing suggestions
        setAiSuggestions((prev) => [...(prev || []), ...newSuggestions]);
      } else {
        // Replace suggestions for initial analysis
        setAiSuggestions(newSuggestions);
      }

      setShowAiSuggestions(true);
    } catch (error) {
      console.error("Error getting AI suggestions:", error);
      alert("Failed to get AI suggestions. Please try again.");
    } finally {
      setIsAiProcessing(false);
    }
  };

  // Apply a specific AI suggestion
  const applySuggestion = async (suggestion) => {
    try {
      switch (suggestion.action.type) {
        case "move_candidate":
          await handleSuggestionMove(suggestion.action);
          break;
        case "move_multiple_candidates":
          await handleSuggestionMoveMultiple(suggestion.action);
          break;
        case "rename_candidate":
          await handleSuggestionRename(suggestion.action);
          break;
        case "rename_theme":
          await handleSuggestionThemeRename(suggestion.action);
          break;
        case "add_candidate":
          await handleSuggestionAdd(suggestion.action);
          break;
        case "delete_candidate":
          await handleSuggestionDelete(suggestion.action);
          break;
        case "create_theme":
          await handleSuggestionCreateTheme(suggestion.action);
          break;
        case "merge_themes":
          await handleSuggestionMergeThemes(suggestion.action);
          break;
        case "merge_candidates":
          await handleSuggestionMergeCandidates(suggestion.action);
          break;
        default:
          console.log("Unknown suggestion type:", suggestion.action.type);
          return;
      }

      // Remove the applied suggestion from the list
      setAiSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));

      // Add to change tracker
      addChange("ai_suggestion", `Applied AI suggestion: ${suggestion.title}`, {
        action: "ai_applied",
        suggestion: suggestion,
      });
    } catch (error) {
      console.error("Error applying suggestion:", error);
      alert("Failed to apply suggestion. Please try again.");
    }
  };

  // Reject a suggestion
  const rejectSuggestion = (suggestion) => {
    setAiSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
    addChange("ai_suggestion", `Rejected AI suggestion: ${suggestion.title}`, {
      action: "ai_rejected",
      suggestion: suggestion,
    });
  };

  return (
    <div className="themes-organizer-dual">
      <div className="organizer-header">
        <h4>🗂️ Theme Organization</h4>
        <p>
          Select themes and drag candidate themes between columns to reorganize
        </p>
      </div>

      <div className="dual-column-layout">
        {/* Left Column */}
        <div className="theme-column">
          <div className="column-header">
            <select
              value={selectedLeftTheme || ""}
              onChange={(e) => handleThemeSelection("left", e.target.value)}
              className="theme-selector"
            >
              <option value="">Select a theme...</option>
              {allThemes.map((theme) => (
                <option key={theme.name} value={theme.name}>
                  {theme.name} ({theme.candidateThemes.length})
                </option>
              ))}
            </select>
          </div>

          {selectedLeftTheme && (
            <div
              className={`candidate-themes-area ${
                dragOverTarget === "left" ? "drag-over" : ""
              }`}
              onDragOver={handleDragOver}
              onDragEnter={(e) => handleDragEnter(e, "left")}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, "left")}
            >
              <div className="area-header">
                {editingThemeLeft ? (
                  <div className="theme-edit-container">
                    <input
                      type="text"
                      value={editThemeValueLeft}
                      onChange={(e) => setEditThemeValueLeft(e.target.value)}
                      onKeyDown={(e) => handleThemeEditKeyPress(e, "left")}
                      onBlur={() => handleSaveThemeEdit("left")}
                      className="theme-edit-input"
                      autoFocus
                    />
                    <div className="theme-edit-actions">
                      <button
                        onClick={() => handleSaveThemeEdit("left")}
                        className="theme-save-btn"
                        title="Save"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => handleCancelThemeEdit("left")}
                        className="theme-cancel-btn"
                        title="Cancel"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="theme-name">{selectedLeftTheme}</span>
                    <span className="candidate-count">
                      ({leftCandidateThemes.length})
                    </span>
                    <button
                      onClick={() => handleStartThemeEdit("left")}
                      className="theme-edit-btn"
                      title="Edit theme name"
                    >
                      ✏️
                    </button>
                  </>
                )}
              </div>

              <div className="candidate-list">
                {leftCandidateThemes.map((candidateTheme) => (
                  <CandidateThemeItem
                    key={candidateTheme}
                    candidateTheme={candidateTheme}
                    side="left"
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onEdit={handleEditCandidateTheme}
                    onDelete={handleDeleteCandidateTheme}
                    isDragging={draggedItem?.candidateTheme === candidateTheme}
                  />
                ))}

                {leftCandidateThemes.length === 0 && (
                  <div className="empty-state">
                    No candidate themes in this theme
                  </div>
                )}

                {/* Add New Candidate Theme */}
                {addingNewLeft ? (
                  <div className="add-candidate-form">
                    <input
                      type="text"
                      value={newCandidateLeft}
                      onChange={(e) => setNewCandidateLeft(e.target.value)}
                      onKeyDown={(e) => handleNewCandidateKeyPress(e, "left")}
                      placeholder="Enter new candidate theme..."
                      className="add-candidate-input"
                      autoFocus
                    />
                    <div className="add-candidate-actions">
                      <button
                        onClick={() => handleSaveNewCandidate("left")}
                        className="save-candidate-btn"
                        title="Save"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => handleCancelNewCandidate("left")}
                        className="cancel-candidate-btn"
                        title="Cancel"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => handleAddNewCandidate("left")}
                    className="add-candidate-btn"
                  >
                    + Add New Candidate Theme
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="theme-column">
          <div className="column-header">
            <select
              value={selectedRightTheme || ""}
              onChange={(e) => handleThemeSelection("right", e.target.value)}
              className="theme-selector"
            >
              <option value="">Select a theme...</option>
              {allThemes.map((theme) => (
                <option key={theme.name} value={theme.name}>
                  {theme.name} ({theme.candidateThemes.length})
                </option>
              ))}
            </select>
          </div>

          {selectedRightTheme && (
            <div
              className={`candidate-themes-area ${
                dragOverTarget === "right" ? "drag-over" : ""
              }`}
              onDragOver={handleDragOver}
              onDragEnter={(e) => handleDragEnter(e, "right")}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, "right")}
            >
              <div className="area-header">
                {editingThemeRight ? (
                  <div className="theme-edit-container">
                    <input
                      type="text"
                      value={editThemeValueRight}
                      onChange={(e) => setEditThemeValueRight(e.target.value)}
                      onKeyDown={(e) => handleThemeEditKeyPress(e, "right")}
                      onBlur={() => handleSaveThemeEdit("right")}
                      className="theme-edit-input"
                      autoFocus
                    />
                    <div className="theme-edit-actions">
                      <button
                        onClick={() => handleSaveThemeEdit("right")}
                        className="theme-save-btn"
                        title="Save"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => handleCancelThemeEdit("right")}
                        className="theme-cancel-btn"
                        title="Cancel"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="theme-name">{selectedRightTheme}</span>
                    <span className="candidate-count">
                      ({rightCandidateThemes.length})
                    </span>
                    <button
                      onClick={() => handleStartThemeEdit("right")}
                      className="theme-edit-btn"
                      title="Edit theme name"
                    >
                      ✏️
                    </button>
                  </>
                )}
              </div>

              <div className="candidate-list">
                {rightCandidateThemes.map((candidateTheme) => (
                  <CandidateThemeItem
                    key={candidateTheme}
                    candidateTheme={candidateTheme}
                    side="right"
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onEdit={handleEditCandidateTheme}
                    onDelete={handleDeleteCandidateTheme}
                    isDragging={draggedItem?.candidateTheme === candidateTheme}
                  />
                ))}

                {rightCandidateThemes.length === 0 && (
                  <div className="empty-state">
                    No candidate themes in this theme
                  </div>
                )}

                {/* Add New Candidate Theme */}
                {addingNewRight ? (
                  <div className="add-candidate-form">
                    <input
                      type="text"
                      value={newCandidateRight}
                      onChange={(e) => setNewCandidateRight(e.target.value)}
                      onKeyDown={(e) => handleNewCandidateKeyPress(e, "right")}
                      placeholder="Enter new candidate theme..."
                      className="add-candidate-input"
                      autoFocus
                    />
                    <div className="add-candidate-actions">
                      <button
                        onClick={() => handleSaveNewCandidate("right")}
                        className="save-candidate-btn"
                        title="Save"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => handleCancelNewCandidate("right")}
                        className="cancel-candidate-btn"
                        title="Cancel"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => handleAddNewCandidate("right")}
                    className="add-candidate-btn"
                  >
                    + Add New Candidate Theme
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Change Tracker */}
      <ChangeTracker
        changes={changes}
        onClearChanges={() => setChanges([])}
        onRevertChange={revertChange}
        onRevertAllChanges={revertAllChanges}
      />

      {/* AI Assistant */}
      <AiAssistant
        instructions={aiInstructions}
        onInstructionsChange={setAiInstructions}
        onAnalyze={handleAiAnalysis}
        isProcessing={isAiProcessing}
        suggestions={aiSuggestions}
        showSuggestions={showAiSuggestions}
        onApplySuggestion={applySuggestion}
        onRejectSuggestion={rejectSuggestion}
        changesCount={changes.filter((c) => !c.reverted).length}
      />
    </div>
  );
};

export default ThemesOrganizer;
