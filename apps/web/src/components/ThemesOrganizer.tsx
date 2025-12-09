import React, { useEffect, useState, useRef } from "react";
import "./ThemesOrganizer.css";
import CandidateThemeItem from "./CandidateThemeItem";
import ChangeTracker, { Change as ChangeRecord } from "./ChangeTracker";
import { useThemeHandlers, type ThemeItem } from "../hooks/useThemeHandlers";
import Markdown from "react-markdown";

type ThemeColumnSide = "left" | "right";

interface ThemeGroup {
  name: string;
  candidateThemes: string[];
}

interface ChangeItem extends ChangeRecord {
  details?: Record<string, unknown>;
  reverted: boolean;
}

interface DraggedItem {
  candidateTheme: string;
  fromSide: ThemeColumnSide;
}

interface ThemesOrganizerProps {
  themesData?: ThemeItem[];
  onThemeUpdate?: (
    caseId: string | number,
    field: string,
    value: string | null
  ) => Promise<void> | void;
}

const ThemesOrganizer: React.FC<ThemesOrganizerProps> = ({
  themesData = [],
  onThemeUpdate,
}) => {
  const [allThemes, setAllThemes] = useState<ThemeGroup[]>([]);
  const [selectedLeftTheme, setSelectedLeftTheme] = useState<string | null>(
    null
  );
  const [selectedRightTheme, setSelectedRightTheme] = useState<string | null>(
    null
  );
  const [leftCandidateThemes, setLeftCandidateThemes] = useState<string[]>([]);
  const [rightCandidateThemes, setRightCandidateThemes] = useState<string[]>(
    []
  );
  const [draggedItem, setDraggedItem] = useState<DraggedItem | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<ThemeColumnSide | null>(
    null
  );
  const [addingNewLeft, setAddingNewLeft] = useState<boolean>(false);
  const [addingNewRight, setAddingNewRight] = useState<boolean>(false);
  const [newCandidateLeft, setNewCandidateLeft] = useState<string>("");
  const [newCandidateRight, setNewCandidateRight] = useState<string>("");
  const [changes, setChanges] = useState<ChangeItem[]>([]);

  // Theme editing state
  const [editingThemeLeft, setEditingThemeLeft] = useState<boolean>(false);
  const [editingThemeRight, setEditingThemeRight] = useState<boolean>(false);
  const [editThemeValueLeft, setEditThemeValueLeft] = useState<string>("");
  const [editThemeValueRight, setEditThemeValueRight] = useState<string>("");

  // AI tool execution state
  const [aiToolInput, setAiToolInput] = useState<string>("");
  const [isExecutingTools, setIsExecutingTools] = useState<boolean>(false);
  type LogEntry = {
    type: "thinking" | "planning" | "executing" | "success" | "error" | "info";
    message: string;
    details?: string;
  };
  const [toolExecutionLog, setToolExecutionLog] = useState<LogEntry[]>([]);
  // Pending tool calls awaiting user approval
  type PendingToolCall = {
    name: string;
    args: Record<string, unknown>;
    description: string;
  };
  const [pendingToolCalls, setPendingToolCalls] = useState<PendingToolCall[]>(
    []
  );
  const [aiCommentary, setAiCommentary] = useState<string | null>(null);

  // AI model selection
  const [aiModel, setAiModel] = useState<string>("gemini-3-pro-preview");

  // Conversation history for AI chat
  type ConversationMessage = {
    role: "user" | "assistant";
    content: string;
    toolCalls?: PendingToolCall[];
  };
  const [conversationHistory, setConversationHistory] = useState<
    ConversationMessage[]
  >([]);
  const conversationEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when conversation updates
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationHistory, pendingToolCalls]);

  // Helper function to add a change to the tracker
  const addChange = (change: ChangeRecord) => {
    const changeItem: ChangeItem = {
      ...change,
      details: {},
      reverted: false,
    };
    setChanges((prev) => [changeItem, ...prev.slice(0, 9)]);
  };

  // Helper to create a change record
  const createChange = (
    type: string,
    description: string,
    details: Record<string, unknown> = {}
  ): ChangeRecord => ({
    id: Date.now() + Math.random(),
    type,
    description,
    timestamp: new Date(),
  });

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
  const revertChange = async (changeId: string | number) => {
    const change = changes.find((c) => c.id === changeId);
    if (!change || change.reverted) return;

    try {
      switch (change.type) {
        case "theme":
          if (change.details) {
            await revertThemeMove(
              change.details as {
                candidateTheme: string;
                fromTheme: string;
                toTheme: string;
              }
            );
          }
          break;
        case "candidate_theme":
          if (change.details) {
            await revertCandidateThemeChange(
              change.details as {
                action: "rename" | "delete" | "add";
                candidateTheme: string;
                oldName?: string;
                newName?: string;
                theme: string;
              }
            );
          }
          break;
        case "main_theme":
          if (change.details) {
            await revertMainThemeChange(
              change.details as {
                action: string;
                oldName: string;
                newName: string;
              }
            );
          }
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
            if (change.details) {
              await revertThemeMove(
                change.details as {
                  candidateTheme: string;
                  fromTheme: string;
                  toTheme: string;
                }
              );
            }
            break;
          case "candidate_theme":
            if (change.details) {
              await revertCandidateThemeChange(
                change.details as {
                  action: "rename" | "delete" | "add";
                  candidateTheme: string;
                  oldName?: string;
                  newName?: string;
                  theme: string;
                }
              );
            }
            break;
          case "main_theme":
            if (change.details) {
              await revertMainThemeChange(
                change.details as {
                  action: string;
                  oldName: string;
                  newName: string;
                }
              );
            }
            break;
          default:
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
    const themeMap = new Map<string, Set<string>>();
    const unassignedCandidates = new Set<string>();

    // Group candidate themes by their main theme
    themesData.forEach((item) => {
      if (item.candidate_theme) {
        if (item.theme) {
          // Candidate theme has a final theme assigned
          if (!themeMap.has(item.theme)) {
            themeMap.set(item.theme, new Set());
          }
          themeMap.get(item.theme)!.add(item.candidate_theme);
        } else {
          // Candidate theme without a final theme - add to unassigned
          unassignedCandidates.add(item.candidate_theme);
        }
      }
    });

    // Convert to array format with unique candidate themes
    const themes: ThemeGroup[] = Array.from(themeMap.entries()).map(
      ([theme, candidateSet]) => ({
        name: theme,
        candidateThemes: Array.from(candidateSet) as string[],
      })
    );

    // Add unassigned candidates as a special group if any exist
    if (unassignedCandidates.size > 0) {
      themes.unshift({
        name: "(Unassigned)",
        candidateThemes: Array.from(unassignedCandidates),
      });
    }

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

      const change = createChange(
        "theme",
        `Moved "${candidateTheme}" from "${sourceTheme}" to "${targetTheme}"`
      );
      addChange(change);
      setChanges((prev) =>
        prev.map((c) =>
          c.id === change.id
            ? {
                ...c,
                details: {
                  candidateTheme,
                  fromTheme: sourceTheme,
                  toTheme: targetTheme,
                },
              }
            : c
        )
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

      const change = createChange(
        "candidate_theme",
        `Renamed candidate theme from "${oldName}" to "${newName}"`
      );
      addChange(change);
      setChanges((prev) =>
        prev.map((c) =>
          c.id === change.id
            ? {
                ...c,
                details: {
                  action: "rename",
                  oldName,
                  newName,
                  theme:
                    side === "left" ? selectedLeftTheme : selectedRightTheme,
                },
              }
            : c
        )
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

      const change = createChange(
        "candidate_theme",
        `Deleted candidate theme "${candidateTheme}"`
      );
      addChange(change);
      setChanges((prev) =>
        prev.map((c) =>
          c.id === change.id
            ? {
                ...c,
                details: {
                  action: "delete",
                  candidateTheme,
                  theme:
                    side === "left" ? selectedLeftTheme : selectedRightTheme,
                },
              }
            : c
        )
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

      const change = createChange(
        "candidate_theme",
        `Added new candidate theme "${newCandidate.trim()}" to theme "${targetTheme}"`
      );
      addChange(change);
      setChanges((prev) =>
        prev.map((c) =>
          c.id === change.id
            ? {
                ...c,
                details: {
                  action: "add",
                  candidateTheme: newCandidate.trim(),
                  theme: targetTheme,
                },
              }
            : c
        )
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
  const handleStartThemeEdit = (side: ThemeColumnSide) => {
    const themeName = side === "left" ? selectedLeftTheme : selectedRightTheme;
    if (side === "left") {
      setEditingThemeLeft(true);
      setEditThemeValueLeft(themeName || "");
    } else {
      setEditingThemeRight(true);
      setEditThemeValueRight(themeName || "");
    }
  };

  const handleSaveThemeEdit = async (side: ThemeColumnSide) => {
    const oldThemeName =
      side === "left" ? selectedLeftTheme : selectedRightTheme;
    const newThemeName =
      side === "left" ? editThemeValueLeft : editThemeValueRight;

    if (
      !newThemeName.trim() ||
      newThemeName === oldThemeName ||
      !oldThemeName
    ) {
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
      // For "(Unassigned)", we need to find cases where theme is null/undefined
      const isUnassigned = oldThemeName === "(Unassigned)";
      const casesToUpdate = themesData.filter((item) =>
        isUnassigned
          ? !item.theme && item.candidate_theme
          : item.theme === oldThemeName
      );
      for (const caseItem of casesToUpdate) {
        if (onThemeUpdate) {
          await onThemeUpdate(caseItem.caseId, "theme", newThemeName.trim());
        }
      }

      // Add to change tracker
      const change = createChange(
        "main_theme",
        `Renamed theme from "${oldThemeName}" to "${newThemeName.trim()}"`
      );
      addChange(change);
      setChanges((prev) =>
        prev.map((c) =>
          c.id === change.id
            ? {
                ...c,
                details: {
                  action: "rename",
                  oldName: oldThemeName,
                  newName: newThemeName.trim(),
                },
              }
            : c
        )
      );

      console.log(
        `Renamed theme from "${oldThemeName}" to "${newThemeName.trim()}"`
      );
    } catch (error) {
      console.error("Error updating theme name:", error);
      // Revert local changes on error
      if (oldThemeName) {
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

  // Generate human-readable action description
  const getActionDescription = (
    name: string,
    args: Record<string, unknown>
  ): string => {
    switch (name) {
      case "move_theme":
        return `Move "${args.candidateTheme}" from "${args.fromGroup}" to "${args.toGroup}"`;
      case "merge_themes":
        return `Merge "${args.theme1}" and "${args.theme2}" into "${args.newName}"`;
      case "rename_theme":
        return `Rename "${args.oldName}" to "${args.newName}"`;
      case "create_theme_group":
        return `Create new group "${args.groupName}"`;
      case "delete_theme":
        return `Delete "${args.themeName}"`;
      default:
        return `${name}(${JSON.stringify(args)})`;
    }
  };

  // Execute AI tool request
  const executeAiTools = async () => {
    if (!aiToolInput.trim() || isExecutingTools) return;

    const userMessage = aiToolInput.trim();

    // Add user message to conversation
    setConversationHistory((prev) => [
      ...prev,
      { role: "user", content: userMessage },
    ]);

    setIsExecutingTools(true);
    setToolExecutionLog([{ type: "thinking", message: "Thinking..." }]);
    setPendingToolCalls([]);
    setAiCommentary(null);
    setAiToolInput("");

    try {
      // Build conversation for API
      const messagesForApi = [
        ...conversationHistory,
        { role: "user", content: userMessage },
      ];

      const response = await fetch("/api/ai-theme-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: userMessage,
          model: aiModel,
          themeData: allThemes,
          conversationHistory: messagesForApi,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to execute AI tools");
      }

      // Build pending tool calls if any
      let pending: PendingToolCall[] = [];
      if (result.functionCalls && result.functionCalls.length > 0) {
        pending = result.functionCalls.map(
          (call: { name: string; args: Record<string, unknown> }) => ({
            name: call.name,
            args: call.args,
            description: getActionDescription(call.name, call.args),
          })
        );
        setPendingToolCalls(pending);
      }

      // Add assistant response to conversation
      if (result.textResponse || pending.length > 0) {
        setConversationHistory((prev) => [
          ...prev,
          {
            role: "assistant",
            content: result.textResponse || "",
            toolCalls: pending.length > 0 ? pending : undefined,
          },
        ]);
      }

      setToolExecutionLog([]);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setToolExecutionLog([{ type: "error", message: errorMsg }]);
      // Add error to conversation
      setConversationHistory((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${errorMsg}` },
      ]);
    } finally {
      setIsExecutingTools(false);
    }
  };

  // Clear conversation
  const clearConversation = () => {
    setConversationHistory([]);
    setPendingToolCalls([]);
    setToolExecutionLog([]);
    setAiCommentary(null);
  };

  // Approve and execute a single pending tool call
  const approveSingleCall = async (index: number) => {
    const call = pendingToolCalls[index];
    if (!call) return;

    setIsExecutingTools(true);

    setToolExecutionLog((prev) => [
      ...prev,
      { type: "executing", message: call.description },
    ]);

    try {
      await executeToolCall(call.name, call.args);
      setToolExecutionLog((prev) => [
        ...prev,
        { type: "success", message: "Done" },
      ]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setToolExecutionLog((prev) => [
        ...prev,
        { type: "error", message: errorMsg },
      ]);
    }

    // Remove the executed call from pending
    setPendingToolCalls((prev) => prev.filter((_, i) => i !== index));
    setIsExecutingTools(false);

    // Clear commentary when all calls are done
    if (pendingToolCalls.length === 1) {
      setAiCommentary(null);
    }
  };

  // Reject a single pending tool call
  const rejectSingleCall = (index: number) => {
    setPendingToolCalls((prev) => prev.filter((_, i) => i !== index));

    // Clear commentary when all calls are dismissed
    if (pendingToolCalls.length === 1) {
      setAiCommentary(null);
      setToolExecutionLog([]);
    }
  };

  // Reject all pending tool calls
  const rejectAllCalls = () => {
    setPendingToolCalls([]);
    setAiCommentary(null);
    setToolExecutionLog([]);
  };

  // Execute a single tool call
  const executeToolCall = async (
    name: string,
    args: Record<string, unknown>
  ) => {
    switch (name) {
      case "move_theme": {
        const { candidateTheme, fromGroup, toGroup } = args as {
          candidateTheme: string;
          fromGroup: string;
          toGroup: string;
        };
        await handleSuggestionMove({
          candidateTheme,
          fromTheme: fromGroup,
          toTheme: toGroup,
        });
        const change = createChange(
          "theme",
          `AI moved "${candidateTheme}" from "${fromGroup}" to "${toGroup}"`
        );
        addChange(change);
        break;
      }

      case "merge_themes": {
        const { theme1, theme2, newName } = args as {
          theme1: string;
          theme2: string;
          newName: string;
        };
        await handleSuggestionMergeCandidates({
          candidate1: theme1,
          candidate2: theme2,
          newName,
          theme: selectedLeftTheme || selectedRightTheme || "",
        });
        const change = createChange(
          "candidate_theme",
          `AI merged "${theme1}" and "${theme2}" into "${newName}"`
        );
        addChange(change);
        break;
      }

      case "rename_theme": {
        const { oldName, newName, themeType } = args as {
          oldName: string;
          newName: string;
          themeType: "group" | "candidate";
        };
        if (themeType === "group") {
          await handleSuggestionThemeRename({
            currentName: oldName,
            suggestedName: newName,
          });
          const change = createChange(
            "main_theme",
            `AI renamed theme group "${oldName}" to "${newName}"`
          );
          addChange(change);
        } else {
          const theme = selectedLeftTheme || selectedRightTheme || "";
          await handleSuggestionRename({
            currentName: oldName,
            suggestedName: newName,
            theme,
          });
          const change = createChange(
            "candidate_theme",
            `AI renamed "${oldName}" to "${newName}"`
          );
          addChange(change);
        }
        break;
      }

      case "create_theme_group": {
        const { groupName } = args as { groupName: string };
        await handleSuggestionCreateTheme({
          newThemeName: groupName,
          candidatesToMove: [],
        });
        const change = createChange(
          "main_theme",
          `AI created new theme group "${groupName}"`
        );
        addChange(change);
        break;
      }

      case "delete_theme": {
        const { themeName, themeType } = args as {
          themeName: string;
          themeType: "group" | "candidate";
        };
        if (themeType === "candidate") {
          const theme = selectedLeftTheme || selectedRightTheme || "";
          await handleSuggestionDelete({ candidateTheme: themeName, theme });
          const change = createChange(
            "candidate_theme",
            `AI deleted candidate theme "${themeName}"`
          );
          addChange(change);
        } else {
          // For group deletion, we'd need to implement this
          console.warn("Group deletion not implemented yet");
        }
        break;
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  };

  return (
    <div className="themes-organizer-dual">
      <div className="organizer-header">
        <div>
          <h4>Theme Organization</h4>
          <p>
            Select themes and drag candidate themes between columns to
            reorganize
          </p>
        </div>

        {/* AI Chat Section */}
        <div
          className="ai-chat-section"
          style={{
            marginTop: 16,
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-m)",
            overflow: "hidden",
          }}
        >
          {/* Conversation History */}
          <div
            style={{
              maxHeight: 300,
              overflowY: "auto",
              padding: conversationHistory.length > 0 ? 16 : 0,
              background: "var(--surface-1)",
            }}
          >
            {conversationHistory.map((msg, index) => (
              <div
                key={index}
                style={{
                  marginBottom: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {msg.role === "user" ? (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                    }}
                  >
                    <div
                      style={{
                        background: "var(--primary-100)",
                        color: "var(--primary-700)",
                        padding: "10px 14px",
                        borderRadius: "var(--radius-m)",
                        maxWidth: "85%",
                        fontSize: 14,
                      }}
                    >
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 10 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "var(--surface-2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        flexShrink: 0,
                      }}
                    >
                      🤖
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {msg.content && (
                        <div
                          className="ai-message-content"
                          style={{
                            fontSize: 14,
                            lineHeight: 1.6,
                          }}
                        >
                          <Markdown>{msg.content}</Markdown>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Thinking indicator */}
            {isExecutingTools && toolExecutionLog.length > 0 && (
              <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "var(--surface-2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                  }}
                >
                  🤖
                </div>
                <div
                  style={{
                    color: "var(--text-muted)",
                    fontSize: 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      animation: "pulse 1.5s ease-in-out infinite",
                    }}
                  >
                    💭
                  </span>
                  Thinking...
                </div>
              </div>
            )}

            {/* Execution Log (for action status) */}
            {toolExecutionLog.some(
              (e) => e.type === "executing" || e.type === "success"
            ) && (
              <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                <div style={{ width: 28 }} />
                <div
                  style={{
                    fontSize: 13,
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  {toolExecutionLog
                    .filter(
                      (e) =>
                        e.type === "executing" ||
                        e.type === "success" ||
                        e.type === "error"
                    )
                    .map((entry, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          color:
                            entry.type === "success"
                              ? "var(--success-500)"
                              : entry.type === "error"
                              ? "var(--danger-500)"
                              : "var(--text-muted)",
                        }}
                      >
                        <span>
                          {entry.type === "executing"
                            ? "⚡"
                            : entry.type === "success"
                            ? "✓"
                            : "✗"}
                        </span>
                        <span>{entry.message}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div ref={conversationEndRef} />
          </div>

          {/* Pending Actions */}
          {pendingToolCalls.length > 0 && (
            <div
              style={{
                padding: 16,
                background: "var(--surface-2)",
                borderTop: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  fontWeight: 500,
                  marginBottom: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 13,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span>📋</span>
                  <span>
                    {pendingToolCalls.length}{" "}
                    {pendingToolCalls.length === 1
                      ? "action pending"
                      : "actions pending"}
                  </span>
                </div>
                {pendingToolCalls.length > 1 && (
                  <button
                    onClick={rejectAllCalls}
                    disabled={isExecutingTools}
                    className="btn"
                    style={{
                      padding: "4px 8px",
                      fontSize: 12,
                      background: "transparent",
                      border: "none",
                      color: "var(--text-muted)",
                    }}
                  >
                    Dismiss all
                  </button>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {pendingToolCalls.map((call, index) => (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 12px",
                      background: "var(--surface-1)",
                      borderRadius: "var(--radius-s)",
                      fontSize: 13,
                    }}
                  >
                    <span style={{ flex: 1 }}>{call.description}</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => approveSingleCall(index)}
                        disabled={isExecutingTools}
                        className="btn primary"
                        style={{
                          padding: "4px 12px",
                          fontSize: 12,
                        }}
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => rejectSingleCall(index)}
                        disabled={isExecutingTools}
                        className="btn"
                        style={{
                          padding: "4px 12px",
                          fontSize: 12,
                          background: "var(--surface-2)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        ✗
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div
            style={{
              padding: 12,
              background: "var(--surface-2)",
              borderTop:
                pendingToolCalls.length === 0
                  ? "1px solid var(--border)"
                  : "none",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {/* Model Selector Row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
              }}
            >
              <span style={{ color: "var(--text-muted)" }}>Model:</span>
              <select
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                disabled={isExecutingTools}
                style={{
                  padding: "4px 8px",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-s)",
                  background: "var(--surface-1)",
                  color: "var(--text)",
                  fontSize: 12,
                }}
              >
                <option value="gemini-3-pro-preview">
                  Gemini 3 Pro Preview
                </option>
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                <option value="claude-sonnet-4-5-20250929">
                  Claude Sonnet 4.5
                </option>
                <option value="claude-haiku-4-5-20251015">
                  Claude Haiku 4.5
                </option>
                <option value="claude-sonnet-4-20250514">
                  Claude Sonnet 4
                </option>
              </select>
            </div>

            {/* Input Row */}
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={aiToolInput}
                onChange={(e) => setAiToolInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !e.shiftKey && executeAiTools()
                }
                placeholder={
                  conversationHistory.length === 0
                    ? "Ask AI to help organize themes..."
                    : "Reply to continue the conversation..."
                }
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-m)",
                  background: "var(--surface-1)",
                  color: "var(--text)",
                  fontSize: 14,
                }}
                disabled={isExecutingTools}
              />
              <button
                onClick={executeAiTools}
                disabled={isExecutingTools || !aiToolInput.trim()}
                className="btn primary"
                style={{ padding: "10px 16px" }}
              >
                {isExecutingTools ? "..." : "Send"}
              </button>
              {conversationHistory.length > 0 && (
                <button
                  onClick={clearConversation}
                  disabled={isExecutingTools}
                  className="btn"
                  title="Clear conversation"
                  style={{
                    padding: "10px 12px",
                    background: "var(--surface-1)",
                    border: "1px solid var(--border)",
                  }}
                >
                  🗑️
                </button>
              )}
            </div>
          </div>
        </div>
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
                      Edit
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
                      Edit
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
    </div>
  );
};

export default ThemesOrganizer;
