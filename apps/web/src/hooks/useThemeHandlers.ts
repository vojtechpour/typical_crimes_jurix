import { useCallback } from "react";

export interface ThemeItem {
  caseId: string | number;
  candidate_theme?: string | null;
  theme?: string | null;
}

export interface UseThemeHandlersParams {
  themesData: ThemeItem[];
  onThemeUpdate?: (caseId: string | number, field: string, value: any) => Promise<void> | void;
  selectedLeftTheme: string | null;
  selectedRightTheme: string | null;
  setLeftCandidateThemes: React.Dispatch<React.SetStateAction<string[]>>;
  setRightCandidateThemes: React.Dispatch<React.SetStateAction<string[]>>;
  setAllThemes: React.Dispatch<React.SetStateAction<any[]>>;
  setSelectedLeftTheme: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedRightTheme: React.Dispatch<React.SetStateAction<string | null>>;
  addChange?: (change: any) => void;
}

export const useThemeHandlers = ({
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
}: UseThemeHandlersParams) => {
  // Revert theme move
  const revertThemeMove = useCallback(
    async ({ candidateTheme, fromTheme, toTheme }: { candidateTheme: string; fromTheme: string; toTheme: string }) => {
      // Update local state - move back from toTheme to fromTheme
      if (selectedLeftTheme === toTheme) {
        setLeftCandidateThemes((prev) => prev.filter((ct) => ct !== candidateTheme));
      } else if (selectedRightTheme === toTheme) {
        setRightCandidateThemes((prev) => prev.filter((ct) => ct !== candidateTheme));
      }

      if (selectedLeftTheme === fromTheme) {
        setLeftCandidateThemes((prev) => [...prev, candidateTheme]);
      } else if (selectedRightTheme === fromTheme) {
        setRightCandidateThemes((prev) => [...prev, candidateTheme]);
      }

      // Update backend
      const casesToUpdate = themesData.filter((item) => item.candidate_theme === candidateTheme);
      for (const caseItem of casesToUpdate) {
        if (onThemeUpdate) {
          await onThemeUpdate(caseItem.caseId, "theme", fromTheme);
        }
      }
    },
    [
      selectedLeftTheme,
      selectedRightTheme,
      themesData,
      onThemeUpdate,
      setLeftCandidateThemes,
      setRightCandidateThemes,
    ]
  );

  // Revert candidate theme changes (rename, delete, add)
  const revertCandidateThemeChange = useCallback(
    async ({ action, candidateTheme, oldName, newName, theme }: { action: "rename" | "delete" | "add"; candidateTheme: string; oldName?: string; newName?: string; theme: string }) => {
      switch (action) {
        case "rename":
          // Rename back from newName to oldName
          if (selectedLeftTheme === theme) {
            setLeftCandidateThemes((prev) => prev.map((ct) => (ct === newName ? (oldName as string) : ct)));
          } else if (selectedRightTheme === theme) {
            setRightCandidateThemes((prev) => prev.map((ct) => (ct === newName ? (oldName as string) : ct)));
          }

          // Update backend
          const casesToUpdate = themesData.filter((item) => item.candidate_theme === newName);
          for (const caseItem of casesToUpdate) {
            if (onThemeUpdate) {
              await onThemeUpdate(caseItem.caseId, "candidate_theme", oldName);
            }
          }
          break;

        case "delete":
          // Re-add the deleted candidate theme
          if (selectedLeftTheme === theme) {
            setLeftCandidateThemes((prev) => [...prev, candidateTheme]);
          } else if (selectedRightTheme === theme) {
            setRightCandidateThemes((prev) => [...prev, candidateTheme]);
          }
          break;

        case "add":
          // Remove the added candidate theme
          if (selectedLeftTheme === theme) {
            setLeftCandidateThemes((prev) => prev.filter((ct) => ct !== candidateTheme));
          } else if (selectedRightTheme === theme) {
            setRightCandidateThemes((prev) => prev.filter((ct) => ct !== candidateTheme));
          }
          break;
      }
    },
    [
      selectedLeftTheme,
      selectedRightTheme,
      themesData,
      onThemeUpdate,
      setLeftCandidateThemes,
      setRightCandidateThemes,
    ]
  );

  // Revert main theme name changes
  const revertMainThemeChange = useCallback(
    async ({ action, oldName, newName }: { action: string; oldName: string; newName: string }) => {
      if (action !== "rename") return;

      try {
        // Update local state - rename back from newName to oldName
        setAllThemes((prev: any[]) =>
          prev.map((theme) => (theme.name === newName ? { ...theme, name: oldName } : theme))
        );

        // Update selected themes if they match
        if (selectedLeftTheme === newName) {
          setSelectedLeftTheme(oldName);
        }
        if (selectedRightTheme === newName) {
          setSelectedRightTheme(oldName);
        }

        // Update backend - find all cases with the new theme name and revert to old name
        const casesToUpdate = themesData.filter((item) => item.theme === newName);
        for (const caseItem of casesToUpdate) {
          if (onThemeUpdate) {
            await onThemeUpdate(caseItem.caseId, "theme", oldName);
          }
        }
      } catch (error) {
        console.error("Error reverting main theme change:", error);
        throw error;
      }
    },
    [
      selectedLeftTheme,
      selectedRightTheme,
      themesData,
      onThemeUpdate,
      setAllThemes,
      setSelectedLeftTheme,
      setSelectedRightTheme,
    ]
  );

  // Handle different types of AI suggestions
  const handleSuggestionMove = useCallback(
    async ({ candidateTheme, fromTheme, toTheme }: { candidateTheme: string; fromTheme: string; toTheme: string }) => {
      // Similar to existing drag and drop logic
      const casesToUpdate = themesData.filter((item) => item.candidate_theme === candidateTheme);

      for (const caseItem of casesToUpdate) {
        if (onThemeUpdate) {
          await onThemeUpdate(caseItem.caseId, "theme", toTheme);
        }
      }

      // Update local state
      if (selectedLeftTheme === fromTheme) {
        setLeftCandidateThemes((prev) => prev.filter((ct) => ct !== candidateTheme));
      } else if (selectedRightTheme === fromTheme) {
        setRightCandidateThemes((prev) => prev.filter((ct) => ct !== candidateTheme));
      }

      if (selectedLeftTheme === toTheme) {
        setLeftCandidateThemes((prev) => [...prev, candidateTheme]);
      } else if (selectedRightTheme === toTheme) {
        setRightCandidateThemes((prev) => [...prev, candidateTheme]);
      }
    },
    [
      selectedLeftTheme,
      selectedRightTheme,
      themesData,
      onThemeUpdate,
      setLeftCandidateThemes,
      setRightCandidateThemes,
    ]
  );

  // Handle moving multiple candidates
  const handleSuggestionMoveMultiple = useCallback(
    async ({ candidates, fromTheme, toTheme }: { candidates: string[]; fromTheme: string; toTheme: string }) => {
      for (const candidateTheme of candidates) {
        const casesToUpdate = themesData.filter((item) => item.candidate_theme === candidateTheme);

        for (const caseItem of casesToUpdate) {
          if (onThemeUpdate) {
            await onThemeUpdate(caseItem.caseId, "theme", toTheme);
          }
        }

        // Update local state
        if (selectedLeftTheme === fromTheme) {
          setLeftCandidateThemes((prev) => prev.filter((ct) => ct !== candidateTheme));
        } else if (selectedRightTheme === fromTheme) {
          setRightCandidateThemes((prev) => prev.filter((ct) => ct !== candidateTheme));
        }

        if (selectedLeftTheme === toTheme) {
          setLeftCandidateThemes((prev) => [...prev, candidateTheme]);
        } else if (selectedRightTheme === toTheme) {
          setRightCandidateThemes((prev) => [...prev, candidateTheme]);
        }
      }
    },
    [
      selectedLeftTheme,
      selectedRightTheme,
      themesData,
      onThemeUpdate,
      setLeftCandidateThemes,
      setRightCandidateThemes,
    ]
  );

  const handleSuggestionRename = useCallback(
    async ({ currentName, suggestedName, theme }: { currentName: string; suggestedName: string; theme: string }) => {
      // Similar to existing rename logic
      const casesToUpdate = themesData.filter((item) => item.candidate_theme === currentName);

      for (const caseItem of casesToUpdate) {
        if (onThemeUpdate) {
          await onThemeUpdate(caseItem.caseId, "candidate_theme", suggestedName);
        }
      }

      // Update local state
      if (selectedLeftTheme === theme) {
        setLeftCandidateThemes((prev) => prev.map((ct) => (ct === currentName ? suggestedName : ct)));
      } else if (selectedRightTheme === theme) {
        setRightCandidateThemes((prev) => prev.map((ct) => (ct === currentName ? suggestedName : ct)));
      }
    },
    [
      selectedLeftTheme,
      selectedRightTheme,
      themesData,
      onThemeUpdate,
      setLeftCandidateThemes,
      setRightCandidateThemes,
    ]
  );

  const handleSuggestionThemeRename = useCallback(
    async ({ currentName, suggestedName }: { currentName: string; suggestedName: string }) => {
      // Similar to existing theme rename logic
      const casesToUpdate = themesData.filter((item) => item.theme === currentName);

      for (const caseItem of casesToUpdate) {
        if (onThemeUpdate) {
          await onThemeUpdate(caseItem.caseId, "theme", suggestedName);
        }
      }

      // Update local state
      setAllThemes((prev: any[]) =>
        prev.map((theme) => (theme.name === currentName ? { ...theme, name: suggestedName } : theme))
      );

      if (selectedLeftTheme === currentName) setSelectedLeftTheme(suggestedName);
      if (selectedRightTheme === currentName) setSelectedRightTheme(suggestedName);
    },
    [
      selectedLeftTheme,
      selectedRightTheme,
      themesData,
      onThemeUpdate,
      setAllThemes,
      setSelectedLeftTheme,
      setSelectedRightTheme,
    ]
  );

  const handleSuggestionAdd = useCallback(
    async ({ candidateTheme, theme }: { candidateTheme: string; theme: string }) => {
      // Add new candidate theme
      if (selectedLeftTheme === theme) {
        setLeftCandidateThemes((prev) => [...prev, candidateTheme]);
      } else if (selectedRightTheme === theme) {
        setRightCandidateThemes((prev) => [...prev, candidateTheme]);
      }
    },
    [selectedLeftTheme, selectedRightTheme, setLeftCandidateThemes, setRightCandidateThemes]
  );

  const handleSuggestionDelete = useCallback(
    async ({ candidateTheme, theme }: { candidateTheme: string; theme: string }) => {
      // Delete candidate theme
      const casesToUpdate = themesData.filter((item) => item.candidate_theme === candidateTheme);

      for (const caseItem of casesToUpdate) {
        if (onThemeUpdate) {
          await onThemeUpdate(caseItem.caseId, "candidate_theme", null);
        }
      }

      // Update local state
      if (selectedLeftTheme === theme) {
        setLeftCandidateThemes((prev) => prev.filter((ct) => ct !== candidateTheme));
      } else if (selectedRightTheme === theme) {
        setRightCandidateThemes((prev) => prev.filter((ct) => ct !== candidateTheme));
      }
    },
    [
      selectedLeftTheme,
      selectedRightTheme,
      themesData,
      onThemeUpdate,
      setLeftCandidateThemes,
      setRightCandidateThemes,
    ]
  );

  // Handle deleting a theme group
  const handleSuggestionDeleteThemeGroup = useCallback(
    async ({ themeName }: { themeName: string }) => {
      // Get all cases with this theme
      const casesToUpdate = themesData.filter((item) => item.theme === themeName);

      // Set theme to null for all cases in this theme group
      for (const caseItem of casesToUpdate) {
        if (onThemeUpdate) {
          await onThemeUpdate(caseItem.caseId, "theme", null);
        }
      }

      // Remove the theme from allThemes
      setAllThemes((prev: any[]) => prev.filter((t: any) => t.name !== themeName));

      // Clear selection if the deleted theme was selected
      if (selectedLeftTheme === themeName) {
        setSelectedLeftTheme(null);
        setLeftCandidateThemes([]);
      }
      if (selectedRightTheme === themeName) {
        setSelectedRightTheme(null);
        setRightCandidateThemes([]);
      }

      console.log(`Deleted theme group "${themeName}"`);
    },
    [
      selectedLeftTheme,
      selectedRightTheme,
      themesData,
      onThemeUpdate,
      setAllThemes,
      setSelectedLeftTheme,
      setSelectedRightTheme,
      setLeftCandidateThemes,
      setRightCandidateThemes,
    ]
  );

  // Handle creating new themes
  const handleSuggestionCreateTheme = useCallback(
    async ({ newThemeName, candidatesToMove, fromTheme, fromThemes }: { newThemeName: string; candidatesToMove: string[]; fromTheme?: string; fromThemes?: string[] }) => {
      try {
        // Move candidates from their current themes to the new theme in backend
        for (const candidateTheme of candidatesToMove) {
          const casesToUpdate = themesData.filter((item) => item.candidate_theme === candidateTheme);

          for (const caseItem of casesToUpdate) {
            if (onThemeUpdate) {
              await onThemeUpdate(caseItem.caseId, "theme", newThemeName);
            }
          }
        }

        console.log(`Created new theme "${newThemeName}" with ${candidatesToMove.length} candidates`);

        // The useEffect in ThemesOrganizer will automatically refresh the themes from themesData
        // and preserve the current selections, so we don't need to manually update local state here
      } catch (error) {
        console.error("Error creating new theme:", error);
        throw error;
      }
    },
    [themesData, onThemeUpdate]
  );

  // Handle merging themes
  const handleSuggestionMergeThemes = useCallback(
    async ({ theme1, theme2, newThemeName }: { theme1: string; theme2: string; newThemeName: string }) => {
      // Find the themes to merge
      const theme1Data = themesData.filter((item) => item.theme === theme1);
      const theme2Data = themesData.filter((item) => item.theme === theme2);

      // Update all cases from both themes to the new theme name
      for (const caseItem of [...theme1Data, ...theme2Data]) {
        if (onThemeUpdate) {
          await onThemeUpdate(caseItem.caseId, "theme", newThemeName);
        }
      }

      // Update local state
      setAllThemes((prev: any[]) => {
        const theme1Obj = (prev as any[]).find((t: any) => t.name === theme1);
        const theme2Obj = (prev as any[]).find((t: any) => t.name === theme2);

        if (!theme1Obj || !theme2Obj) return prev;

        const mergedCandidates = [...theme1Obj.candidateThemes, ...theme2Obj.candidateThemes];

        return [
          ...prev.filter((t: any) => t.name !== theme1 && t.name !== theme2),
          { name: newThemeName, candidateThemes: mergedCandidates },
        ];
      });

      // Update selected themes if they were one of the merged themes
      if (selectedLeftTheme === theme1 || selectedLeftTheme === theme2) {
        setSelectedLeftTheme(newThemeName);
      }
      if (selectedRightTheme === theme1 || selectedRightTheme === theme2) {
        setSelectedRightTheme(newThemeName);
      }
    },
    [
      selectedLeftTheme,
      selectedRightTheme,
      themesData,
      onThemeUpdate,
      setLeftCandidateThemes,
      setRightCandidateThemes,
      setAllThemes,
      setSelectedLeftTheme,
      setSelectedRightTheme,
    ]
  );

  // Handle merging candidate themes
  const handleSuggestionMergeCandidates = useCallback(
    async ({ candidate1, candidate2, newName, theme }: { candidate1: string; candidate2: string; newName: string; theme: string }) => {
      // Update all cases with candidate1 or candidate2 to use newName
      const casesToUpdate = themesData.filter(
        (item) => item.candidate_theme === candidate1 || item.candidate_theme === candidate2
      );

      for (const caseItem of casesToUpdate) {
        if (onThemeUpdate) {
          await onThemeUpdate(caseItem.caseId, "candidate_theme", newName);
        }
      }

      // Update local state
      if (selectedLeftTheme === theme) {
        setLeftCandidateThemes((prev) => prev.filter((ct) => ct !== candidate1 && ct !== candidate2).concat([newName]));
      } else if (selectedRightTheme === theme) {
        setRightCandidateThemes((prev) => prev.filter((ct) => ct !== candidate1 && ct !== candidate2).concat([newName]));
      }

      // Update allThemes
      setAllThemes((prev: any[]) =>
        prev.map((t: any) =>
          t.name === theme
            ? {
                ...t,
                candidateThemes: t.candidateThemes
                  .filter((ct: string) => ct !== candidate1 && ct !== candidate2)
                  .concat([newName]),
              }
            : t
        )
      );
    },
    [
      selectedLeftTheme,
      selectedRightTheme,
      themesData,
      onThemeUpdate,
      setLeftCandidateThemes,
      setRightCandidateThemes,
      setAllThemes,
    ]
  );

  return {
    revertThemeMove,
    revertCandidateThemeChange,
    revertMainThemeChange,
    handleSuggestionMove,
    handleSuggestionMoveMultiple,
    handleSuggestionRename,
    handleSuggestionThemeRename,
    handleSuggestionAdd,
    handleSuggestionDelete,
    handleSuggestionDeleteThemeGroup,
    handleSuggestionCreateTheme,
    handleSuggestionMergeThemes,
    handleSuggestionMergeCandidates,
  };
};
