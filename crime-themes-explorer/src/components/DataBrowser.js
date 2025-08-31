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

const DataBrowser = ({ specificFile = null }) => {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileData, setFileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState(null);
  const [loadingData, setLoadingData] = useState(false);

  // Upload-related state
  const [selectedUploadFile, setSelectedUploadFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [validationResult, setValidationResult] = useState(null);

  // Delete-related state
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Statistics state
  const [fileStats, setFileStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Theme exploration state
  const [activeMode, setActiveMode] = useState("browse"); // "browse" or "themes"
  const [originalThemes, setOriginalThemes] = useState({});
  const [modifiedThemes, setModifiedThemes] = useState({});
  const [leftTheme, setLeftTheme] = useState("");
  const [rightTheme, setRightTheme] = useState("");
  const [changesLog, setChangesLog] = useState([]);
  const [themeExtractionLoading, setThemeExtractionLoading] = useState(false);

  const fileInputRef = useRef(null);
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
    try {
      const response = await fetch("/api/data-files");
      const data = await response.json();
      setFiles(data);
    } catch (error) {
      setError("Failed to load files: " + error.message);
    }
  };

  const loadFileData = async (filename, page = 1, searchTerm = "") => {
    setLoading(true);
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
    } catch (error) {
      setError("Failed to load file data: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadFileStatistics = async (filename) => {
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

  const calculateFileStatistics = (items) => {
    const stats = {
      totalRecords: items.length,
      fieldAnalysis: {},
      textAnalysis: {},
      themeAnalysis: {},
      temporalAnalysis: {},
      qualityMetrics: {},
    };

    // Analyze all fields
    const allFields = new Set();
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

      stats.fieldAnalysis[field] = {
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
        .filter((desc) => desc);
      const wordCounts = descriptions.map((desc) => desc.split(/\s+/).length);
      const charCounts = descriptions.map((desc) => desc.length);

      stats.textAnalysis = {
        field: descriptionField,
        avgWordCount: (
          wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length
        ).toFixed(1),
        avgCharCount: (
          charCounts.reduce((a, b) => a + b, 0) / charCounts.length
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
        .filter((word) => word.length > 3);

      const wordFreq = {};
      allWords.forEach((word) => {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      });

      stats.textAnalysis.commonWords = Object.entries(wordFreq)
        .sort(([, a], [, b]) => b - a)
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
          .filter((theme) => theme);
        const themeFreq = {};
        themes.forEach((theme) => {
          themeFreq[theme] = (themeFreq[theme] || 0) + 1;
        });

        stats.themeAnalysis[field] = {
          uniqueThemes: Object.keys(themeFreq).length,
          totalThemed: themes.length,
          coverage: ((themes.length / items.length) * 100).toFixed(1),
          topThemes: Object.entries(themeFreq)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([theme, count]) => ({
              theme,
              count,
              percentage: ((count / themes.length) * 100).toFixed(1),
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
        const dates = items.map((item) => item[field]).filter((date) => date);
        if (dates.length > 0) {
          // Try to parse dates
          const parsedDates = dates
            .map((date) => {
              try {
                return new Date(date);
              } catch {
                return null;
              }
            })
            .filter((date) => date && !isNaN(date));

          if (parsedDates.length > 0) {
            stats.temporalAnalysis[field] = {
              count: parsedDates.length,
              earliest: new Date(Math.min(...parsedDates)).toLocaleDateString(),
              latest: new Date(Math.max(...parsedDates)).toLocaleDateString(),
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
          (sum, field) => sum + parseFloat(field.completeness),
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

  const handleFileSelect = (file) => {
    // Handle file object vs event
    if (file.target) {
      // This is from file input - handle file upload selection
      const selectedFile = file.target.files[0];
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

  const validateFile = (file) => {
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
        const jsonData = JSON.parse(e.target.result);

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
        const hasRequiredField = caseRecords.every(
          (item) => item && typeof item === "object" && item.plny_skutek_short
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
      } catch (error) {
        setValidationResult({
          isValid: false,
          error: error.message,
          fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        });
      }
    };

    reader.readAsText(file);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (selectedFile) {
      loadFileData(selectedFile.name, 1, searchTerm);
    }
  };

  const handlePageChange = (newPage) => {
    if (selectedFile) {
      loadFileData(selectedFile.name, newPage, searchTerm);
    }
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString();
  };

  const renderValue = (value, key = "") => {
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

  const deleteFile = async (filename) => {
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
    } catch (error) {
      setUploadStatus({
        success: false,
        message: "Delete error: " + error.message,
      });
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleDeleteClick = (filename) => {
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
  const extractThemesFromFile = async (filename) => {
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
      const themeStructure = {};

      data.items.forEach((item) => {
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
          const categoryPatterns = {
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
      setModifiedThemes(JSON.parse(JSON.stringify(themeStructure))); // Deep copy

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

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (!over) return;

    // Get active item data
    const activeData = active.data.current;
    const activeTheme = activeData.theme;
    const activeIndex = activeData.index;
    const activeText = activeData.text;

    // Get drop target data
    const overData = over.data.current;
    let targetTheme;
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
      const overId = over.id;
      if (overId.includes("|||")) {
        targetTheme = overId.split("|||")[1];
      } else if (overId.startsWith("container-")) {
        targetTheme = overId.replace("container-", "");
      } else if (overId.startsWith("drop-")) {
        // Handle drop- prefixed IDs
        const originalId = overId.replace("drop-", "");
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
        targetTheme,
        activeIndex,
        activeText,
        insertionIndex
      );
    }
  };

  const handleMove = (
    fromTheme,
    toTheme,
    fromIndex,
    itemText,
    toIndex = -1
  ) => {
    const newModifiedThemes = { ...modifiedThemes };

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

  const renderFileData = (data) => {
    if (!data || !data.items || data.items.length === 0) {
      return (
        <div className="no-data">
          No data found {searchTerm && `for search term "${searchTerm}"`}
        </div>
      );
    }

    // Get all unique keys from the data
    const allKeys = [
      ...new Set(data.items.flatMap((item) => Object.keys(item))),
    ];

    return (
      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              {allKeys.map((key) => (
                <th key={key}>{key}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, index) => (
              <tr key={index}>
                {allKeys.map((key) => (
                  <td key={key} className="data-cell">
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

      {/* File Upload Section */}
      <div className="upload-section">
        <div className="upload-header">
          <h3>📤 Upload New Data File</h3>
          <p>Select a JSON file with crime data to upload and analyze</p>
        </div>

        {/* JSON Structure Guide */}
        <div className="json-guide">
          <h4>📋 Required JSON Structure:</h4>

          <div className="json-example">
            <pre>{`{
  "case_id_1": {
    "plny_skutek_short": "Brief description of the crime",
    "theme": "Crime theme (optional)",
    "candidate_theme": "Alternative theme (optional)",
    "initial_code": "Initial classification (optional)",
    // ... other fields
  },
  "case_id_2": {
    "plny_skutek_short": "Another crime description",
    // ... other fields
  }
}`}</pre>
          </div>

          <p>
            ⚠️ <strong>Required:</strong> Each case record must have a{" "}
            <code>plny_skutek_short</code> field.
          </p>
        </div>

        {/* File Selection */}
        <div className="file-input-section">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".json"
            className="file-input"
            id="file-upload"
          />
          <label htmlFor="file-upload" className="file-input-label">
            Choose JSON File
          </label>
          {selectedUploadFile && (
            <span className="selected-file-name">
              {selectedUploadFile.name}
            </span>
          )}
        </div>

        {/* Validation Results */}
        {validationResult && (
          <div
            className={`validation-result ${
              validationResult.isValid ? "valid" : "invalid"
            }`}
          >
            <div className="validation-header">
              {validationResult.isValid ? "✅" : "❌"} Validation Results
            </div>
            <div className="validation-details">
              <p>
                <strong>File Size:</strong> {validationResult.fileSize}
              </p>
              {validationResult.isValid ? (
                <>
                  <p>
                    <strong>Records Found:</strong> {validationResult.itemCount}
                  </p>
                  <p>✅ File structure is valid and ready for upload</p>
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
          <div className="upload-controls">
            <button onClick={handleUpload} className="upload-btn">
              📤 Upload File
            </button>
          </div>
        )}

        {/* Upload Status */}
        {uploadStatus && (
          <div
            className={`upload-status ${
              uploadStatus.type === "success" ? "success" : "error"
            }`}
          >
            {uploadStatus.type === "success" ? "✅" : "❌"}{" "}
            {uploadStatus.message}
          </div>
        )}
      </div>

      {/* File Management Section */}
      <div className="file-management">
        <div className="file-list-header">
          <h3>📁 Uploaded Files</h3>
          {loading && <span className="loading-indicator">🔄 Loading...</span>}
        </div>

        {error && <div className="error-message">❌ {error}</div>}

        <div className="file-list">
          {files.length === 0 && !loading ? (
            <div className="no-files">
              <p>📭 No files uploaded yet.</p>
              <p>Upload a JSON file above to get started.</p>
            </div>
          ) : (
            files.map((file) => (
              <div
                key={file.name}
                className={`file-card ${
                  selectedFile?.name === file.name ? "selected" : ""
                }`}
              >
                <div className="file-content">
                  <div className="file-info">
                    <h4>{file.name}</h4>
                    <div className="file-meta">
                      <span>📊 {(file.size / 1024 / 1024).toFixed(2)} MB</span>
                      <span>📅 {new Date(file.modified).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="file-actions">
                  <button
                    onClick={() => handleFileSelect(file)}
                    className="select-file-btn"
                  >
                    {selectedFile?.name === file.name
                      ? "🔹 Selected"
                      : "👁️ View"}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm(file.name);
                    }}
                    className="delete-btn"
                    title="Delete file"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Content Area - Data Browser or Theme Explorer */}
      {selectedFile && activeMode === "browse" && (
        <>
          {/* File Statistics Section */}
          {fileStats && (
            <div className="file-statistics">
              <div className="stats-header">
                <h3>📊 File Statistics - {selectedFile.name}</h3>
                {loadingStats && (
                  <span className="loading-indicator">🔄 Analyzing...</span>
                )}
              </div>

              {/* Overview Stats */}
              <div className="stats-overview">
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-value">
                      {fileStats.totalRecords.toLocaleString()}
                    </div>
                    <div className="stat-label">Total Records</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">
                      {Object.keys(fileStats.fieldAnalysis).length}
                    </div>
                    <div className="stat-label">Data Fields</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">
                      {fileStats.qualityMetrics.completenessScore}%
                    </div>
                    <div className="stat-label">Data Completeness</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">
                      {fileStats.qualityMetrics.hasRequiredFields ? "✅" : "❌"}
                    </div>
                    <div className="stat-label">Required Fields</div>
                  </div>
                </div>
              </div>

              {/* Detailed Statistics Tabs */}
              <div className="stats-details">
                <div className="stats-tabs">
                  <div className="stats-tab-content">
                    {/* Field Analysis */}
                    <div className="stats-section">
                      <h4>📋 Field Analysis</h4>
                      <div className="field-analysis-grid">
                        {Object.entries(fileStats.fieldAnalysis)
                          .sort(
                            ([, a], [, b]) =>
                              parseFloat(b.completeness) -
                              parseFloat(a.completeness)
                          )
                          .slice(0, 10)
                          .map(([field, analysis]) => (
                            <div key={field} className="field-analysis-item">
                              <div className="field-name">{field}</div>
                              <div className="field-stats">
                                <div className="completeness-bar">
                                  <div
                                    className="completeness-fill"
                                    style={{
                                      width: `${analysis.completeness}%`,
                                    }}
                                  ></div>
                                </div>
                                <div className="field-details">
                                  <span>{analysis.completeness}% complete</span>
                                  <span>
                                    {analysis.uniqueValues} unique values
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* Text Analysis */}
                    {fileStats.textAnalysis.field && (
                      <div className="stats-section">
                        <h4>
                          📝 Text Analysis ({fileStats.textAnalysis.field})
                        </h4>
                        <div className="text-stats-grid">
                          <div className="text-stat">
                            <span className="text-stat-label">Avg Words:</span>
                            <span className="text-stat-value">
                              {fileStats.textAnalysis.avgWordCount}
                            </span>
                          </div>
                          <div className="text-stat">
                            <span className="text-stat-label">
                              Avg Characters:
                            </span>
                            <span className="text-stat-value">
                              {fileStats.textAnalysis.avgCharCount}
                            </span>
                          </div>
                          <div className="text-stat">
                            <span className="text-stat-label">Word Range:</span>
                            <span className="text-stat-value">
                              {fileStats.textAnalysis.minWordCount} -{" "}
                              {fileStats.textAnalysis.maxWordCount}
                            </span>
                          </div>
                        </div>

                        {fileStats.textAnalysis.commonWords && (
                          <div className="common-words">
                            <h5>Most Common Words:</h5>
                            <div className="word-cloud">
                              {fileStats.textAnalysis.commonWords.map(
                                ({ word, count }) => (
                                  <span key={word} className="word-tag">
                                    {word} ({count})
                                  </span>
                                )
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Theme Analysis */}
                    {Object.keys(fileStats.themeAnalysis).length > 0 && (
                      <div className="stats-section">
                        <h4>🎯 Theme Analysis</h4>
                        {Object.entries(fileStats.themeAnalysis).map(
                          ([field, analysis]) => (
                            <div key={field} className="theme-analysis">
                              <h5>{field.replace(/_/g, " ").toUpperCase()}</h5>
                              <div className="theme-stats-grid">
                                <div className="theme-stat">
                                  <span className="theme-stat-label">
                                    Unique Themes:
                                  </span>
                                  <span className="theme-stat-value">
                                    {analysis.uniqueThemes}
                                  </span>
                                </div>
                                <div className="theme-stat">
                                  <span className="theme-stat-label">
                                    Coverage:
                                  </span>
                                  <span className="theme-stat-value">
                                    {analysis.coverage}%
                                  </span>
                                </div>
                              </div>

                              <div className="top-themes">
                                <h6>Top Themes:</h6>
                                <div className="themes-list">
                                  {analysis.topThemes
                                    .slice(0, 5)
                                    .map(({ theme, count, percentage }) => (
                                      <div key={theme} className="theme-item">
                                        <span className="theme-name">
                                          {theme}
                                        </span>
                                        <span className="theme-count">
                                          {count} ({percentage}%)
                                        </span>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    )}

                    {/* Temporal Analysis */}
                    {Object.keys(fileStats.temporalAnalysis).length > 0 && (
                      <div className="stats-section">
                        <h4>📅 Temporal Analysis</h4>
                        {Object.entries(fileStats.temporalAnalysis).map(
                          ([field, analysis]) => (
                            <div key={field} className="temporal-analysis">
                              <h5>{field.replace(/_/g, " ").toUpperCase()}</h5>
                              <div className="temporal-stats">
                                <div className="temporal-stat">
                                  <span className="temporal-stat-label">
                                    Date Range:
                                  </span>
                                  <span className="temporal-stat-value">
                                    {analysis.earliest} - {analysis.latest}
                                  </span>
                                </div>
                                <div className="temporal-stat">
                                  <span className="temporal-stat-label">
                                    Coverage:
                                  </span>
                                  <span className="temporal-stat-value">
                                    {analysis.coverage}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    )}

                    {/* Quality Metrics */}
                    <div className="stats-section">
                      <h4>✅ Data Quality</h4>
                      <div className="quality-metrics">
                        <div className="quality-metric">
                          <span className="quality-label">
                            Overall Completeness:
                          </span>
                          <span className="quality-value">
                            {fileStats.qualityMetrics.completenessScore}%
                          </span>
                        </div>
                        <div className="quality-metric">
                          <span className="quality-label">
                            Duplicate Records:
                          </span>
                          <span className="quality-value">
                            {fileStats.qualityMetrics.duplicateIds}
                            {fileStats.qualityMetrics.duplicateIds === 0
                              ? " ✅"
                              : " ⚠️"}
                          </span>
                        </div>
                        <div className="quality-metric">
                          <span className="quality-label">Empty Records:</span>
                          <span className="quality-value">
                            {fileStats.qualityMetrics.emptyRecords}
                            {fileStats.qualityMetrics.emptyRecords === 0
                              ? " ✅"
                              : " ⚠️"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Data Browser Section */}
          <div className="file-viewer">
            <div className="viewer-header">
              <h3>📄 {selectedFile.name} - Data Browser</h3>
              <div className="viewer-controls">
                <input
                  type="text"
                  placeholder="🔍 Search data..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>
            </div>

            {loadingData ? (
              <div className="loading">🔄 Loading data...</div>
            ) : fileData ? (
              <>
                {renderFileData(fileData)}
                {renderPagination()}
              </>
            ) : (
              <div className="no-data">📋 No data to display</div>
            )}
          </div>
        </>
      )}

      {/* Theme Explorer Interface */}
      {selectedFile &&
        activeMode === "themes" &&
        Object.keys(modifiedThemes).length > 0 && (
          <div className="theme-explorer">
            <div className="theme-explorer-header">
              <h3>🎯 Theme Explorer - {selectedFile.name}</h3>
            </div>

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
              changesLog={changesLog}
              onUndoChange={(changeIndex) => {
                // Implement undo functionality if needed
                console.log("Undo change:", changeIndex);
              }}
            />
          </div>
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
