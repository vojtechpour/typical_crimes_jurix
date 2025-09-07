import React, { useEffect, useRef, useState, useLayoutEffect } from "react";
import {
  FiEdit2,
  FiTrash2,
  FiCheck,
  FiX,
  FiRefreshCw,
  FiPlus,
  FiLoader,
  FiFileText,
  FiTag,
  FiEdit3,
  FiInfo,
  FiCheckCircle,
  FiXCircle,
} from "react-icons/fi";
import type { IconBaseProps } from "react-icons";

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
const IconFileText: React.FC<IconBaseProps> =
  FiFileText as unknown as React.FC<IconBaseProps>;
const IconTag: React.FC<IconBaseProps> =
  FiTag as unknown as React.FC<IconBaseProps>;
const IconEdit3: React.FC<IconBaseProps> =
  FiEdit3 as unknown as React.FC<IconBaseProps>;
const IconInfo: React.FC<IconBaseProps> =
  FiInfo as unknown as React.FC<IconBaseProps>;

type LogEntry = { id: number; text: string; timestamp: string; type: string };

type Completion = {
  caseId: string | number;
  codesText: any;
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

type CodeGenerationItemProps = {
  completion: Completion;
  onEdit: (caseId: string | number, newCodes: string[]) => void;
  onSave: (caseId: string | number, codes: string[]) => void;
  onRegenerate: (
    caseId: string | number,
    caseText: string,
    currentCodes: string
  ) => void;
  isSaving: boolean;
  isRegenerating: boolean;
};

type RegenerateModalProps = {
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
            onClick={() => onSubmit(instructions)}
            className="btn primary"
          >
            <IconRefreshCw size={14} />
            <span style={{ marginLeft: 6 }}>Regenerate</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const ScriptRunner: React.FC = () => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [output, setOutput] = useState<LogEntry[]>([]);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [selectedDataFile, setSelectedDataFile] = useState<string>("");
  const [availableFiles, setAvailableFiles] = useState<any[]>([]);

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

  const [showRawLogs, setShowRawLogs] = useState<boolean>(false);
  const [showAllCodes, setShowAllCodes] = useState<boolean>(false);
  const [editingCodes, setEditingCodes] = useState<
    Record<string | number, string[]>
  >({});
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
  const [globalInstructions, setGlobalInstructions] = useState<string>("");
  const [bulkRegenerating, setBulkRegenerating] = useState<boolean>(false);
  const [bulkProgress, setBulkProgress] = useState<BulkProgress>(null);
  const [model, setModel] = useState<string>("gemini-2.0-flash");
  const [selectedInstructionPills, setSelectedInstructionPills] = useState<
    string[]
  >([]);

  const wsRef = useRef<WebSocket | null>(null);
  const outputRef = useRef<HTMLDivElement | null>(null);
  const intervalRef = useRef<number | null>(null);
  const globalTextRef = useRef<HTMLTextAreaElement | null>(null);
  const pillsOverlayRef = useRef<HTMLDivElement | null>(null);
  const [pillsOverlayHeight, setPillsOverlayHeight] = useState<number>(0);

  useEffect(() => {
    connectWebSocket();
    checkScriptStatus();
    loadAvailableFiles();

    const interval = window.setInterval(() => {
      if (isRunning && startTime) {
        setDuration(Date.now() - startTime);
      }
    }, 1000);
    intervalRef.current = interval;

    const handleSwitchToDataBrowser = (event: Event) => {
      const anyEvent = event as CustomEvent<{
        tab?: number;
        filename?: string;
      }>;
      if (anyEvent.detail && anyEvent.detail.filename) {
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
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      window.removeEventListener(
        "switchToDataBrowser",
        handleSwitchToDataBrowser as EventListener
      );
      if (wsRef.current) wsRef.current.close();
    };
  }, [isRunning, startTime]);

  useEffect(() => {
    if (outputRef.current && showRawLogs) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, showRawLogs]);

  const connectWebSocket = () => {
    const ws = new WebSocket("ws://localhost:9000");
    wsRef.current = ws;

    ws.onopen = () => {};
    ws.onmessage = (event: MessageEvent<string>) => handleMessage(event);
    ws.onclose = () => {
      setTimeout(connectWebSocket, 3000);
    };
    ws.onerror = () => {};
  };

  const handleMessage = (event: MessageEvent<string>) => {
    try {
      const message = JSON.parse(event.data);
      switch (message.type) {
        case "progressUpdate": {
          const progressData = message.data as any;
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
          setBulkProgress({
            current: bulkData.current,
            total: bulkData.total,
            status: bulkData.status,
            percentage: bulkData.percentage,
            currentCaseId: bulkData.case_id,
          });
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
          setOutput((prev) =>
            [
              ...prev,
              {
                id: Date.now() + Math.random(),
                text: message.text,
                timestamp: message.timestamp,
                type: message.level || "info",
              },
            ].slice(-1000)
          );
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
            currentDataFile: selectedDataFile || prev.currentDataFile,
          }));
          break;
        }
        case "script_stopped":
        case "script_finished": {
          setIsRunning(false);
          setAnalysisStatus((prev) => ({
            ...prev,
            phase: message.type === "script_finished" ? "Complete" : "Stopped",
          }));
          break;
        }
        case "script_error": {
          setAnalysisStatus((prev) => ({
            ...prev,
            errors: [
              ...prev.errors,
              { message: message.data, timestamp: new Date(message.timestamp) },
            ].slice(-100),
          }));
          break;
        }
        default: {
          if (message.data && message.data.includes) {
            setOutput((prev) =>
              [
                ...prev,
                {
                  id: Date.now() + Math.random(),
                  text: message.data,
                  timestamp: new Date().toLocaleTimeString(),
                  type: "info",
                },
              ].slice(-1000)
            );
          }
        }
      }
    } catch (err) {
      // ignore parse errors
    }
  };

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

  const checkScriptStatus = async () => {
    try {
      const response = await fetch("/api/script/status");
      const data = await response.json();
      setIsRunning(!!data.running);
      if (data.running) fetchResults();
    } catch {}
  };

  const startScript = async () => {
    try {
      setError(null);
      const effectiveInstructions = buildEffectiveInstructions();
      const response = await fetch("/api/script/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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

  const fetchResults = async () => {
    try {
      const response = await fetch("/api/results/latest");
      const data = await response.json();
      setResults(data);
    } catch {}
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

  const loadAvailableFiles = async () => {
    try {
      const response = await fetch("/api/data-files");
      const files = await response.json();
      setAvailableFiles(files);
    } catch {}
  };

  const handleDeleteSelectedFile = async () => {
    if (!selectedDataFile) return;
    const confirmDelete = window.confirm(
      `Delete file "${selectedDataFile}" from uploads? This cannot be undone.`
    );
    if (!confirmDelete) return;
    try {
      const response = await fetch(`/api/data/${selectedDataFile}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
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
      const res = await fetch(`/api/data/${filename}/codes`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
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

  const startScriptWithFile = async (filename: string | null = null) => {
    try {
      setError(null);
      const effectiveInstructions = buildEffectiveInstructions();
      const response = await fetch("/api/script/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataFile: filename,
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
        addOutput(
          `🔄 Starting Phase 2 analysis${
            filename ? ` with file: ${filename}` : ""
          } ${methodUsed}...`,
          "info"
        );
      } else {
        setError(data.error || "Failed to start script");
        addOutput(`❌ Error: ${data.error}`, "error");
      }
    } catch (e: any) {
      setError("Failed to start script: " + e.message);
      addOutput(`❌ Error: ${e.message}`, "error");
    }
  };

  const addOutput = (text: string, type: string = "output") => {
    const timestamp = new Date().toLocaleTimeString();
    setOutput((prev) => [
      ...prev,
      { text, type, timestamp, id: Date.now() + Math.random() },
    ]);
  };

  const getEstimatedCompletion = () => {
    if (analysisStatus.processedCases === 0 || duration === 0)
      return "Calculating...";
    const avgTimePerCase = duration / analysisStatus.processedCases;
    const remainingCases =
      analysisStatus.totalCases - analysisStatus.processedCases;
    const estimatedMs = remainingCases * avgTimePerCase;
    if (estimatedMs < 60000) return `${Math.round(estimatedMs / 1000)}s`;
    if (estimatedMs < 3600000) return `${Math.round(estimatedMs / 60000)}m`;
    return `${Math.round(estimatedMs / 3600000)}h`;
  };

  const getCodeTypeDistribution = () => {
    const codeTypes: Record<string, number> = {};
    let totalCodes = 0;
    analysisStatus.recentCompletions.forEach((completion) => {
      try {
        const codes = JSON.parse(
          typeof completion.codesText === "string"
            ? completion.codesText.replace(/'/g, '"')
            : JSON.stringify(completion.codesText)
        );
        if (Array.isArray(codes)) {
          codes.forEach((code) => {
            const type = String(code).split("_")[0] || "other";
            codeTypes[type] = (codeTypes[type] || 0) + 1;
            totalCodes++;
          });
        }
      } catch {}
    });
    return Object.entries(codeTypes)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([name, count]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        count,
        percentage: totalCodes > 0 ? (Number(count) / totalCodes) * 100 : 0,
      }));
  };

  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case "Idle":
        return "⚪";
      case "Starting":
        return "🔄";
      case "Initializing":
        return "🚀";
      case "Processing Cases":
        return "⚙️";
      case "Complete":
        return "✅";
      case "Stopped":
        return "⏹️";
      default:
        return "❓";
    }
  };

  const getPhaseDescription = (phase: string) => {
    switch (phase) {
      case "Idle":
        return "Ready to start analysis";
      case "Starting":
        return "Initializing analysis environment";
      case "Initializing":
        return "Loading data and preparing prompts";
      case "Processing Cases":
        return "Generating initial codes for each case";
      case "Complete":
        return "Analysis completed successfully";
      case "Stopped":
        return "Analysis was stopped by user";
      default:
        return "Unknown phase";
    }
  };

  const handleCodeEdit = (caseId: string | number, newCodes: string[]) => {
    setEditingCodes((prev) => ({ ...prev, [caseId]: newCodes }));
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
      const response = await fetch(`/api/data/${filename}/case/${caseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes }),
      });
      const result = await response.json();
      if (response.ok) {
        setAnalysisStatus((prev) => ({
          ...prev,
          recentCompletions: prev.recentCompletions.map((completion) =>
            completion.caseId === caseId
              ? { ...completion, codesText: JSON.stringify(codes) }
              : completion
          ),
        }));
        setEditingCodes((prev) => {
          const updated = { ...prev };
          delete updated[caseId];
          return updated;
        });
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

  const CodeGenerationItem: React.FC<CodeGenerationItemProps> = ({
    completion,
    onEdit,
    onSave,
    onRegenerate,
    isSaving,
    isRegenerating,
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
      if (editValue.trim()) {
        const updatedCodes = [...editedCodes];
        updatedCodes[editingIndex] = editValue.trim();
        setEditedCodes(updatedCodes);
        onSave(completion.caseId, updatedCodes);
      }
      setEditingIndex(-1);
      setEditValue("");
    };

    const handleCancelEdit = () => {
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
              disabled={isSaving || isRegenerating}
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
              className="add-code-btn"
              onClick={handleAddNewCode}
              type="button"
              title="Add new code"
              disabled={isSaving || isRegenerating}
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

        {completion.caseText && (
          <div className="case-text-section">
            <div className="case-text-header">
              <h6>📄 Case Description</h6>
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
              <p className="case-text">{displayText}</p>
            </div>
          </div>
        )}

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

  const loadExistingCodes = async (filename: string) => {
    try {
      const response = await fetch(`/api/data/${filename}/codes?limit=100`);
      const result = await response.json();
      if (response.ok) {
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
        setAnalysisStatus((prev) => ({
          ...prev,
          totalCases: result.statistics.totalCases,
          processedCases: result.statistics.processedCases,
          uniqueCodesCount: result.statistics.uniqueCodesCount,
          recentCompletions: existingCompletions,
          currentDataFile: filename,
        }));
        addOutput(
          `📂 Loaded ${result.statistics.processedCases} existing codes from ${filename}`,
          "info"
        );
      } else {
        throw new Error(result.error || "Failed to load existing codes");
      }
    } catch (e: any) {
      addOutput(`❌ Failed to load existing codes: ${e.message}`, "error");
    }
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
    const { caseId, caseText } = regenerateModalData;
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
        `/api/data/${filename}/case/${caseId}/regenerate`,
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
                  codesText: JSON.stringify(result.codes),
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

  const handleExampleClick = (exampleText: string) => {
    const cleanExample = exampleText.replace(/"/g, "");
    if (globalInstructions.trim()) {
      setGlobalInstructions(
        (prev) =>
          prev +
          (prev.endsWith(".") || prev.endsWith(",") ? " " : ". ") +
          cleanExample
      );
    } else {
      setGlobalInstructions(cleanExample);
    }
  };

  const handleBulkRegenerate = async () => {
    if (!hasAnyInstruction()) {
      addOutput(
        "❌ Please enter instructions before bulk regenerating codes",
        "error"
      );
      return;
    }
    const currentFile = analysisStatus.currentDataFile || selectedDataFile;
    if (!currentFile) {
      addOutput("❌ No data file selected for bulk regeneration", "error");
      return;
    }
    const filename = currentFile.includes("/")
      ? currentFile.split("/").pop()!
      : currentFile;
    try {
      setBulkRegenerating(true);
      setBulkProgress({ current: 0, total: 0, status: "Starting..." });
      addOutput(
        `🔄 Starting bulk regeneration of existing codes with instructions: "${buildEffectiveInstructions()}"`,
        "info"
      );
      const response = await fetch(`/api/data/${filename}/bulk-regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructions: buildEffectiveInstructions() }),
      });
      const result = await response.json();
      if (response.ok) {
        addOutput(
          `✅ Bulk regeneration completed successfully. Updated ${result.updated_cases} cases.`,
          "success"
        );
        if (selectedDataFile) loadExistingCodes(selectedDataFile);
      } else {
        throw new Error(result.error || "Failed to start bulk regeneration");
      }
    } catch (e: any) {
      addOutput(`❌ Failed to bulk regenerate codes: ${e.message}`, "error");
    } finally {
      setBulkRegenerating(false);
      setBulkProgress(null);
    }
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
          {isRunning ? "Running..." : "Start analysis"}
        </button>
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
          {availableFiles.length === 0 && !selectedDataFile ? (
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
                    setSelectedDataFile(filename);
                    if (filename) {
                      loadExistingCodes(filename);
                    } else {
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
                    ? `(${analysisStatus.recentCompletions.length})`
                    : ""}
                </h4>
                <div className="codes-actions">
                  <button
                    className="btn subtle"
                    onClick={downloadGeneratedCodes}
                  >
                    Export codes
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

              <div className="codes-list">
                {analysisStatus.recentCompletions
                  .slice(0, 10)
                  .map((completion) => (
                    <CodeGenerationItem
                      key={completion.caseId}
                      completion={completion}
                      onEdit={handleCodeEdit}
                      onSave={handleCodeSave}
                      onRegenerate={handleRegenerateRequest}
                      isSaving={!!savingCodes[completion.caseId]}
                      isRegenerating={!!regeneratingCodes[completion.caseId]}
                    />
                  ))}
              </div>

              {analysisStatus.recentCompletions.length > 10 && (
                <div className="more-codes-indicator">
                  <span>
                    + {analysisStatus.recentCompletions.length - 10} more
                    completed cases
                  </span>
                  <button
                    className="view-all-btn"
                    onClick={() => setShowAllCodes(true)}
                  >
                    View All Generated Codes
                  </button>
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
        </div>
      </section>

      {results && (
        <div className="results-section">
          <h3>📊 Analysis Results</h3>
          {results.progress && (
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

          {results.recentResults && results.recentResults.length > 0 && (
            <div className="recent-results">
              <h4>Recent Results (Last 10)</h4>
              <div className="results-list">
                {results.recentResults.map((result: any, index: number) => (
                  <div key={index} className="result-item">
                    <div className="result-id">{result.id}</div>
                    <div className="result-code">"{result.code}"</div>
                    <div className="result-text">{result.text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ScriptRunner;
