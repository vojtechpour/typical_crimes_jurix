import React, { useState, useEffect, useRef } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import ThemeSelector from "./ThemeSelector";
import DragDropContainer from "./DragDropContainer";
import ControlPanel from "./ControlPanel";
import ChangeTracker from "./ChangeTracker";
import Statistics from "./Statistics";

interface DataBrowserProps {
  specificFile?: string | null;
}

const DataBrowser: React.FC<DataBrowserProps> = ({ specificFile = null }) => {
  const [files, setFiles] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<any | null>(null);
  const [fileData, setFileData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState<boolean>(false);

  // Upload-related state
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(
    null
  );
  const [uploadStatus, setUploadStatus] = useState<any>(null);
  const [validationResult, setValidationResult] = useState<any>(null);

  // Delete-related state
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Statistics state
  const [fileStats, setFileStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState<boolean>(false);

  // Theme exploration state
  const [activeMode, setActiveMode] = useState<"browse" | "themes">("browse");
  const [originalThemes, setOriginalThemes] = useState<
    Record<string, string[]>
  >({});
  const [modifiedThemes, setModifiedThemes] = useState<
    Record<string, string[]>
  >({});
  const [leftTheme, setLeftTheme] = useState<string>("");
  const [rightTheme, setRightTheme] = useState<string>("");
  const [changesLog, setChangesLog] = useState<any[]>([]);
  const [themeExtractionLoading, setThemeExtractionLoading] =
    useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const itemsPerPage = 20;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    loadFiles();
  }, []);

  // Handle specific file selection
  useEffect(() => {
    if (specificFile && files.length > 0) {
      // Find the specific file in the list
      const targetFile = files.find((file) => file.name === specificFile);
      if (targetFile) {
        setSelectedFile(targetFile);
        loadFileData(targetFile.name, 1, "");
      }
    }
  }, [specificFile, files]);

  const loadFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/data-files");
      const data = await response.json();
      setFiles(data);
    } catch (error: any) {
      setError("Failed to load files: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadFileData = async (
    filename: string,
    page: number = 1,
    searchTerm: string = ""
  ) => {
    setLoadingData(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "50",
        search: searchTerm,
      });

      const response = await fetch(`/api/data/${filename}?${params}`);
      const data = await response.json();

      setFileData(data);
      setCurrentPage(page);

      // Load comprehensive statistics when first loading a file (page 1, no search)
      if (page === 1 && !searchTerm) {
        loadFileStatistics(filename);
      }
    } catch (error: any) {
      setError("Failed to load file data: " + error.message);
    } finally {
      setLoadingData(false);
    }
  };

  const loadFileStatistics = async (filename: string) => {
    setLoadingStats(true);
    try {
      // Get all data for statistics (no pagination)
      const response = await fetch(`/api/data/${filename}?limit=10000`);
      const data = await response.json();

      if (data.items && data.items.length > 0) {
        const stats = calculateFileStatistics(data.items);
        setFileStats(stats);
      }
    } catch (error) {
      console.error("Failed to load file statistics:", error);
    } finally {
      setLoadingStats(false);
    }
  };

  const calculateFileStatistics = (items: any[]) => {
    const stats: any = {
      totalRecords: items.length,
      fieldAnalysis: {},
      textAnalysis: {},
      themeAnalysis: {},
      temporalAnalysis: {},
      qualityMetrics: {},
    };

    // Analyze all fields
    const allFields = new Set<string>();
    items.forEach((item) => {
      Object.keys(item).forEach((key) => allFields.add(key));
    });

    // Field completeness analysis
    allFields.forEach((field) => {
      const nonNullValues = items.filter(
        (item) =>
          item[field] !== null &&
          item[field] !== undefined &&
          item[field] !== ""
      ).length;

      (stats.fieldAnalysis as any)[field] = {
        completeness: ((nonNullValues / items.length) * 100).toFixed(1),
        nonNullCount: nonNullValues,
        uniqueValues: new Set(
          items
            .map((item) => item[field])
            .filter((v) => v !== null && v !== undefined && v !== "")
        ).size,
      };
    });

    // Text analysis for main description field
    const descriptionField = items[0]?.plny_skutek_short
      ? "plny_skutek_short"
      : items[0]?.description
      ? "description"
      : Object.keys(items[0] || {}).find(
          (key) =>
            key.toLowerCase().includes("description") ||
            key.toLowerCase().includes("skutek")
        );

    if (descriptionField) {
      const descriptions = items
        .map((item) => item[descriptionField])
        .filter((desc: any) => desc);
      const wordCounts = descriptions.map(
        (desc: string) => desc.split(/\s+/).length
      );
      const charCounts = descriptions.map((desc: string) => desc.length);

      stats.textAnalysis = {
        field: descriptionField,
        avgWordCount: (
          wordCounts.reduce((a: number, b: number) => a + b, 0) /
          wordCounts.length
        ).toFixed(1),
        avgCharCount: (
          charCounts.reduce((a: number, b: number) => a + b, 0) /
          charCounts.length
        ).toFixed(0),
        minWordCount: Math.min(...wordCounts),
        maxWordCount: Math.max(...wordCounts),
        minCharCount: Math.min(...charCounts),
        maxCharCount: Math.max(...charCounts),
      };

      // Common words analysis (simple)
      const allWords = descriptions
        .join(" ")
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((word: string) => word.length > 3);

      const wordFreq: Record<string, number> = {};
      allWords.forEach((word: string) => {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      });

      stats.textAnalysis.commonWords = Object.entries(wordFreq)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 10)
        .map(([word, count]) => ({ word, count }));
    }

    // Theme analysis
    const themeFields = [
      "theme",
      "candidate_theme",
      "initial_code",
      "Varianta_EN",
    ];
    themeFields.forEach((field) => {
      if (items.some((item) => item[field])) {
        const themes = items
          .map((item) => item[field])
          .filter((theme: any) => theme);
        const themeFreq: Record<string, number> = {};
        themes.forEach((theme: string) => {
          themeFreq[theme] = (themeFreq[theme] || 0) + 1;
        });

        (stats.themeAnalysis as any)[field] = {
          uniqueThemes: Object.keys(themeFreq).length,
          totalThemed: themes.length,
          coverage: ((themes.length / items.length) * 100).toFixed(1),
          topThemes: Object.entries(themeFreq)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .slice(0, 10)
            .map(([theme, count]) => ({
              theme,
              count,
              percentage: (((count as number) / themes.length) * 100).toFixed(
                1
              ),
            })),
        };
      }
    });

    // Temporal analysis (if date fields exist)
    const dateFields = Object.keys(items[0] || {}).filter(
      (key) =>
        key.toLowerCase().includes("date") ||
        key.toLowerCase().includes("time") ||
        key.toLowerCase().includes("datum")
    );

    if (dateFields.length > 0) {
      dateFields.forEach((field) => {
        const dates = items
          .map((item) => item[field])
          .filter((date: any) => date);
        if (dates.length > 0) {
          // Try to parse dates
          const parsedDates = dates
            .map((date: any) => {
              try {
                return new Date(date);
              } catch {
                return null;
              }
            })
            .filter((date: any) => date && !isNaN(date as any));

          if (parsedDates.length > 0) {
            (stats.temporalAnalysis as any)[field] = {
              count: parsedDates.length,
              earliest: new Date(
                Math.min(...(parsedDates as any))
              ).toLocaleDateString(),
              latest: new Date(
                Math.max(...(parsedDates as any))
              ).toLocaleDateString(),
              coverage: ((parsedDates.length / items.length) * 100).toFixed(1),
            };
          }
        }
      });
    }

    // Quality metrics
    const requiredFields = ["plny_skutek_short", "description"];
    const hasRequiredField = requiredFields.some((field) =>
      items.every(
        (item) => item[field] && item[field].toString().trim().length > 0
      )
    );

    stats.qualityMetrics = {
      hasRequiredFields: hasRequiredField,
      completenessScore: (
        Object.values(stats.fieldAnalysis).reduce(
          (sum: number, field: any) => sum + parseFloat(field.completeness),
          0
        ) / Object.keys(stats.fieldAnalysis).length
      ).toFixed(1),
      duplicateIds:
        items.length -
        new Set(items.map((item, index) => item.id || index)).size,
      emptyRecords: items.filter((item) =>
        Object.values(item).every(
          (value) => !value || value.toString().trim() === ""
        )
      ).length,
    };

    return stats;
  };

  const handleFileSelect = (file: any) => {
    // Handle file object vs event
    if ((file as any).target) {
      // This is from file input - handle file upload selection
      const selectedFile = (file as React.ChangeEvent<HTMLInputElement>).target
        .files?.[0];
      if (selectedFile) {
        setSelectedUploadFile(selectedFile);
        validateFile(selectedFile);
      }
    } else {
      // This is from file list - handle file viewing selection
      setSelectedFile(file);
      setActiveMode("browse");
      // Clear previous statistics
      setFileStats(null);
      setLoadingStats(false);
      loadFileData(file.name, 1, "");
    }
  };

  const validateFile = (file: File) => {
    const maxSize = 50 * 1024 * 1024; // 50MB

    if (file.size > maxSize) {
      setValidationResult({
        isValid: false,
        error: "File size exceeds 50MB limit",
        fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse((e.target as FileReader).result as string);

        // Only support object format with case IDs as keys
        if (Array.isArray(jsonData)) {
          throw new Error(
            "Arrays are not supported. Please use object format with case IDs as keys."
          );
        }

        if (typeof jsonData !== "object" || jsonData === null) {
          throw new Error("JSON must be an object with case records");
        }

        const caseIds = Object.keys(jsonData);
        if (caseIds.length === 0) {
          throw new Error("No case records found in the file");
        }

        // Check for required field in each case record
        const caseRecords = Object.values(jsonData);
        const hasRequiredField = (caseRecords as any[]).every(
          (item) =>
            item && typeof item === "object" && (item as any).plny_skutek_short
        );

        if (!hasRequiredField) {
          throw new Error(
            "All case records must have 'plny_skutek_short' field"
          );
        }

        setValidationResult({
          isValid: true,
          itemCount: caseIds.length,
          fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        });
      } catch (error: any) {
        setValidationResult({
          isValid: false,
          error: error.message,
          fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        });
      }
    };

    reader.readAsText(file);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFile) {
      loadFileData(selectedFile.name, 1, searchTerm);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (selectedFile) {
      loadFileData(selectedFile.name, newPage, searchTerm);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (date: string | number | Date) => {
    return new Date(date).toLocaleString();
  };

  const renderValue = (value: any, key: string = "") => {
    if (value === null || value === undefined) {
      return <span className="null-value">null</span>;
    }

    if (typeof value === "string") {
      if (value.length > 200) {
        return (
          <div className="long-text">
            <details>
              <summary>{value.substring(0, 200)}...</summary>
              <div className="full-text">{value}</div>
            </details>
          </div>
        );
      }
      return <span className="string-value">{value}</span>;
    }

    if (typeof value === "object") {
      return (
        <details className="object-value">
          <summary>
            {Array.isArray(value) ? `Array(${value.length})` : "Object"}
          </summary>
          <pre className="json-preview">{JSON.stringify(value, null, 2)}</pre>
        </details>
      );
    }

    return <span className={`${typeof value}-value`}>{value.toString()}</span>;
  };

  // Upload-related functions
  const handleUpload = async () => {
    if (!selectedUploadFile) return;

    const formData = new FormData();
    formData.append("dataFile", selectedUploadFile);

    try {
      setUploadStatus({ type: "info", message: "Uploading file..." });

      const response = await fetch("/api/upload-data", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setUploadStatus({
          type: "success",
          message: `File uploaded successfully! ${result.recordCount} records processed.`,
        });

        // Reset upload state
        setSelectedUploadFile(null);
        setValidationResult(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }

        // Refresh file list
        loadFiles();

        // Auto-select the uploaded file
        setTimeout(() => {
          const uploadedFile = { name: result.filename };
          setSelectedFile(uploadedFile);
          setActiveMode("browse");
          loadFileData(result.filename, 1, "");
        }, 1000);
      } else {
        setUploadStatus({
          type: "error",
          message: result.message || "Upload failed",
        });
      }
    } catch (error) {
      setUploadStatus({
        type: "error",
        message: "Network error during upload",
      });
    }
  };

  const deleteFile = async (filename: string) => {
    try {
      const response = await fetch(`/api/data/${filename}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (response.ok) {
        // Refresh the file list
        loadFiles();

        // Clear selected file if it was the deleted one
        if (selectedFile?.name === filename) {
          setSelectedFile(null);
          setFileData(null);
        }

        // Show success message temporarily
        setUploadStatus({
          success: true,
          message: `File ${filename} deleted successfully`,
        });

        // Clear status after 3 seconds
        setTimeout(() => setUploadStatus(null), 3000);
      } else {
        setUploadStatus({
          success: false,
          message: result.error || "Failed to delete file",
        });
      }
    } catch (error: any) {
      setUploadStatus({
        success: false,
        message: "Delete error: " + error.message,
      });
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleDeleteClick = (filename: string) => {
    setDeleteConfirm(filename);
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteFile(deleteConfirm);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirm(null);
  };

  // Theme exploration functions
  const extractThemesFromFile = async (filename: string) => {
    if (!filename) return;

    setThemeExtractionLoading(true);
    try {
      const response = await fetch(`/api/data/${filename}?limit=10000`); // Get all data
      const data = await response.json();

      if (!data.items || data.items.length === 0) {
        console.error("No data found in file");
        setThemeExtractionLoading(false);
        return;
      }

      // Extract themes from the data
      const themeStructure: Record<string, string[]> = {};

      data.items.forEach((item: any) => {
        // Look for theme fields - try different possible field names
        const themeField =
          item.theme || item.candidate_theme || item.initial_code;

        if (themeField && typeof themeField === "string") {
          // Split theme into main category and sub-theme if it contains specific patterns
          const theme = themeField.trim();

          // Try to determine main category from the theme text
          let mainCategory = "Miscellaneous Theft";
          let subTheme = theme;

          // Define mapping patterns for main categories
          const categoryPatterns: Record<string, string[]> = {
            "Workplace Theft": ["workplace", "work", "office", "employee"],
            Shoplifting: ["shoplifting", "shop", "store", "retail"],
            "Theft from Vehicles": ["vehicle", "car", "auto", "from vehicle"],
            "Residential Burglary": [
              "residential",
              "home",
              "house",
              "apartment",
              "burglary",
            ],
            "Commercial Burglary": [
              "commercial",
              "business",
              "company",
              "burglary",
            ],
            "Street Theft": ["street", "public", "outdoor"],
            "Utility Theft": ["utility", "cable", "copper", "infrastructure"],
            "Family Theft": ["family", "domestic", "relative"],
            Pickpocketing: ["pickpocket", "pocket"],
            Vandalism: ["vandalism", "damage", "destruction"],
            "Financial Theft": ["financial", "fraud", "money", "cash", "bank"],
            "Vehicle Specific Theft": [
              "vehicle theft",
              "car theft",
              "auto theft",
            ],
          };

          // Find matching category
          const lowerTheme = theme.toLowerCase();
          for (const [category, patterns] of Object.entries(categoryPatterns)) {
            if (patterns.some((pattern) => lowerTheme.includes(pattern))) {
              mainCategory = category;
              break;
            }
          }

          // Initialize category if it doesn't exist
          if (!themeStructure[mainCategory]) {
            themeStructure[mainCategory] = [];
          }

          // Add sub-theme if it's not already there
          if (!themeStructure[mainCategory].includes(subTheme)) {
            themeStructure[mainCategory].push(subTheme);
          }
        }
      });

      // Ensure we have at least some themes
      if (Object.keys(themeStructure).length === 0) {
        themeStructure["Miscellaneous Theft"] = ["Unclassified Crime"];
      }

      setOriginalThemes(themeStructure);
      setModifiedThemes(JSON.parse(JSON.stringify(themeStructure)));

      // Set initial themes
      const themeNames = Object.keys(themeStructure);
      if (themeNames.length >= 2) {
        setLeftTheme(themeNames[0]);
        setRightTheme(themeNames[1]);
      } else if (themeNames.length === 1) {
        setLeftTheme(themeNames[0]);
        setRightTheme(themeNames[0]);
      }

      // Clear changes log when loading new file
      setChangesLog([]);
      setActiveMode("themes");
    } catch (error) {
      console.error("Error extracting themes:", error);
    } finally {
      setThemeExtractionLoading(false);
    }
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (!over) return;

    // Get active item data
    const activeData = active.data.current;
    const activeTheme = activeData.theme;
    const activeIndex = activeData.index;
    const activeText = activeData.text;

    // Get drop target data
    const overData = over.data.current;
    let targetTheme: string | undefined;
    let insertionIndex = -1; // -1 means append to end

    if (overData && overData.type === "container") {
      // Dropped on a container (append to end)
      targetTheme = overData.theme;
    } else if (overData && overData.type === "container-end") {
      // Dropped on the end drop zone (append to end)
      targetTheme = overData.theme;
      insertionIndex = overData.index; // This will be the length of the array
    } else if (overData && overData.type === "item") {
      // Dropped on an item (insert before that item)
      targetTheme = overData.theme;
      insertionIndex = overData.index;
    } else {
      // Try to extract theme from ID as fallback
      const overId = over.id as string;
      if (overId.includes("|||")) {
        targetTheme = overId.split("|||")[1];
      } else if ((overId as string).startsWith("container-")) {
        targetTheme = (overId as string).replace("container-", "");
      } else if ((overId as string).startsWith("drop-")) {
        // Handle drop- prefixed IDs
        const originalId = (overId as string).replace("drop-", "");
        if (originalId.includes("|||")) {
          targetTheme = originalId.split("|||")[1];
          // Get index from the original ID
          const parts = originalId.split("|||");
          if (parts.length >= 3) {
            insertionIndex = parseInt(parts[2]);
          }
        }
      } else {
        return; // Can't determine target
      }
    }

    // If moving to different container or same container with different position
    if (
      activeTheme !== targetTheme ||
      (activeTheme === targetTheme &&
        insertionIndex !== -1 &&
        insertionIndex !== activeIndex)
    ) {
      handleMove(
        activeTheme,
        targetTheme as string,
        activeIndex,
        activeText,
        insertionIndex
      );
    }
  };

  const handleMove = (
    fromTheme: string,
    toTheme: string,
    fromIndex: number,
    itemText: string,
    toIndex: number = -1
  ) => {
    const newModifiedThemes: Record<string, string[]> = { ...modifiedThemes };

    // Remove from source
    newModifiedThemes[fromTheme] = newModifiedThemes[fromTheme].filter(
      (_, index) => index !== fromIndex
    );

    // If moving within the same container and insertion is after the original position,
    // we need to adjust the insertion index because we removed an item
    if (fromTheme === toTheme && toIndex > fromIndex) {
      toIndex = toIndex - 1;
    }

    // Add to destination at specific position or end
    if (toIndex === -1) {
      // Append to end
      newModifiedThemes[toTheme] = [...newModifiedThemes[toTheme], itemText];
    } else {
      // Insert at specific position
      const newArray = [...newModifiedThemes[toTheme]];
      newArray.splice(toIndex, 0, itemText);
      newModifiedThemes[toTheme] = newArray;
    }

    setModifiedThemes(newModifiedThemes);

    // Log the change
    const change = {
      action: fromTheme === toTheme ? "reorder" : "move",
      subTheme: itemText,
      from: fromTheme,
      to: toTheme,
      timestamp: new Date().toLocaleTimeString(),
    };
    setChangesLog((prev) => [...prev, change]);
  };

  const resetAll = () => {
    setModifiedThemes(JSON.parse(JSON.stringify(originalThemes)));
    setChangesLog([]);
  };

  const exportThemes = () => {
    const exportData = {
      modified_themes: modifiedThemes,
      changes_log: changesLog,
      export_timestamp: new Date().toISOString(),
      source_file: selectedFile?.name,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `modified_themes_${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/:/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderFileData = (data: any) => {
    if (!data || !data.items || data.items.length === 0) {
      return (
        <div className="no-data">
          No data found {searchTerm && `for search term "${searchTerm}"`}
        </div>
      );
    }

    // Get all unique keys from the data
    const allKeys: string[] = Array.from(
      new Set<string>(
        data.items.flatMap((item: any) => Object.keys(item) as string[])
      )
    );

    const emphasizeColumns = new Set([
      "candidate_theme",
      "theme",
      "Varianta_EN",
      "Varianta_EN_gpt4",
      "Okolnost",
    ]);

    return (
      <div className="data-table-container">
        <table className="table" role="grid" aria-label="Cases">
          <thead>
            <tr>
              {allKeys.map((key: string) => (
                <th key={key}>{key}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.items.map((item: any, index: number) => (
              <tr key={index}>
                {allKeys.map((key: string) => (
                  <td
                    key={key}
                    className={`data-cell ${
                      emphasizeColumns.has(key) ? "cell-emphasis" : ""
                    }`}
                  >
                    {renderValue(item[key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderPagination = () => {
    if (!fileData || fileData.totalPages <= 1) {
      return null;
    }

    return (
      <div className="pagination">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="page-button"
        >
          ← Previous
        </button>

        <span className="page-info">
          Page {currentPage} of {fileData.totalPages}
        </span>

        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage >= fileData.totalPages}
          className="page-button"
        >
          Next →
        </button>
      </div>
    );
  };

  // Filter files based on whether we're showing a specific file
  const filesToShow = specificFile
    ? files.filter((file) => file.name === specificFile)
    : files;

  return (
    <div className="data-browser">
      <div className="data-browser-header">
        <h2>📊 Data & Theme Explorer</h2>
        <p>Upload, browse, and explore themes from your crime data files</p>
      </div>

      {/* Mode Selection */}
      {selectedFile && (
        <div className="mode-selector">
          <button
            className={`mode-btn ${activeMode === "browse" ? "active" : ""}`}
            onClick={() => setActiveMode("browse")}
          >
            📖 Browse Data
          </button>
        </div>
      )}

      {/* File Upload Section (redesigned) */}
      <section className="card">
        <div className="card-header row">
          <h3>Upload data file</h3>
          <span className="muted">JSON, object of case records</span>
        </div>
        <div className="card-body">
          <div
            id="upload-help"
            className="muted"
            style={{ marginBottom: "8px" }}
          >
            Each record must include <code>plny_skutek_short</code>. Max 50 MB.
          </div>

          <details className="muted" style={{ marginBottom: "12px" }}>
            <summary>View JSON example</summary>
            <div className="json-example" style={{ marginTop: "8px" }}>
              <pre>{`{
  "case_id_1": {
    "plny_skutek_short": "Brief description of the crime",
    "theme": "Crime theme (optional)",
    "candidate_theme": "Alternative theme (optional)",
    "initial_code": "Initial classification (optional)"
  },
  "case_id_2": {
    "plny_skutek_short": "Another crime description"
  }
}`}</pre>
            </div>
          </details>

          {/* File Selection */}
          <div
            className="row"
            role="group"
            aria-labelledby="file-upload-label"
            style={{ marginBottom: "8px" }}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".json"
              className="file-input"
              id="file-upload"
              aria-describedby="upload-help"
            />
            <label
              id="file-upload-label"
              htmlFor="file-upload"
              className="btn subtle"
            >
              Choose JSON file
            </label>
            {selectedUploadFile && (
              <span className="cell-mono">{selectedUploadFile.name}</span>
            )}
          </div>

          {/* Validation Results */}
          {validationResult && (
            <div
              className={`validation-result ${
                validationResult.isValid ? "valid" : "invalid"
              }`}
              style={{ marginBottom: "8px" }}
            >
              <div className="validation-header">Validation</div>
              <div className="validation-details">
                <p>
                  <strong>File Size:</strong> {validationResult.fileSize}
                </p>
                {validationResult.isValid ? (
                  <>
                    <p>
                      <strong>Records Found:</strong>{" "}
                      {validationResult.itemCount}
                    </p>
                    <p>File structure is valid and ready for upload.</p>
                  </>
                ) : (
                  <>
                    <p className="error-message">
                      <strong>Error:</strong> {validationResult.error}
                    </p>
                    <p>Please check your file format and try again.</p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Upload Button */}
          {selectedUploadFile && validationResult?.isValid && (
            <div>
              <button onClick={handleUpload} className="btn primary">
                Upload file
              </button>
            </div>
          )}

          {/* Upload Status */}
          {uploadStatus && (
            <div
              className={`upload-status ${
                uploadStatus.type === "success" ? "success" : "error"
              }`}
              style={{ marginTop: "8px" }}
            >
              {uploadStatus.message}
            </div>
          )}
        </div>
      </section>

      {/* File Management Section (redesigned) */}
      <section className="card">
        <div className="card-header row">
          <h3>Uploaded files</h3>
          {loading && <span className="badge info">Loading…</span>}
        </div>
        <div className="card-body">
          {error && <div className="error-message">{error}</div>}

          {files.length === 0 && !loading ? (
            <div className="no-files">
              <p>No files uploaded yet.</p>
              <p>Upload a JSON file above to get started.</p>
            </div>
          ) : (
            <div role="list">
              {files.map((file) => (
                <div
                  key={file.name}
                  role="listitem"
                  aria-selected={selectedFile?.name === file.name}
                  className="row"
                  style={{
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{file.name}</div>
                    <div className="muted" style={{ display: "flex", gap: 12 }}>
                      <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                      <span>{new Date(file.modified).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="row">
                    <button
                      onClick={() => handleFileSelect(file)}
                      className="btn subtle"
                    >
                      {selectedFile?.name === file.name ? "Selected" : "View"}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm(file.name);
                      }}
                      className="btn danger"
                      title="Delete file"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Content Area - Data Browser or Theme Explorer */}
      {selectedFile && activeMode === "browse" && (
        <>
          {/* File Statistics Section */}
          {fileStats && (
            <section className="card soft">
              <div className="card-header row">
                <h3>File statistics — {selectedFile.name}</h3>
                {loadingStats && <span className="badge info">Analyzing…</span>}
              </div>
              <div className="card-body">
                {/* Overview: compact badges matching academic UI */}
                <div
                  className="row"
                  style={{ gap: 8, flexWrap: "wrap", marginBottom: 12 }}
                >
                  <span className="badge">
                    <strong>{fileStats.totalRecords.toLocaleString()}</strong>
                    <span className="muted">Total records</span>
                  </span>
                  <span className="badge">
                    <strong>
                      {Object.keys(fileStats.fieldAnalysis).length}
                    </strong>
                    <span className="muted">Data fields</span>
                  </span>
                  <span className="badge">
                    <strong>
                      {fileStats.qualityMetrics.completenessScore}%
                    </strong>
                    <span className="muted">Completeness</span>
                  </span>
                  <span className="badge">
                    <strong>
                      {fileStats.qualityMetrics.hasRequiredFields
                        ? "Yes"
                        : "No"}
                    </strong>
                    <span className="muted">Required fields</span>
                  </span>
                </div>

                {/* Field analysis as research table */}
                <div className="stats-section" style={{ marginTop: 8 }}>
                  <h4>Field analysis</h4>
                  <table
                    className="table"
                    role="grid"
                    aria-label="Field analysis"
                  >
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Completeness</th>
                        <th>Unique values</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(fileStats.fieldAnalysis)
                        .sort(
                          ([, a]: any, [, b]: any) =>
                            parseFloat(b.completeness) -
                            parseFloat(a.completeness)
                        )
                        .slice(0, 10)
                        .map(([field, analysis]: any) => (
                          <tr key={field}>
                            <td className="cell-mono">{field}</td>
                            <td>{(analysis as any).completeness}%</td>
                            <td>{(analysis as any).uniqueValues}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {/* Text analysis */}
                {fileStats.textAnalysis.field && (
                  <div className="stats-section" style={{ marginTop: 12 }}>
                    <h4>Text analysis ({fileStats.textAnalysis.field})</h4>
                    <div
                      className="row"
                      style={{ gap: 8, flexWrap: "wrap", marginBottom: 8 }}
                    >
                      <span className="badge">
                        <strong>Avg words</strong>
                        <span className="muted">
                          {fileStats.textAnalysis.avgWordCount}
                        </span>
                      </span>
                      <span className="badge">
                        <strong>Avg characters</strong>
                        <span className="muted">
                          {fileStats.textAnalysis.avgCharCount}
                        </span>
                      </span>
                      <span className="badge">
                        <strong>Word range</strong>
                        <span className="muted">
                          {fileStats.textAnalysis.minWordCount} –{" "}
                          {fileStats.textAnalysis.maxWordCount}
                        </span>
                      </span>
                    </div>

                    {fileStats.textAnalysis.commonWords && (
                      <div style={{ marginTop: 4 }}>
                        <h5>Most common words</h5>
                        <div
                          className="row"
                          style={{ gap: 6, flexWrap: "wrap" }}
                        >
                          {fileStats.textAnalysis.commonWords.map(
                            ({ word, count }: any) => (
                              <span key={word} className="badge">
                                {word} ({count})
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Theme analysis per field */}
                {Object.keys(fileStats.themeAnalysis).length > 0 && (
                  <div className="stats-section" style={{ marginTop: 12 }}>
                    <h4>Theme analysis</h4>
                    {Object.entries(fileStats.themeAnalysis).map(
                      ([field, analysis]: any) => (
                        <div key={field} style={{ marginTop: 8 }}>
                          <h5>{field.replace(/_/g, " ").toUpperCase()}</h5>
                          <div
                            className="row"
                            style={{
                              gap: 8,
                              flexWrap: "wrap",
                              marginBottom: 8,
                            }}
                          >
                            <span className="badge">
                              <strong>Unique themes</strong>
                              <span className="muted">
                                {(analysis as any).uniqueThemes}
                              </span>
                            </span>
                            <span className="badge">
                              <strong>Coverage</strong>
                              <span className="muted">
                                {(analysis as any).coverage}%
                              </span>
                            </span>
                          </div>
                          <table
                            className="table"
                            role="grid"
                            aria-label={`Top themes for ${field}`}
                          >
                            <thead>
                              <tr>
                                <th>Theme</th>
                                <th>Count</th>
                                <th>%</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(analysis as any).topThemes
                                .slice(0, 5)
                                .map(({ theme, count, percentage }: any) => (
                                  <tr key={theme}>
                                    <td>{theme}</td>
                                    <td className="cell-mono">{count}</td>
                                    <td>{percentage}%</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    )}
                  </div>
                )}

                {/* Temporal analysis */}
                {Object.keys(fileStats.temporalAnalysis).length > 0 && (
                  <div className="stats-section" style={{ marginTop: 12 }}>
                    <h4>Temporal analysis</h4>
                    <table
                      className="table"
                      role="grid"
                      aria-label="Temporal analysis"
                    >
                      <thead>
                        <tr>
                          <th>Field</th>
                          <th>Date range</th>
                          <th>Coverage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(fileStats.temporalAnalysis).map(
                          ([field, analysis]: any) => (
                            <tr key={field}>
                              <td className="cell-mono">{field}</td>
                              <td>
                                {(analysis as any).earliest} –{" "}
                                {(analysis as any).latest}
                              </td>
                              <td>{(analysis as any).coverage}%</td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Data quality */}
                <div className="stats-section" style={{ marginTop: 12 }}>
                  <h4>Data quality</h4>
                  <table
                    className="table"
                    role="grid"
                    aria-label="Data quality"
                  >
                    <thead>
                      <tr>
                        <th>Metric</th>
                        <th>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Overall completeness</td>
                        <td>{fileStats.qualityMetrics.completenessScore}%</td>
                      </tr>
                      <tr>
                        <td>Duplicate records</td>
                        <td className="cell-mono">
                          {fileStats.qualityMetrics.duplicateIds}
                        </td>
                      </tr>
                      <tr>
                        <td>Empty records</td>
                        <td className="cell-mono">
                          {fileStats.qualityMetrics.emptyRecords}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* Data Browser Section (redesigned) */}
          <section className="card soft">
            <div className="card-header row">
              <h3>{selectedFile.name}</h3>
              <span className="spacer" />
              <input
                type="text"
                placeholder="Search data"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input"
                aria-label="Search data"
              />
            </div>
            <div className="card-body">
              {loadingData ? (
                <div className="loading">Loading data…</div>
              ) : fileData ? (
                <>
                  {renderFileData(fileData)}
                  {renderPagination()}
                </>
              ) : (
                <div className="no-data">No data to display</div>
              )}
            </div>
          </section>
        </>
      )}

      {/* Theme Explorer Interface */}
      {selectedFile &&
        activeMode === "themes" &&
        Object.keys(modifiedThemes).length > 0 && (
          <section className="card">
            <div className="card-header row">
              <h3>Theme Explorer — {selectedFile.name}</h3>
            </div>
            <div className="card-body">
              <ControlPanel
                changesCount={changesLog.length}
                onReset={resetAll}
                onExport={exportThemes}
              />

              <ThemeSelector
                themeNames={Object.keys(modifiedThemes)}
                leftTheme={leftTheme}
                rightTheme={rightTheme}
                onLeftThemeChange={setLeftTheme}
                onRightThemeChange={setRightTheme}
              />

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <div className="drag-drop-area">
                  <DragDropContainer
                    theme={leftTheme}
                    items={modifiedThemes[leftTheme] || []}
                    originalCount={originalThemes[leftTheme]?.length || 0}
                    side="left"
                  />
                  <DragDropContainer
                    theme={rightTheme}
                    items={modifiedThemes[rightTheme] || []}
                    originalCount={originalThemes[rightTheme]?.length || 0}
                    side="right"
                  />
                </div>
              </DndContext>

              <Statistics
                modifiedThemes={modifiedThemes}
                originalThemes={originalThemes}
                changesLog={changesLog}
              />

              <ChangeTracker
                changes={changesLog.map((c, idx) => ({
                  id: idx,
                  type: c.action,
                  description:
                    c.action === "reorder"
                      ? `Reordered "${c.subTheme}" in ${c.from}`
                      : `Moved "${c.subTheme}" from ${c.from} to ${c.to}`,
                  timestamp: new Date(c.timestamp || Date.now()),
                  reverted: false,
                }))}
                onClearChanges={() => setChangesLog([])}
                onRevertChange={() => {}}
                onRevertAllChanges={() => setChangesLog([])}
              />
            </div>
          </section>
        )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>🗑️ Confirm Deletion</h3>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to delete <strong>{deleteConfirm}</strong>
                ?
              </p>
              <p className="warning-text">
                ⚠️ This action cannot be undone. The file will be permanently
                removed.
              </p>
            </div>
            <div className="modal-actions">
              <button onClick={cancelDelete} className="cancel-btn">
                Cancel
              </button>
              <button onClick={confirmDelete} className="delete-confirm-btn">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataBrowser;
