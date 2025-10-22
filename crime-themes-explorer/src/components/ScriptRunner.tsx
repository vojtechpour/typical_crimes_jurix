import React, {
  useEffect,
  useRef,
  useState,
  useLayoutEffect,
  useCallback,
} from "react";
import {
  FiEdit2,
  FiTrash2,
  FiRefreshCw,
  FiPlus,
  FiLoader,
  FiEdit3,
  FiInfo,
  FiCheckCircle,
  FiXCircle,
} from "react-icons/fi";
import type { IconBaseProps } from "react-icons";
import Modal from "./ui/Modal";

// Typed wrappers to satisfy TS JSX Element return types
const IconCheck: React.FC<IconBaseProps> =
  FiCheckCircle as unknown as React.FC<IconBaseProps>;
const IconX: React.FC<IconBaseProps> =
  FiXCircle as unknown as React.FC<IconBaseProps>;
const IconEdit2: React.FC<IconBaseProps> =
  FiEdit2 as unknown as React.FC<IconBaseProps>;
const IconTrash2: React.FC<IconBaseProps> =
  FiTrash2 as unknown as React.FC<IconBaseProps>;
const IconRefreshCw: React.FC<IconBaseProps> =
  FiRefreshCw as unknown as React.FC<IconBaseProps>;
const IconPlus: React.FC<IconBaseProps> =
  FiPlus as unknown as React.FC<IconBaseProps>;
const IconLoader: React.FC<IconBaseProps> =
  FiLoader as unknown as React.FC<IconBaseProps>;
const IconEdit3: React.FC<IconBaseProps> =
  FiEdit3 as unknown as React.FC<IconBaseProps>;
const IconInfo: React.FC<IconBaseProps> =
  FiInfo as unknown as React.FC<IconBaseProps>;

type LogType = "info" | "error" | "success" | "warning" | "output";

type LogEntry = { id: number; text: string; timestamp: string; type: LogType };

type Completion = {
  caseId: string | number;
  codesText: string | string[];
  timestamp: Date;
  caseText?: string;
  isExisting?: boolean;
  isRegenerated?: boolean;
};

type AnalysisStatus = {
  phase: string;
  currentCase: string | number | null;
  totalCases: number;
  processedCases: number;
  currentBatch: number;
  recentCompletions: Completion[];
  uniqueCodesCount: number;
  estimatedTimeRemaining: string | null;
  apiCalls: number;
  errors: Array<{ message: string; timestamp: Date }>;
  currentDataFile: string | null;
};

type ProgressInfo = {
  current: number;
  total: number;
  percentage: number;
};

type BulkProgress = {
  current: number;
  total: number;
  status: string;
  percentage?: number;
  currentCaseId?: string | number;
} | null;

type UploadedFile = {
  name: string;
  size: number;
  modified: string;
  path: string;
};

type AnalysisResults = {
  progress?: {
    total: number;
    processed: number;
    percentage: number | string;
  };
  recentResults?: Array<{
    id: string | number;
    code: string;
    text: string;
  }>;
  logInfo?: {
    size: number;
    lastModified: string;
  };
};

type CodeGenerationItemProps = {
  completion: Completion;
  onSave: (caseId: string | number, codes: string[]) => void;
  onRegenerate: (
    caseId: string | number,
    caseText: string,
    currentCodes: string
  ) => void;
  onAddMoreCodes: (
    caseId: string | number,
    caseText: string,
    currentCodes: string
  ) => void;
  isSaving: boolean;
  isRegenerating: boolean;
  isAddingMoreCodes: boolean;
};

type RegenerateModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (instructions: string) => void;
  caseText: string;
  currentCodes: string;
};

type AddMoreCodesModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (instructions: string) => void;
  caseText: string;
  currentCodes: string;
};

const RegenerateModal: React.FC<RegenerateModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  caseText,
  currentCodes,
}) => {
  const [instructions, setInstructions] = useState<string>("");

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content regenerate-modal">
        <div className="modal-header">
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconRefreshCw size={16} /> Regenerate Codes
          </h3>
        </div>
        <div className="modal-body">
          {caseText && (
            <div className="case-preview">
              <h4>Case Preview</h4>
              <p className="case-text-preview">{caseText}</p>
            </div>
          )}

          <div className="current-codes">
            <h4>Current Codes</h4>
            <div className="current-codes-display">{currentCodes}</div>
          </div>

          <div className="instructions-input">
            <h4 style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <IconEdit3 size={14} /> Regeneration Instructions
            </h4>
            <p className="instructions-help">
              Provide specific instructions for how you want the codes to be
              generated. The AI will prioritize your guidance while ensuring
              accuracy. Leave blank for comprehensive automatic coding.
            </p>

            <div className="instruction-examples">
              <p>
                <strong>Examples of useful instructions:</strong>
              </p>
              <ul className="example-list">
                <li>
                  "Focus more on victim characteristics and vulnerability
                  factors"
                </li>
                <li>
                  "Use more specific terminology for the type of theft/crime"
                </li>
                <li>"Emphasize environmental and contextual factors"</li>
                <li>
                  "Create codes that highlight offender behavior patterns"
                </li>
                <li>
                  "Generate fewer, more general codes" or "Create more detailed,
                  specific codes"
                </li>
                <li>"Focus on temporal aspects and timing of the crime"</li>
              </ul>
            </div>

            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Enter your specific instructions here, or leave blank for comprehensive automatic coding based on best practices..."
              className="instructions-textarea"
              rows={4}
              autoFocus
            />

            <div
              className="instruction-tip"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <IconInfo size={14} />
              <span>
                <strong>Tip:</strong> The more specific your instructions, the
                better the AI can tailor the codes to your research needs.
              </span>
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button onClick={onClose} className="btn ghost">
            Cancel
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSubmit(instructions);
            }}
            className="btn primary"
            type="button"
          >
            <IconRefreshCw size={14} />
            <span style={{ marginLeft: 6 }}>Regenerate</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const AddMoreCodesModal: React.FC<AddMoreCodesModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  caseText,
  currentCodes,
}) => {
  const [instructions, setInstructions] = useState<string>("");

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content regenerate-modal">
        <div className="modal-header">
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconPlus size={16} /> Add More Codes
          </h3>
        </div>
        <div className="modal-body">
          {caseText && (
            <div className="case-preview">
              <h4>Case Preview</h4>
              <p className="case-text-preview">{caseText}</p>
            </div>
          )}

          <div className="current-codes">
            <h4>Existing Codes (will not be changed)</h4>
            <div className="current-codes-display">{currentCodes}</div>
          </div>

          <div className="instructions-input">
            <h4 style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <IconEdit3 size={14} /> Additional Coding Instructions
            </h4>
            <p className="instructions-help">
              Provide specific instructions for what additional codes you want
              to generate. The AI will add new codes while keeping all existing
              codes unchanged. The new codes will complement your existing
              analysis.
            </p>

            <div className="instruction-examples">
              <p>
                <strong>Examples of useful instructions:</strong>
              </p>
              <ul className="example-list">
                <li>
                  "Add codes focusing on geographic location and setting
                  details"
                </li>
                <li>
                  "Generate codes that capture victim-offender relationship"
                </li>
                <li>"Add codes about property value and damage assessment"</li>
                <li>
                  "Create codes highlighting security measures that were
                  present"
                </li>
                <li>
                  "Add codes about witness presence and community context"
                </li>
                <li>
                  "Generate codes about investigation and evidence details"
                </li>
              </ul>
            </div>

            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Describe what additional aspects of the case you want to code. The existing codes will remain unchanged..."
              className="instructions-textarea"
              rows={4}
              autoFocus
            />

            <div
              className="instruction-tip"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <IconInfo size={14} />
              <span>
                <strong>Tip:</strong> Be specific about what new aspects you
                want to capture. The AI will avoid duplicating your existing
                codes.
              </span>
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button onClick={onClose} className="btn ghost">
            Cancel
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSubmit(instructions);
            }}
            className="btn primary"
            type="button"
          >
            <IconPlus size={14} />
            <span style={{ marginLeft: 6 }}>Add Codes</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const ScriptRunner: React.FC = () => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [output, setOutput] = useState<LogEntry[]>([]);
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [selectedDataFile, setSelectedDataFile] = useState<string>("");
  const [availableFiles, setAvailableFiles] = useState<UploadedFile[]>([]);
  const [filesLoading, setFilesLoading] = useState<boolean>(true);

  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>({
    phase: "Idle",
    currentCase: null,
    totalCases: 0,
    processedCases: 0,
    currentBatch: 0,
    recentCompletions: [],
    uniqueCodesCount: 0,
    estimatedTimeRemaining: null,
    apiCalls: 0,
    errors: [],
    currentDataFile: null,
  });

  const [savingCodes, setSavingCodes] = useState<
    Record<string | number, boolean>
  >({});
  const [regeneratingCodes, setRegeneratingCodes] = useState<
    Record<string | number, boolean>
  >({});
  const [showRegenerateModal, setShowRegenerateModal] =
    useState<boolean>(false);
  const [regenerateModalData, setRegenerateModalData] = useState<{
    caseId: string | number;
    caseText: string;
    currentCodes: string;
  } | null>(null);
  const [showAddMoreCodesModal, setShowAddMoreCodesModal] =
    useState<boolean>(false);
  const [addMoreCodesModalData, setAddMoreCodesModalData] = useState<{
    caseId: string | number;
    caseText: string;
    currentCodes: string;
  } | null>(null);
  const [addingMoreCodes, setAddingMoreCodes] = useState<
    Record<string | number, boolean>
  >({});
  const [globalInstructions, setGlobalInstructions] = useState<string>("");
  const [model, setModel] = useState<string>("gemini-2.0-flash");
  const [selectedInstructionPills, setSelectedInstructionPills] = useState<
    string[]
  >([]);

  // Search, filter, and sort state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterRegeneratedOnly, setFilterRegeneratedOnly] =
    useState<boolean>(false);
  const [sortBy, setSortBy] = useState<"time" | "caseId" | "codeCount">("time");

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [exportFormat, setExportFormat] = useState<"json" | "csv" | "html">(
    "json"
  );

  const wsRef = useRef<WebSocket | null>(null);
  const outputRef = useRef<HTMLDivElement | null>(null);
  const intervalRef = useRef<number | null>(null);
  const globalTextRef = useRef<HTMLTextAreaElement | null>(null);
  const pillsOverlayRef = useRef<HTMLDivElement | null>(null);
  const selectedDataFileRef = useRef<string>("");
  const [pillsOverlayHeight, setPillsOverlayHeight] = useState<number>(0);

  const addOutput = useCallback(
    (text: string, type: LogType = "output", timestamp?: string) => {
      const entryTimestamp = timestamp ?? new Date().toLocaleTimeString();
      setOutput((prev) => {
        const next = [
          ...prev,
          {
            text,
            type,
            timestamp: entryTimestamp,
            id: Date.now() + Math.random(),
          },
        ];
        return next.length > 1000 ? next.slice(-1000) : next;
      });
    },
    []
  );

  const fetchResults = useCallback(async () => {
    try {
      const response = await fetch("/api/results/latest");
      if (!response.ok) {
        throw new Error(`Failed to fetch results: ${response.status}`);
      }
      const data: AnalysisResults = await response.json();
      setResults(data);
    } catch (err) {
      console.error("Failed to fetch latest results:", err);
    }
  }, []);

  const loadAvailableFiles = useCallback(async () => {
    try {
      setFilesLoading(true);
      const response = await fetch("/api/data-files");
      if (!response.ok) {
        throw new Error(`Failed to load data files: ${response.status}`);
      }
      const files: UploadedFile[] = await response.json();
      setAvailableFiles(files);
    } catch (err) {
      console.error("Failed to load available files:", err);
    } finally {
      setFilesLoading(false);
    }
  }, []);

  const loadExistingCodes = useCallback(
    async (filename: string) => {
      console.log(
        "[P2 Load Codes] Starting to load existing codes for file:",
        filename
      );
      try {
        const url = `/api/data/${encodeURIComponent(filename)}/codes?limit=100`;
        console.log("[P2 Load Codes] Fetching from URL:", url);
        const response = await fetch(url);
        console.log(
          "[P2 Load Codes] Response status:",
          response.status,
          response.ok
        );
        const result = await response.json();
        console.log("[P2 Load Codes] Response data:", result);
        if (response.ok) {
          console.log(
            "[P2 Load Codes] Successfully loaded codes from API:",
            result.cases?.length || 0,
            "cases"
          );
          console.log("[P2 Load Codes] Statistics:", result.statistics);
          const case31745873 = result.cases.find(
            (c: any) => c.caseId === "31745873"
          );
          if (case31745873) {
            console.log("DEBUG: Case 31745873 from API:", {
              hasCaseText: !!case31745873.caseText,
              caseTextLength: case31745873.caseText?.length || 0,
              caseTextPreview: case31745873.caseText?.substring(0, 100) || "",
            });
          }
          const existingCompletions: Completion[] = result.cases.map(
            (case_: any) => ({
              caseId: case_.caseId,
              codesText: Array.isArray(case_.codes)
                ? case_.codes
                : typeof case_.codes === "string"
                ? case_.codes
                : [case_.codes],
              timestamp: new Date(case_.timestamp),
              caseText: case_.caseText || "",
              isExisting: true,
            })
          );
          console.log("DEBUG: Mapped completions:", existingCompletions.length);
          const mapped31745873 = existingCompletions.find(
            (c) => c.caseId === "31745873"
          );
          if (mapped31745873) {
            console.log("DEBUG: Case 31745873 mapped:", {
              hasCaseText: !!mapped31745873.caseText,
              caseTextLength: mapped31745873.caseText?.length || 0,
              caseTextPreview: mapped31745873.caseText?.substring(0, 100) || "",
            });
          }
          console.log(
            "[P2 Load Codes] Setting analysis status with completions:",
            existingCompletions.length
          );
          setAnalysisStatus((prev) => ({
            ...prev,
            totalCases: result.statistics.totalCases,
            processedCases: result.statistics.processedCases,
            uniqueCodesCount: result.statistics.uniqueCodesCount,
            recentCompletions: existingCompletions,
            currentDataFile: filename,
          }));
          console.log("[P2 Load Codes] Analysis status updated");
          addOutput(
            `📂 Loaded ${result.statistics.processedCases} existing codes from ${filename}`,
            "info"
          );
        } else {
          console.error("[P2 Load Codes] API returned error:", result.error);
          throw new Error(result.error || "Failed to load existing codes");
        }
      } catch (e: any) {
        console.error("[P2 Load Codes] Error loading codes:", e);
        addOutput(`❌ Failed to load existing codes: ${e.message}`, "error");
      }
    },
    [addOutput]
  );

  const handleMessage = useCallback(
    (event: MessageEvent<string>) => {
      try {
        const message = JSON.parse(event.data);
        switch (message.type) {
          case "progressUpdate": {
            const progressData = message.data as any;
            console.log(
              "[P2 WebSocket] Progress update received for case:",
              progressData.case_id
            );
            setAnalysisStatus((prev) => {
              const newCompletion: Completion = {
                caseId: progressData.case_id,
                codesText: Array.isArray(progressData.codes)
                  ? JSON.stringify(progressData.codes)
                  : typeof progressData.codes === "string"
                  ? progressData.codes
                  : JSON.stringify([progressData.codes]),
                timestamp: new Date(progressData.timestamp),
                caseText:
                  progressData.case_text ||
                  (progressData.progress && progressData.progress.case_text) ||
                  "",
              };

              const existingIndex = prev.recentCompletions.findIndex(
                (completion) => completion.caseId === progressData.case_id
              );

              let updatedCompletions: Completion[];
              if (existingIndex >= 0) {
                updatedCompletions = [...prev.recentCompletions];
                updatedCompletions[existingIndex] = newCompletion;
              } else {
                updatedCompletions = [newCompletion, ...prev.recentCompletions];
              }
              updatedCompletions = updatedCompletions.slice(0, 100);

              return {
                ...prev,
                processedCases: progressData.progress.processed,
                totalCases: progressData.progress.total,
                uniqueCodesCount: progressData.progress.unique_codes,
                currentCase: progressData.case_id,
                recentCompletions: updatedCompletions,
                apiCalls: prev.apiCalls + 1,
              };
            });
            break;
          }
          case "phaseUpdate": {
            const phaseData = message.data as any;
            setAnalysisStatus((prev) => ({
              ...prev,
              phase: phaseData.phase,
              totalCases: phaseData.details.total_cases || prev.totalCases,
              processedCases:
                phaseData.details.processed_cases || prev.processedCases,
              uniqueCodesCount:
                phaseData.details.unique_codes || prev.uniqueCodesCount,
              currentDataFile:
                phaseData.details.data_file || prev.currentDataFile,
            }));
            break;
          }
          case "bulkProgressUpdate": {
            const bulkData = message.data as any;
            if (bulkData.case_id) {
              addOutput(
                `🔄 Regenerating case ${bulkData.case_id}... (${bulkData.current}/${bulkData.total})`,
                "info"
              );
            } else if (
              bulkData.current === bulkData.total &&
              bulkData.total > 0
            ) {
              addOutput(
                `✅ Bulk regeneration completed! Updated ${bulkData.total} cases.`,
                "success"
              );
            }
            break;
          }
          case "output": {
            const level: LogType =
              typeof message.level === "string" &&
              ["info", "error", "success", "warning", "output"].includes(
                message.level
              )
                ? (message.level as LogType)
                : "info";
            addOutput(message.text, level, message.timestamp);
            break;
          }
          case "script_started": {
            setIsRunning(true);
            setStartTime(Date.now());
            setAnalysisStatus((prev) => ({
              ...prev,
              phase: "Starting",
              apiCalls: 0,
              errors: [],
              currentDataFile:
                selectedDataFileRef.current || prev.currentDataFile,
            }));
            break;
          }
          case "script_stopped":
          case "script_finished": {
            setIsRunning(false);
            setAnalysisStatus((prev) => ({
              ...prev,
              phase:
                message.type === "script_finished" ? "Complete" : "Stopped",
            }));
            break;
          }
          case "script_error": {
            setAnalysisStatus((prev) => ({
              ...prev,
              errors: [
                ...prev.errors,
                {
                  message: message.data,
                  timestamp: new Date(message.timestamp),
                },
              ].slice(-100),
            }));
            break;
          }
          default: {
            if (message.data && typeof message.data === "string") {
              addOutput(message.data, "info");
            }
          }
        }
      } catch {
        // ignore parse errors
      }
    },
    [addOutput]
  );

  useEffect(() => {
    selectedDataFileRef.current = selectedDataFile;
  }, [selectedDataFile]);

  const connectWebSocket = useCallback(() => {
    const ws = new WebSocket("ws://localhost:9000");
    wsRef.current = ws;

    ws.onopen = () => {};
    ws.onmessage = (event: MessageEvent<string>) => handleMessage(event);
    ws.onclose = () => {
      setTimeout(connectWebSocket, 3000);
    };
    ws.onerror = () => {};
  }, [handleMessage]);

  const checkScriptStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/script/status");
      if (!response.ok) {
        throw new Error(`Failed to check status: ${response.status}`);
      }
      const data = await response.json();
      setIsRunning(Boolean(data.running));
      if (data.running) {
        fetchResults();
      }
    } catch (err) {
      console.error("Failed to check script status:", err);
    }
  }, [fetchResults]);

  // Persist and restore selected file
  useEffect(() => {
    if (selectedDataFile) {
      console.log(
        "[P2 Persist] Saving selected file to localStorage:",
        selectedDataFile
      );
      localStorage.setItem("p2_selectedDataFile", selectedDataFile);
    }
  }, [selectedDataFile]);

  useEffect(() => {
    console.log("[P2 Init] Component initializing...");
    connectWebSocket();
    checkScriptStatus();
    loadAvailableFiles();

    // Restore previously selected file and load its existing codes
    const savedFile = localStorage.getItem("p2_selectedDataFile");
    console.log("[P2 Init] Retrieved saved file from localStorage:", savedFile);
    if (savedFile) {
      console.log(
        "[P2 Init] Restoring file and loading existing codes:",
        savedFile
      );
      setSelectedDataFile(savedFile);
      loadExistingCodes(savedFile);
    } else {
      console.log("[P2 Init] No saved file found in localStorage");
    }

    const handleSwitchToDataBrowser = (event: Event) => {
      const anyEvent = event as CustomEvent<{
        tab?: number;
        filename?: string;
      }>;
      if (anyEvent.detail?.filename) {
        window.dispatchEvent(
          new CustomEvent("switchTab", {
            detail: { tab: 0, filename: anyEvent.detail.filename },
          })
        );
      } else {
        window.dispatchEvent(
          new CustomEvent("switchTab", { detail: { tab: 0 } })
        );
      }
    };

    window.addEventListener(
      "switchToDataBrowser",
      handleSwitchToDataBrowser as EventListener
    );

    return () => {
      window.removeEventListener(
        "switchToDataBrowser",
        handleSwitchToDataBrowser as EventListener
      );
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [
    connectWebSocket,
    checkScriptStatus,
    loadAvailableFiles,
    loadExistingCodes,
  ]);

  useEffect(() => {
    if (!isRunning || !startTime) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = window.setInterval(() => {
      setDuration(Date.now() - startTime);
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, startTime]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const hasAnyInstruction = () =>
    selectedInstructionPills.length > 0 || (globalInstructions || "").trim();

  const buildEffectiveInstructions = () => {
    const pillsText = selectedInstructionPills.join(". ");
    const freeText = (globalInstructions || "").trim();
    return [pillsText, freeText].filter(Boolean).join(". ").trim();
  };

  const toggleInstructionPill = (pill: string) => {
    setSelectedInstructionPills((prev) =>
      prev.includes(pill) ? prev.filter((p) => p !== pill) : [...prev, pill]
    );
  };

  const startScript = async () => {
    try {
      setError(null);
      const effectiveInstructions = buildEffectiveInstructions();
      const response = await fetch("/api/script/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataFile: selectedDataFile,
          globalInstructions: effectiveInstructions,
          model,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setIsRunning(true);
        setStartTime(Date.now());
        const methodUsed = hasAnyInstruction()
          ? "with custom instructions"
          : "using best practices";
        addOutput(`🔄 Starting Phase 2 analysis ${methodUsed}...`, "info");
      } else {
        setError(data.error || "Failed to start script");
        addOutput(`❌ Error: ${data.error}`, "error");
      }
    } catch (e: any) {
      setError("Failed to start script: " + e.message);
      addOutput(`❌ Error: ${e.message}`, "error");
    }
  };

  const stopScript = async () => {
    try {
      const response = await fetch("/api/script/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (response.ok) {
        setIsRunning(false);
        addOutput("⏹️ Stop request sent...", "warning");
      } else {
        setError(data.error || "Failed to stop script");
      }
    } catch (e: any) {
      setError("Failed to stop script: " + e.message);
    }
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const clearOutput = () => {
    setOutput([]);
    setProgress(null);
    setError(null);
    setAnalysisStatus({
      phase: "Idle",
      currentCase: null,
      totalCases: 0,
      processedCases: 0,
      currentBatch: 0,
      recentCompletions: [],
      uniqueCodesCount: 0,
      estimatedTimeRemaining: null,
      apiCalls: 0,
      errors: [],
      currentDataFile: null,
    });
  };

  const handleDeleteSelectedFile = async () => {
    if (!selectedDataFile) return;
    const confirmDelete = window.confirm(
      `Delete file "${selectedDataFile}" from uploads? This cannot be undone.`
    );
    if (!confirmDelete) return;
    try {
      const response = await fetch(
        `/api/data/${encodeURIComponent(selectedDataFile)}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        }
      );
      const result = await response.json();
      if (response.ok) {
        addOutput(`🗑️ Deleted file ${selectedDataFile}`, "warning");
        setSelectedDataFile("");
        setAnalysisStatus((prev) => ({
          ...prev,
          totalCases: 0,
          processedCases: 0,
          uniqueCodesCount: 0,
          recentCompletions: [],
          currentDataFile: null,
        }));
        await loadAvailableFiles();
      } else {
        throw new Error(result.error || "Failed to delete file");
      }
    } catch (e: any) {
      addOutput(`❌ Failed to delete file: ${e.message}`, "error");
    }
  };

  // Filter and sort completions
  const getFilteredAndSortedCompletions = useCallback(() => {
    let filtered = [...analysisStatus.recentCompletions];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((completion) => {
        const caseIdMatch = String(completion.caseId)
          .toLowerCase()
          .includes(query);
        const codesText = Array.isArray(completion.codesText)
          ? completion.codesText.join(" ")
          : completion.codesText;
        const codesMatch = codesText.toLowerCase().includes(query);
        const caseTextMatch =
          completion.caseText?.toLowerCase().includes(query) || false;
        return caseIdMatch || codesMatch || caseTextMatch;
      });
    }

    // Apply regenerated filter
    if (filterRegeneratedOnly) {
      filtered = filtered.filter((c) => c.isRegenerated);
    }

    // Apply sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "time":
          return (
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
        case "caseId":
          return String(a.caseId).localeCompare(String(b.caseId));
        case "codeCount": {
          const aCount = Array.isArray(a.codesText) ? a.codesText.length : 1;
          const bCount = Array.isArray(b.codesText) ? b.codesText.length : 1;
          return bCount - aCount;
        }
        default:
          return 0;
      }
    });

    return filtered;
  }, [
    analysisStatus.recentCompletions,
    searchQuery,
    filterRegeneratedOnly,
    sortBy,
  ]);

  // Get paginated completions
  const getPaginatedCompletions = useCallback(() => {
    const filtered = getFilteredAndSortedCompletions();
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filtered.slice(startIndex, endIndex);
  }, [getFilteredAndSortedCompletions, currentPage, itemsPerPage]);

  // Calculate total pages
  const totalPages = Math.ceil(
    getFilteredAndSortedCompletions().length / itemsPerPage
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterRegeneratedOnly, sortBy, itemsPerPage]);

  const handleDeleteAllCodes = async () => {
    const currentFile = analysisStatus.currentDataFile || selectedDataFile;
    if (!currentFile) {
      addOutput("❌ No data file selected", "error");
      return;
    }
    const filename = currentFile.includes("/")
      ? currentFile.split("/").pop()!
      : currentFile;
    const confirmed = window.confirm(
      `Delete all initial codes in "${filename}"? This cannot be undone.`
    );
    if (!confirmed) return;
    try {
      const res = await fetch(
        `/api/data/${encodeURIComponent(filename)}/codes`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to delete codes");
      addOutput(
        `🗑️ Deleted initial codes in ${result.casesCleared} cases from ${filename}`,
        "warning"
      );
      setAnalysisStatus((prev) => ({
        ...prev,
        processedCases: 0,
        uniqueCodesCount: 0,
        recentCompletions: [],
      }));
      if (filename) await loadExistingCodes(filename);
    } catch (e: any) {
      addOutput(`❌ Failed to delete all codes: ${e.message}`, "error");
    }
  };

  const handleCodeSave = async (caseId: string | number, codes: string[]) => {
    try {
      setSavingCodes((prev) => ({ ...prev, [caseId]: true }));
      const currentFile = analysisStatus.currentDataFile || selectedDataFile;
      if (!currentFile) {
        addOutput(
          "❌ Error: No data file available for saving changes",
          "error"
        );
        return;
      }
      const filename = currentFile.includes("/")
        ? currentFile.split("/").pop()!
        : currentFile;
      const response = await fetch(
        `/api/data/${encodeURIComponent(filename)}/case/${encodeURIComponent(
          caseId
        )}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ codes }),
        }
      );
      const result = await response.json();
      if (response.ok) {
        setAnalysisStatus((prev) => ({
          ...prev,
          recentCompletions: prev.recentCompletions.map((completion) =>
            completion.caseId === caseId
              ? { ...completion, codesText: codes }
              : completion
          ),
        }));
        addOutput(
          `✅ Saved codes for case ${caseId} to ${filename}`,
          "success"
        );
      } else {
        throw new Error(result.error || "Failed to save codes");
      }
    } catch (e: any) {
      addOutput(
        `❌ Failed to save codes for case ${caseId}: ${e.message}`,
        "error"
      );
    } finally {
      setSavingCodes((prev) => {
        const updated = { ...prev };
        delete updated[caseId];
        return updated;
      });
    }
  };

  const downloadGeneratedCodes = () => {
    const codesData = {
      export_timestamp: new Date().toISOString(),
      total_cases_processed: analysisStatus.processedCases,
      generated_codes: analysisStatus.recentCompletions.map((completion) => ({
        case_id: completion.caseId,
        codes: completion.codesText,
        timestamp: completion.timestamp.toISOString(),
      })),
    };
    const blob = new Blob([JSON.stringify(codesData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `generated_codes_${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/:/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadGeneratedCodesCSV = () => {
    const header = ["case_id", "codes", "timestamp", "case_text"];

    const escapeCsv = (value: any): string => {
      const text = value == null ? "" : String(value);
      const needsQuoting = /[",\n]/.test(text);
      const escaped = text.replace(/"/g, '""');
      return needsQuoting ? `"${escaped}"` : escaped;
    };

    const rows = analysisStatus.recentCompletions.map((completion) => {
      let codesArray: string[] = [];
      try {
        if (Array.isArray(completion.codesText)) {
          codesArray = completion.codesText.map(String);
        } else if (typeof completion.codesText === "string") {
          try {
            const parsed = JSON.parse(completion.codesText.replace(/'/g, '"'));
            codesArray = Array.isArray(parsed)
              ? parsed.map(String)
              : [String(parsed)];
          } catch {
            codesArray = [completion.codesText];
          }
        } else {
          codesArray = [String(completion.codesText)];
        }
      } catch {
        codesArray = [String(completion.codesText)];
      }

      const joinedCodes = codesArray.join(" | ");
      return [
        escapeCsv(completion.caseId),
        escapeCsv(joinedCodes),
        escapeCsv(completion.timestamp?.toISOString?.() || ""),
        escapeCsv(completion.caseText || ""),
      ].join(",");
    });

    const csvContent = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `generated_codes_${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/:/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadGeneratedCodesHTML = () => {
    const rowsHtml = analysisStatus.recentCompletions
      .map((completion) => {
        let codesArray: string[] = [];
        try {
          if (Array.isArray(completion.codesText)) {
            codesArray = completion.codesText.map(String);
          } else if (typeof completion.codesText === "string") {
            try {
              const parsed = JSON.parse(
                completion.codesText.replace(/'/g, '"')
              );
              codesArray = Array.isArray(parsed)
                ? parsed.map(String)
                : [String(parsed)];
            } catch {
              codesArray = [completion.codesText];
            }
          } else {
            codesArray = [String(completion.codesText)];
          }
        } catch {
          codesArray = [String(completion.codesText)];
        }

        const joinedCodes = codesArray.join(" | ");
        const ts = completion.timestamp?.toISOString?.() || "";
        const safe = (s: string) =>
          (s || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        return `<tr><td>${safe(String(completion.caseId))}</td><td>${safe(
          joinedCodes
        )}</td><td>${safe(ts)}</td><td>${safe(
          completion.caseText || ""
        )}</td></tr>`;
      })
      .join("");

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Generated Codes Report</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:24px;color:#222}
    h1{margin:0 0 12px 0;font-size:20px}
    .meta{color:#666;margin-bottom:16px}
    table{border-collapse:collapse;width:100%}
    th,td{border:1px solid #ddd;padding:8px;vertical-align:top}
    th{background:#f6f6f6;text-align:left}
    tr:nth-child(even){background:#fafafa}
    code{white-space:pre-wrap}
  </style>
  </head>
  <body>
    <h1>Generated Codes</h1>
    <div class="meta">Exported at ${new Date().toISOString()}</div>
    <table>
      <thead><tr><th>Case ID</th><th>Codes</th><th>Timestamp</th><th>Case Text</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </body>
  </html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `generated_codes_${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/:/g, "-")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenExport = () => setShowExportModal(true);
  const handleConfirmExport = () => {
    try {
      if (exportFormat === "json") downloadGeneratedCodes();
      else if (exportFormat === "csv") downloadGeneratedCodesCSV();
      else downloadGeneratedCodesHTML();
    } finally {
      setShowExportModal(false);
    }
  };

  const CodeGenerationItem: React.FC<CodeGenerationItemProps> = ({
    completion,
    onSave,
    onRegenerate,
    onAddMoreCodes,
    isSaving,
    isRegenerating,
    isAddingMoreCodes,
  }) => {
    const [editedCodes, setEditedCodes] = useState<string[]>([]);
    const [editingIndex, setEditingIndex] = useState<number>(-1);
    const [editValue, setEditValue] = useState<string>("");
    const [caseTextExpanded, setCaseTextExpanded] = useState<boolean>(false);

    const truncateLength = 200;
    const shouldTruncate =
      completion.caseText && completion.caseText.length > truncateLength;
    const displayText =
      shouldTruncate && !caseTextExpanded
        ? (completion.caseText || "").substring(0, truncateLength) + "..."
        : completion.caseText || "";

    useEffect(() => {
      try {
        let codes: any = null;
        if (Array.isArray(completion.codesText)) {
          codes = completion.codesText;
        } else if (typeof completion.codesText === "string") {
          try {
            codes = JSON.parse(completion.codesText.replace(/'/g, '"'));
          } catch {
            codes = [completion.codesText];
          }
        } else {
          codes = [String(completion.codesText)];
        }
        const codesArray = Array.isArray(codes) ? codes : [codes];
        const cleanCodes = codesArray
          .map((code: any) => String(code).trim())
          .filter((code: string) => code.length > 0);
        setEditedCodes(
          cleanCodes.length > 0 ? cleanCodes : ["No codes generated"]
        );
      } catch {
        setEditedCodes([completion.codesText || "Error parsing codes"] as any);
      }
    }, [completion.codesText]);

    const handleStartEdit = (index: number) => {
      setEditingIndex(index);
      setEditValue(editedCodes[index] || "");
    };

    const handleSaveEdit = () => {
      if (editingIndex < 0) return;

      const trimmedValue = editValue.trim();

      if (trimmedValue) {
        const updatedCodes = [...editedCodes];
        updatedCodes[editingIndex] = trimmedValue;
        setEditedCodes(updatedCodes);
        onSave(completion.caseId, updatedCodes);
        setEditingIndex(-1);
        setEditValue("");
        return;
      }

      const isNewEmptyCode = editedCodes[editingIndex] === "";

      if (isNewEmptyCode) {
        const updatedCodes = editedCodes.filter(
          (_, idx) => idx !== editingIndex
        );
        setEditedCodes(
          updatedCodes.length > 0 ? updatedCodes : ["No codes generated"]
        );
      }

      setEditingIndex(-1);
      setEditValue("");
    };

    const handleCancelEdit = () => {
      if (editingIndex >= 0 && editedCodes[editingIndex] === "") {
        const updatedCodes = editedCodes.filter(
          (_, idx) => idx !== editingIndex
        );
        setEditedCodes(
          updatedCodes.length > 0 ? updatedCodes : ["No codes generated"]
        );
      }
      setEditingIndex(-1);
      setEditValue("");
    };

    const handleDeleteCode = (index: number) => {
      const updatedCodes = editedCodes.filter((_, i) => i !== index);
      const finalCodes =
        updatedCodes.length > 0 ? updatedCodes : ["No codes generated"];
      setEditedCodes(finalCodes);
      onSave(completion.caseId, finalCodes);
    };

    const handleAddNewCode = () => {
      const updatedCodes = [
        ...editedCodes.filter((code) => code !== "No codes generated"),
        "",
      ];
      setEditedCodes(updatedCodes);
      setEditingIndex(updatedCodes.length - 1);
      setEditValue("");
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") handleSaveEdit();
      else if (e.key === "Escape") handleCancelEdit();
    };

    const handleRegenerate = () => {
      onRegenerate(
        completion.caseId,
        completion.caseText || "",
        typeof completion.codesText === "string"
          ? completion.codesText
          : JSON.stringify(completion.codesText)
      );
    };

    const handleAddMoreCodes = () => {
      onAddMoreCodes(
        completion.caseId,
        completion.caseText || "",
        typeof completion.codesText === "string"
          ? completion.codesText
          : JSON.stringify(completion.codesText)
      );
    };

    return (
      <div className="code-generation-item">
        <div className="item-header">
          <div className="case-info">
            <span className="case-id">Case {completion.caseId}</span>
            {/* Removed Existing indicator per request */}
            {completion.isRegenerated && (
              <span
                className="regenerated-indicator"
                title="Codes regenerated with custom instructions"
              >
                🔄 Regenerated
              </span>
            )}
            <span className="generation-time">
              {completion.timestamp.toLocaleTimeString()}
            </span>
          </div>
          <div className="item-actions">
            <button
              className="regenerate-btn"
              onClick={handleRegenerate}
              type="button"
              title="Regenerate codes with custom instructions"
              disabled={isSaving || isRegenerating || isAddingMoreCodes}
            >
              {isRegenerating ? (
                <>
                  <IconLoader size={14} />
                  <span style={{ marginLeft: 6 }}>Regenerating...</span>
                </>
              ) : (
                <>
                  <IconRefreshCw size={14} />
                  <span style={{ marginLeft: 6 }}>Regenerate</span>
                </>
              )}
            </button>
            <button
              className="add-more-codes-btn"
              onClick={handleAddMoreCodes}
              type="button"
              title="Add more codes with AI assistance"
              disabled={isSaving || isRegenerating || isAddingMoreCodes}
            >
              {isAddingMoreCodes ? (
                <>
                  <IconLoader size={14} />
                  <span style={{ marginLeft: 6 }}>Adding...</span>
                </>
              ) : (
                <>
                  <IconPlus size={14} />
                  <span style={{ marginLeft: 6 }}>Add More Codes</span>
                </>
              )}
            </button>
            <button
              className="add-code-btn"
              onClick={handleAddNewCode}
              type="button"
              title="Add new code"
              disabled={isSaving || isRegenerating || isAddingMoreCodes}
            >
              {isSaving ? (
                <>
                  <IconLoader size={14} />
                  <span style={{ marginLeft: 6 }}>Saving...</span>
                </>
              ) : (
                <>
                  <IconPlus size={14} />
                  <span style={{ marginLeft: 6 }}>Add Code</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="case-text-section">
          <div className="case-text-header">
            <h6>Case Description</h6>
            {shouldTruncate && (
              <button
                className="expand-text-btn"
                onClick={() => setCaseTextExpanded(!caseTextExpanded)}
                type="button"
              >
                {caseTextExpanded ? "Show Less" : "Show More"}
              </button>
            )}
          </div>
          <div className="case-text-content">
            <p className="case-text">
              {displayText || (
                <span
                  style={{ color: "var(--text-muted)", fontStyle: "italic" }}
                >
                  Case text not available
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="codes-content">
          <div className="codes-display">
            <div className="codes-tags">
              {editedCodes.map((code, index) => (
                <div key={index} className="code-tag-container">
                  {editingIndex === index ? (
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
                          <IconCheck size={12} />
                        </button>
                        <button
                          className="cancel-inline-btn"
                          onClick={handleCancelEdit}
                          type="button"
                          title="Cancel"
                        >
                          <IconX size={12} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="code-tag-wrapper">
                      <span className="code-tag">{code}</span>
                      {code !== "No codes generated" &&
                        code !== "Error parsing codes" && (
                          <div className="code-actions">
                            <button
                              className="edit-code-btn"
                              onClick={() => handleStartEdit(index)}
                              type="button"
                              title="Edit code"
                              disabled={isSaving}
                            >
                              <IconEdit2 size={12} />
                            </button>
                            {editedCodes.length > 1 && (
                              <button
                                className="delete-code-btn"
                                onClick={() => handleDeleteCode(index)}
                                type="button"
                                title="Delete code"
                                disabled={isSaving}
                              >
                                <IconTrash2 size={12} />
                              </button>
                            )}
                          </div>
                        )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleRegenerateRequest = (
    caseId: string | number,
    caseText: string,
    currentCodes: string
  ) => {
    setRegenerateModalData({ caseId, caseText, currentCodes });
    setShowRegenerateModal(true);
  };

  const handleRegenerateSubmit = async (instructions: string) => {
    if (!regenerateModalData) return;
    const { caseId } = regenerateModalData;
    try {
      setRegeneratingCodes((prev) => ({ ...prev, [caseId]: true }));
      setShowRegenerateModal(false);
      const currentFile = analysisStatus.currentDataFile || selectedDataFile;
      if (!currentFile)
        throw new Error("No data file available for regeneration");
      const filename = currentFile.includes("/")
        ? currentFile.split("/").pop()!
        : currentFile;
      addOutput(`🔄 Regenerating codes for case ${caseId}...`, "info");
      const response = await fetch(
        `/api/data/${encodeURIComponent(filename)}/case/${encodeURIComponent(
          caseId
        )}/regenerate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instructions: instructions.trim(),
            model,
          }),
        }
      );
      const result = await response.json();
      if (response.ok) {
        setAnalysisStatus((prev) => ({
          ...prev,
          recentCompletions: prev.recentCompletions.map((completion) =>
            completion.caseId === caseId
              ? {
                  ...completion,
                  codesText: result.codes,
                  timestamp: new Date(),
                  isRegenerated: true,
                }
              : completion
          ),
        }));
        const methodUsed = instructions.trim()
          ? `with custom instructions using model: ${model}`
          : `using best practices with model: ${model}`;
        addOutput(
          `✅ Successfully regenerated codes for case ${caseId} ${methodUsed}`,
          "success"
        );
      } else {
        throw new Error(result.error || "Failed to regenerate codes");
      }
    } catch (e: any) {
      addOutput(
        `❌ Failed to regenerate codes for case ${caseId}: ${e.message}`,
        "error"
      );
    } finally {
      setRegeneratingCodes((prev) => {
        const updated = { ...prev } as Record<string | number, boolean>;
        delete updated[caseId];
        return updated;
      });
      setRegenerateModalData(null);
    }
  };

  const handleRegenerateCancel = () => {
    setShowRegenerateModal(false);
    setRegenerateModalData(null);
  };

  const handleAddMoreCodesRequest = (
    caseId: string | number,
    caseText: string,
    currentCodes: string
  ) => {
    setAddMoreCodesModalData({ caseId, caseText, currentCodes });
    setShowAddMoreCodesModal(true);
  };

  const handleAddMoreCodesSubmit = async (instructions: string) => {
    if (!addMoreCodesModalData) return;
    const { caseId } = addMoreCodesModalData;
    try {
      setAddingMoreCodes((prev) => ({ ...prev, [caseId]: true }));
      setShowAddMoreCodesModal(false);
      const currentFile = analysisStatus.currentDataFile || selectedDataFile;
      if (!currentFile)
        throw new Error("No data file available for adding more codes");
      const filename = currentFile.includes("/")
        ? currentFile.split("/").pop()!
        : currentFile;
      addOutput(`✨ Adding more codes for case ${caseId}...`, "info");
      const response = await fetch(
        `/api/data/${encodeURIComponent(filename)}/case/${encodeURIComponent(
          caseId
        )}/add-codes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instructions: instructions.trim(),
            model,
          }),
        }
      );
      const result = await response.json();
      if (response.ok) {
        setAnalysisStatus((prev) => ({
          ...prev,
          recentCompletions: prev.recentCompletions.map((completion) =>
            completion.caseId === caseId
              ? {
                  ...completion,
                  codesText: result.codes,
                  timestamp: new Date(),
                  isRegenerated: true,
                }
              : completion
          ),
        }));
        const methodUsed = instructions.trim()
          ? `with custom instructions using model: ${model}`
          : `using best practices with model: ${model}`;
        addOutput(
          `✅ Successfully added ${result.addedCount} new codes for case ${caseId} ${methodUsed}`,
          "success"
        );
      } else {
        throw new Error(result.error || "Failed to add more codes");
      }
    } catch (e: any) {
      addOutput(
        `❌ Failed to add more codes for case ${caseId}: ${e.message}`,
        "error"
      );
    } finally {
      setAddingMoreCodes((prev) => {
        const updated = { ...prev } as Record<string | number, boolean>;
        delete updated[caseId];
        return updated;
      });
      setAddMoreCodesModalData(null);
    }
  };

  const handleAddMoreCodesCancel = () => {
    setShowAddMoreCodesModal(false);
    setAddMoreCodesModalData(null);
  };

  const handleGlobalKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Backspace" && e.key !== "Delete") return;
    const textarea = e.currentTarget;
    const hasSelection = textarea.selectionStart !== textarea.selectionEnd;
    if (hasSelection) return;
    const caretIndex = textarea.selectionStart;
    const isAtStartOrOnlyWhitespaceBefore =
      caretIndex === 0 ||
      globalInstructions.slice(0, caretIndex).trim().length === 0;
    if (
      isAtStartOrOnlyWhitespaceBefore &&
      selectedInstructionPills.length > 0
    ) {
      e.preventDefault();
      setSelectedInstructionPills((prev) => prev.slice(0, -1));
    }
  };

  // Adjust textarea padding to account for pills overlay height
  useLayoutEffect(() => {
    const measure = () => {
      const el = pillsOverlayRef.current;
      if (!el) {
        setPillsOverlayHeight(0);
        return;
      }
      setPillsOverlayHeight(el.offsetHeight + 12);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [selectedInstructionPills.length]);

  return (
    <div className="script-runner">
      <div className="toolbar">
        <button
          onClick={startScript}
          disabled={isRunning}
          className="btn primary"
        >
          {isRunning
            ? "Running..."
            : analysisStatus.processedCases > 0
            ? "Continue with the analysis"
            : "Start analysis"}
        </button>
        {!isRunning &&
          analysisStatus.processedCases > 0 &&
          analysisStatus.totalCases > 0 && (
            <span className="badge info" style={{ marginLeft: 8 }}>
              {analysisStatus.processedCases}/{analysisStatus.totalCases}
            </span>
          )}
        <button
          onClick={stopScript}
          disabled={!isRunning}
          className="btn danger"
        >
          Stop
        </button>
        <button onClick={clearOutput} className="btn subtle">
          Clear output
        </button>
        <button onClick={fetchResults} className="btn subtle">
          Refresh results
        </button>
        <div className="row" style={{ alignItems: "center" }}>
          <label htmlFor="model-select" className="muted">
            Model
          </label>
          <select
            id="model-select"
            className="select"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
            <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
            <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
            <option value="claude-sonnet-4-5-20250929">
              Claude Sonnet 4.5
            </option>
            <option value="claude-3-5-sonnet-20241022">
              Claude 3.5 Sonnet
            </option>
            <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
            <option value="gpt-5-2025-08-07">gpt-5-2025-08-07</option>
            <option value="gpt-5-mini-2025-08-07">gpt-5-mini-2025-08-07</option>
            <option value="gpt-5-nano-2025-08-07">gpt-5-nano-2025-08-07</option>
          </select>
        </div>
        <span className="spacer" />
        <span className="badge">{isRunning ? "Running" : "Stopped"}</span>
        {duration > 0 && (
          <span className="badge info" title="Elapsed time">
            {formatDuration(duration)}
          </span>
        )}
      </div>

      {progress && (
        <div className="progress-section">
          <div className="progress-info">
            <span>
              Progress: {progress.current}/{progress.total} (
              {progress.percentage}%)
            </span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress.percentage}%` }}
            ></div>
          </div>
        </div>
      )}

      {error && <div className="badge warning">{error}</div>}

      <section className="card">
        <div className="card-header row">
          <h3>Select data file for analysis</h3>
        </div>
        <div className="card-body">
          {filesLoading ? null : availableFiles.length === 0 ? (
            <div className="no-files-available">
              <p>No files available for analysis.</p>
              <p>
                <button
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent("switchToDataBrowser"))
                  }
                  className="btn subtle"
                >
                  Go to Data Browser to upload files
                </button>
              </p>
            </div>
          ) : (
            <div className="row" style={{ alignItems: "end", gap: 12 }}>
              <div className="selector-group" style={{ minWidth: 320 }}>
                <label htmlFor="file-select">Choose a file to analyze</label>
                <select
                  id="file-select"
                  value={selectedDataFile}
                  onChange={(e) => {
                    const filename = e.target.value;
                    console.log(
                      "[P2 File Select] User selected file:",
                      filename
                    );
                    setSelectedDataFile(filename);
                    if (filename) {
                      console.log(
                        "[P2 File Select] Loading codes for selected file:",
                        filename
                      );
                      loadExistingCodes(filename);
                    } else {
                      console.log(
                        "[P2 File Select] No file selected, clearing status"
                      );
                      setAnalysisStatus((prev) => ({
                        ...prev,
                        totalCases: 0,
                        processedCases: 0,
                        uniqueCodesCount: 0,
                        recentCompletions: [],
                        currentDataFile: null,
                      }));
                    }
                  }}
                  className="select"
                >
                  <option value="">-- Select a file --</option>
                  {availableFiles.map((file: any) => (
                    <option key={file.name} value={file.name}>
                      {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </option>
                  ))}
                </select>
              </div>
              {selectedDataFile && (
                <div className="row" style={{ gap: 8 }}>
                  <button
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent("switchToDataBrowser", {
                          detail: { filename: selectedDataFile },
                        })
                      )
                    }
                    className="btn subtle"
                  >
                    Browse this file
                  </button>
                  <button
                    onClick={handleDeleteSelectedFile}
                    disabled={isRunning}
                    className="btn danger"
                    title="Delete this uploaded file"
                  >
                    Delete file
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-header row">
          <h3>Code generation instructions</h3>
        </div>
        <div className="card-body">
          <div className="instructions-container">
            <div className="instruction-examples-global">
              <p>
                <strong>Example instructions:</strong>
              </p>
              <div className="examples-grid">
                {[
                  "Focus on victim characteristics",
                  "Emphasize environmental factors",
                  "Use specific crime terminology",
                  "Highlight offender behavior patterns",
                  "Create detailed, specific codes",
                  "Focus on temporal aspects",
                  "Capture location and setting details",
                  "Note modus operandi",
                  "Tag items and property types",
                  "Describe entry/exit methods",
                  "Include witness or evidence references",
                  "Record time-of-day and duration",
                ].map((pill) => (
                  <button
                    key={pill}
                    type="button"
                    className={`badge ${
                      selectedInstructionPills.includes(pill) ? "success" : ""
                    }`}
                    onClick={() => toggleInstructionPill(pill)}
                    title={pill}
                    aria-pressed={selectedInstructionPills.includes(pill)}
                    style={{ cursor: "pointer" }}
                  >
                    {pill}
                  </button>
                ))}
              </div>
            </div>

            <div className="instructions-input-wrapper">
              {selectedInstructionPills.length > 0 && (
                <div
                  className="instructions-pills-overlay"
                  aria-hidden
                  ref={pillsOverlayRef}
                >
                  {selectedInstructionPills.map((pill) => (
                    <span key={pill} className="badge instructions-pill">
                      {pill}
                      <button
                        type="button"
                        className="remove"
                        title={`Remove ${pill}`}
                        onClick={() =>
                          setSelectedInstructionPills((prev) =>
                            prev.filter((p) => p !== pill)
                          )
                        }
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <textarea
                ref={globalTextRef}
                value={globalInstructions}
                onChange={(e) => setGlobalInstructions(e.target.value)}
                onKeyDown={handleGlobalKeyDown}
                placeholder={
                  selectedInstructionPills.length === 0 &&
                  (globalInstructions || "").trim().length === 0
                    ? "Enter your instructions for code generation across all cases, or select pills above. Left blank uses comprehensive best practices."
                    : ""
                }
                className="global-instructions-textarea"
                rows={3}
                style={{
                  paddingTop:
                    selectedInstructionPills.length && pillsOverlayHeight
                      ? pillsOverlayHeight
                      : selectedInstructionPills.length
                      ? 44
                      : undefined,
                }}
              />
            </div>

            <div className="row" style={{ gap: 8 }}>
              {hasAnyInstruction() ? (
                <span className="badge success">Using custom instructions</span>
              ) : (
                <span className="badge info">
                  Using comprehensive best practices
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header row">
          <h3>Progress</h3>
        </div>
        <div className="card-body">
          <div className="progress-overview">
            <div className="progress-stats-grid">
              <div className="stat-item">
                <div className="stat-number">
                  {analysisStatus.processedCases}
                </div>
                <div className="stat-label">Processed</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">{analysisStatus.totalCases}</div>
                <div className="stat-label">Total Cases</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">
                  {analysisStatus.uniqueCodesCount}
                </div>
                <div className="stat-label">Unique Codes</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">{analysisStatus.apiCalls}</div>
                <div className="stat-label">API Calls</div>
              </div>
            </div>
          </div>

          {analysisStatus.phase === "Processing Cases" &&
            analysisStatus.currentCase && (
              <div className="current-processing">
                <h4>Currently processing</h4>
                <div className="current-case">
                  <span className="case-label">Case ID:</span>
                  <span className="case-id">{analysisStatus.currentCase}</span>
                  <span className="case-progress">
                    ({analysisStatus.currentBatch} of{" "}
                    {analysisStatus.totalCases})
                  </span>
                </div>
                <div className="processing-indicator">
                  <div className="pulse-dot"></div>
                  <span>Generating initial codes…</span>
                </div>
              </div>
            )}

          {analysisStatus.recentCompletions.length > 0 && (
            <div className="live-codes-section">
              <div className="section-header">
                <h4>
                  Generated codes{" "}
                  {analysisStatus.recentCompletions.length > 0
                    ? `(${getFilteredAndSortedCompletions().length}${
                        getFilteredAndSortedCompletions().length !==
                        analysisStatus.recentCompletions.length
                          ? ` of ${analysisStatus.recentCompletions.length}`
                          : ""
                      })`
                    : ""}
                </h4>
                <div className="codes-actions">
                  <button className="btn subtle" onClick={handleOpenExport}>
                    Export
                  </button>
                  <button
                    className="btn danger"
                    onClick={handleDeleteAllCodes}
                    disabled={
                      isRunning ||
                      (!selectedDataFile && !analysisStatus.currentDataFile)
                    }
                    title="Delete all initial codes in this file"
                  >
                    Delete all codes
                  </button>
                </div>
              </div>

              {/* Search, Filter, and Sort Controls */}
              <div
                className="codes-controls"
                style={{
                  display: "flex",
                  gap: "12px",
                  alignItems: "center",
                  padding: "12px 16px",
                  backgroundColor: "rgba(255, 255, 255, 0.03)",
                  borderRadius: "8px",
                  marginBottom: "16px",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: "1 1 300px", minWidth: "200px" }}>
                  <input
                    type="text"
                    placeholder="Search by case ID, codes, or text..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      backgroundColor: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "6px",
                      color: "#fff",
                      fontSize: "14px",
                      outline: "none",
                    }}
                  />
                </div>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "14px",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={filterRegeneratedOnly}
                    onChange={(e) => setFilterRegeneratedOnly(e.target.checked)}
                    style={{ cursor: "pointer" }}
                  />
                  <span>🔄 Regenerated only</span>
                </label>

                <select
                  value={sortBy}
                  onChange={(e) =>
                    setSortBy(e.target.value as "time" | "caseId" | "codeCount")
                  }
                  style={{
                    padding: "8px 12px",
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "6px",
                    color: "#fff",
                    fontSize: "14px",
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  <option value="time">Sort by: Time (newest)</option>
                  <option value="caseId">Sort by: Case ID</option>
                  <option value="codeCount">Sort by: Code count</option>
                </select>

                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  style={{
                    padding: "8px 12px",
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "6px",
                    color: "#fff",
                    fontSize: "14px",
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  <option value={10}>Show: 10</option>
                  <option value={25}>Show: 25</option>
                  <option value={50}>Show: 50</option>
                  <option value={100}>Show: 100</option>
                  <option value={999999}>Show: All</option>
                </select>

                {(searchQuery || filterRegeneratedOnly) && (
                  <button
                    className="btn subtle"
                    onClick={() => {
                      setSearchQuery("");
                      setFilterRegeneratedOnly(false);
                    }}
                    style={{
                      padding: "6px 12px",
                      fontSize: "14px",
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </div>

              <div className="codes-list">
                {getFilteredAndSortedCompletions().length === 0 ? (
                  <div
                    style={{
                      padding: "40px 20px",
                      textAlign: "center",
                      color: "rgba(255, 255, 255, 0.5)",
                      fontSize: "14px",
                    }}
                  >
                    No cases match your search or filters.
                  </div>
                ) : (
                  getPaginatedCompletions().map((completion) => (
                    <CodeGenerationItem
                      key={completion.caseId}
                      completion={completion}
                      onSave={handleCodeSave}
                      onRegenerate={handleRegenerateRequest}
                      onAddMoreCodes={handleAddMoreCodesRequest}
                      isSaving={!!savingCodes[completion.caseId]}
                      isRegenerating={!!regeneratingCodes[completion.caseId]}
                      isAddingMoreCodes={!!addingMoreCodes[completion.caseId]}
                    />
                  ))
                )}
              </div>

              {/* Pagination Controls */}
              {getFilteredAndSortedCompletions().length > 0 &&
                totalPages > 1 && (
                  <div
                    className="pagination-controls"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "16px",
                      backgroundColor: "rgba(255, 255, 255, 0.03)",
                      borderRadius: "8px",
                      marginTop: "16px",
                      flexWrap: "wrap",
                      gap: "12px",
                    }}
                  >
                    <div
                      style={{
                        color: "rgba(255, 255, 255, 0.7)",
                        fontSize: "14px",
                      }}
                    >
                      Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                      {Math.min(
                        currentPage * itemsPerPage,
                        getFilteredAndSortedCompletions().length
                      )}{" "}
                      of {getFilteredAndSortedCompletions().length} cases
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        alignItems: "center",
                      }}
                    >
                      <button
                        className="btn subtle"
                        onClick={() =>
                          setCurrentPage((prev) => Math.max(1, prev - 1))
                        }
                        disabled={currentPage === 1}
                        style={{
                          padding: "6px 12px",
                          fontSize: "14px",
                          opacity: currentPage === 1 ? 0.5 : 1,
                          cursor: currentPage === 1 ? "not-allowed" : "pointer",
                        }}
                      >
                        ← Previous
                      </button>

                      {/* Page numbers */}
                      <div
                        style={{
                          display: "flex",
                          gap: "4px",
                          alignItems: "center",
                        }}
                      >
                        {(() => {
                          const pages: React.ReactNode[] = [];
                          const maxPagesToShow = 5;
                          let startPage = Math.max(
                            1,
                            currentPage - Math.floor(maxPagesToShow / 2)
                          );
                          let endPage = Math.min(
                            totalPages,
                            startPage + maxPagesToShow - 1
                          );

                          if (endPage - startPage < maxPagesToShow - 1) {
                            startPage = Math.max(
                              1,
                              endPage - maxPagesToShow + 1
                            );
                          }

                          if (startPage > 1) {
                            pages.push(
                              <button
                                key={1}
                                className="btn subtle"
                                onClick={() => setCurrentPage(1)}
                                style={{
                                  padding: "6px 12px",
                                  fontSize: "14px",
                                  minWidth: "40px",
                                }}
                              >
                                1
                              </button>
                            );
                            if (startPage > 2) {
                              pages.push(
                                <span
                                  key="ellipsis-start"
                                  style={{
                                    padding: "6px 8px",
                                    color: "rgba(255, 255, 255, 0.5)",
                                  }}
                                >
                                  ...
                                </span>
                              );
                            }
                          }

                          for (let i = startPage; i <= endPage; i++) {
                            pages.push(
                              <button
                                key={i}
                                className={`btn ${
                                  i === currentPage ? "primary" : "subtle"
                                }`}
                                onClick={() => setCurrentPage(i)}
                                style={{
                                  padding: "6px 12px",
                                  fontSize: "14px",
                                  minWidth: "40px",
                                }}
                              >
                                {i}
                              </button>
                            );
                          }

                          if (endPage < totalPages) {
                            if (endPage < totalPages - 1) {
                              pages.push(
                                <span
                                  key="ellipsis-end"
                                  style={{
                                    padding: "6px 8px",
                                    color: "rgba(255, 255, 255, 0.5)",
                                  }}
                                >
                                  ...
                                </span>
                              );
                            }
                            pages.push(
                              <button
                                key={totalPages}
                                className="btn subtle"
                                onClick={() => setCurrentPage(totalPages)}
                                style={{
                                  padding: "6px 12px",
                                  fontSize: "14px",
                                  minWidth: "40px",
                                }}
                              >
                                {totalPages}
                              </button>
                            );
                          }

                          return pages;
                        })()}
                      </div>

                      <button
                        className="btn subtle"
                        onClick={() =>
                          setCurrentPage((prev) =>
                            Math.min(totalPages, prev + 1)
                          )
                        }
                        disabled={currentPage === totalPages}
                        style={{
                          padding: "6px 12px",
                          fontSize: "14px",
                          opacity: currentPage === totalPages ? 0.5 : 1,
                          cursor:
                            currentPage === totalPages
                              ? "not-allowed"
                              : "pointer",
                        }}
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}

              {/* Show summary when showing all items */}
              {getFilteredAndSortedCompletions().length > 0 &&
                totalPages <= 1 && (
                  <div
                    className="more-codes-indicator"
                    style={{
                      textAlign: "center",
                      padding: "16px",
                      color: "rgba(255, 255, 255, 0.6)",
                      fontSize: "14px",
                    }}
                  >
                    <span>
                      Showing all {getFilteredAndSortedCompletions().length}{" "}
                      cases
                    </span>
                  </div>
                )}
            </div>
          )}

          {showRegenerateModal && regenerateModalData && (
            <RegenerateModal
              isOpen={showRegenerateModal}
              onClose={handleRegenerateCancel}
              onSubmit={handleRegenerateSubmit}
              caseText={regenerateModalData.caseText}
              currentCodes={regenerateModalData.currentCodes}
            />
          )}

          {showAddMoreCodesModal && addMoreCodesModalData && (
            <AddMoreCodesModal
              isOpen={showAddMoreCodesModal}
              onClose={handleAddMoreCodesCancel}
              onSubmit={handleAddMoreCodesSubmit}
              caseText={addMoreCodesModalData.caseText}
              currentCodes={addMoreCodesModalData.currentCodes}
            />
          )}
        </div>
      </section>

      {results && (
        <div className="results-section">
          <h3>📊 Analysis Results</h3>
          {results?.progress && (
            <div className="results-progress">
              <h4>Overall Progress</h4>
              <div className="progress-stats">
                <div className="stat">
                  <span className="stat-label">Total Cases:</span>
                  <span className="stat-value">{results.progress.total}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Processed:</span>
                  <span className="stat-value">
                    {results.progress.processed}
                  </span>
                </div>
                <div className="stat">
                  <span className="stat-label">Completion:</span>
                  <span className="stat-value">
                    {results.progress.percentage}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {results?.recentResults && results.recentResults.length > 0 && (
            <div className="recent-results">
              <h4>Recent Results (Last 10)</h4>
              <div className="results-list">
                {results.recentResults.map(
                  (result, index: number) =>
                    result && (
                      <div key={index} className="result-item">
                        <div className="result-id">{result.id}</div>
                        <div className="result-code">"{result.code}"</div>
                        <div className="result-text">{result.text}</div>
                      </div>
                    )
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <Modal
        isOpen={showExportModal}
        title="Export Generated Codes"
        onClose={() => setShowExportModal(false)}
        actions={
          <>
            <button
              className="btn ghost"
              onClick={() => setShowExportModal(false)}
            >
              Cancel
            </button>
            <button className="btn primary" onClick={handleConfirmExport}>
              Export
            </button>
          </>
        }
      >
        <div className="export-options">
          <div className="row" style={{ gap: 12, alignItems: "center" }}>
            <label htmlFor="export-format">Format</label>
            <select
              id="export-format"
              className="select"
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as any)}
            >
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
              <option value="html">HTML</option>
            </select>
          </div>

          <div className="muted" style={{ marginTop: 12 }}>
            Exports the currently loaded generated codes from this session.
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ScriptRunner;
