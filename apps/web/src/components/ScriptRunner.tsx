import React, { useEffect, useRef, useState, useCallback } from "react";
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

// Memoized component to prevent flickering during progress updates
const CodeGenerationItem = React.memo<CodeGenerationItemProps>(
  ({
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
        let codes: unknown[] | string = [];
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
          .map((code: unknown) => String(code).trim())
          .filter((code: string) => code.length > 0);
        setEditedCodes(
          cleanCodes.length > 0 ? cleanCodes : ["No codes generated"]
        );
      } catch {
        setEditedCodes([
          (completion.codesText as string) || "Error parsing codes",
        ]);
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
            {completion.isRegenerated && (
              <span
                className="regenerated-indicator"
                title="Codes regenerated with custom instructions"
              >
                Regenerated
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
                <div
                  key={`${completion.caseId}-${index}`}
                  className="code-tag-container"
                >
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
  },
  // Custom comparison function - only re-render if these props changed
  (prevProps, nextProps) => {
    return (
      prevProps.completion.caseId === nextProps.completion.caseId &&
      prevProps.completion.codesText === nextProps.completion.codesText &&
      prevProps.completion.caseText === nextProps.completion.caseText &&
      prevProps.completion.isRegenerated ===
        nextProps.completion.isRegenerated &&
      prevProps.isSaving === nextProps.isSaving &&
      prevProps.isRegenerating === nextProps.isRegenerating &&
      prevProps.isAddingMoreCodes === nextProps.isAddingMoreCodes
    );
  }
);

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
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content regenerate-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "800px",
          width: "90vw",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div className="modal-header">
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconRefreshCw size={16} /> Regenerate Codes
          </h3>
        </div>
        <div
          className="modal-body"
          style={{
            flex: 1,
            overflowY: "auto",
            maxHeight: "calc(85vh - 140px)",
          }}
        >
          {caseText && (
            <div className="case-preview">
              <h4>Case Preview</h4>
              <p
                className="case-text-preview"
                style={{
                  maxHeight: "150px",
                  overflowY: "auto",
                  padding: "12px",
                  backgroundColor: "rgba(0, 0, 0, 0.2)",
                  borderRadius: "6px",
                  fontSize: "13px",
                  lineHeight: "1.5",
                }}
              >
                {caseText}
              </p>
            </div>
          )}

          <div className="current-codes">
            <h4>Current Codes</h4>
            <div
              className="current-codes-display"
              style={{
                maxHeight: "120px",
                overflowY: "auto",
                padding: "12px",
                backgroundColor: "rgba(0, 0, 0, 0.2)",
                borderRadius: "6px",
                display: "flex",
                flexWrap: "wrap",
                gap: "6px",
              }}
            >
              {(() => {
                try {
                  const codes = JSON.parse(currentCodes);
                  if (Array.isArray(codes)) {
                    return codes.map((code, idx) => (
                      <span
                        key={idx}
                        style={{
                          display: "inline-block",
                          padding: "4px 10px",
                          backgroundColor:
                            "var(--accent-dim, rgba(99, 102, 241, 0.2))",
                          color: "var(--accent, #818cf8)",
                          borderRadius: "12px",
                          fontSize: "12px",
                          fontWeight: 500,
                        }}
                      >
                        {code}
                      </span>
                    ));
                  }
                } catch {
                  // Not valid JSON, render as-is
                }
                return <span style={{ fontSize: "13px" }}>{currentCodes}</span>;
              })()}
            </div>
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
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content regenerate-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "800px",
          width: "90vw",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div className="modal-header">
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconPlus size={16} /> Add More Codes
          </h3>
        </div>
        <div
          className="modal-body"
          style={{
            flex: 1,
            overflowY: "auto",
            maxHeight: "calc(85vh - 140px)",
          }}
        >
          {caseText && (
            <div className="case-preview">
              <h4>Case Preview</h4>
              <p
                className="case-text-preview"
                style={{
                  maxHeight: "150px",
                  overflowY: "auto",
                  padding: "12px",
                  backgroundColor: "rgba(0, 0, 0, 0.2)",
                  borderRadius: "6px",
                  fontSize: "13px",
                  lineHeight: "1.5",
                }}
              >
                {caseText}
              </p>
            </div>
          )}

          <div className="current-codes">
            <h4>Existing Codes (will not be changed)</h4>
            <div
              className="current-codes-display"
              style={{
                maxHeight: "120px",
                overflowY: "auto",
                padding: "12px",
                backgroundColor: "rgba(0, 0, 0, 0.2)",
                borderRadius: "6px",
                display: "flex",
                flexWrap: "wrap",
                gap: "6px",
              }}
            >
              {(() => {
                try {
                  const codes = JSON.parse(currentCodes);
                  if (Array.isArray(codes)) {
                    return codes.map((code, idx) => (
                      <span
                        key={idx}
                        style={{
                          display: "inline-block",
                          padding: "4px 10px",
                          backgroundColor:
                            "var(--accent-dim, rgba(99, 102, 241, 0.2))",
                          color: "var(--accent, #818cf8)",
                          borderRadius: "12px",
                          fontSize: "12px",
                          fontWeight: 500,
                        }}
                      >
                        {code}
                      </span>
                    ));
                  }
                } catch {
                  // Not valid JSON, render as-is
                }
                return <span style={{ fontSize: "13px" }}>{currentCodes}</span>;
              })()}
            </div>
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
  const [showInstructions, setShowInstructions] = useState<boolean>(false);

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
  const selectedDataFileRef = useRef<string>("");

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
            `Loaded ${result.statistics.processedCases} existing codes from ${filename}`,
            "info"
          );
        } else {
          console.error("[P2 Load Codes] API returned error:", result.error);
          throw new Error(result.error || "Failed to load existing codes");
        }
      } catch (e: any) {
        console.error("[P2 Load Codes] Error loading codes:", e);
        addOutput(`Failed to load existing codes: ${e.message}`, "error");
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
              "[P2 WebSocket] Progress update received:",
              progressData.phase,
              progressData.case_id,
              progressData.message
            );

            // Log to output for user visibility
            if (progressData.message) {
              const logType = progressData.error
                ? "error"
                : progressData.codes?.length > 0
                ? "success"
                : "info";
              addOutput(progressData.message, logType);
            }

            setAnalysisStatus((prev) => {
              // Only create completion if we have codes (case was processed)
              let updatedCompletions = prev.recentCompletions;

              if (
                progressData.codes &&
                progressData.codes.length > 0 &&
                progressData.case_id
              ) {
                const newCompletion: Completion = {
                  caseId: progressData.case_id,
                  codesText: Array.isArray(progressData.codes)
                    ? progressData.codes
                    : typeof progressData.codes === "string"
                    ? progressData.codes
                    : [progressData.codes],
                  timestamp: new Date(message.timestamp || Date.now()),
                  caseText: progressData.case_text || "",
                };

                const existingIndex = prev.recentCompletions.findIndex(
                  (completion) => completion.caseId === progressData.case_id
                );

                if (existingIndex >= 0) {
                  updatedCompletions = [...prev.recentCompletions];
                  updatedCompletions[existingIndex] = newCompletion;
                } else {
                  updatedCompletions = [
                    newCompletion,
                    ...prev.recentCompletions,
                  ];
                }
                updatedCompletions = updatedCompletions.slice(0, 100);
              }

              return {
                ...prev,
                phase: progressData.phase || prev.phase,
                processedCases:
                  progressData.progress?.processed ?? prev.processedCases,
                totalCases: progressData.progress?.total ?? prev.totalCases,
                uniqueCodesCount:
                  progressData.progress?.unique_codes ?? prev.uniqueCodesCount,
                currentCase: progressData.case_id || prev.currentCase,
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
                `Regenerating case ${bulkData.case_id}... (${bulkData.current}/${bulkData.total})`,
                "info"
              );
            } else if (
              bulkData.current === bulkData.total &&
              bulkData.total > 0
            ) {
              addOutput(
                `Bulk regeneration completed! Updated ${bulkData.total} cases.`,
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
    // Use the Vite proxy for WebSocket in dev, or direct connection in production
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = import.meta.env.DEV
      ? `${wsProtocol}//${window.location.host}/ws` // Goes through Vite proxy
      : `${wsProtocol}//${window.location.host}`; // Direct in production

    console.log("[WS] Connecting to:", wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[WS] Connected successfully");
    };
    ws.onmessage = (event: MessageEvent<string>) => handleMessage(event);
    ws.onclose = () => {
      console.log("[WS] Connection closed, reconnecting in 3s...");
      setTimeout(connectWebSocket, 3000);
    };
    ws.onerror = (err) => {
      console.error("[WS] Error:", err);
    };
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

  const hasAnyInstruction = () => (globalInstructions || "").trim().length > 0;

  const buildEffectiveInstructions = () => (globalInstructions || "").trim();

  const startScript = async () => {
    try {
      setError(null);
      const effectiveInstructions = buildEffectiveInstructions();

      // Debug logging
      console.log("[P2 startScript] Starting analysis with:", {
        selectedDataFile,
        selectedDataFileRef: selectedDataFileRef.current,
        model,
        hasInstructions: !!effectiveInstructions,
      });

      if (!selectedDataFile) {
        console.error("[P2 startScript] No data file selected!");
        setError("Please select a data file first");
        return;
      }

      const requestBody = {
        dataFile: selectedDataFile,
        globalInstructions: effectiveInstructions,
        model,
      };
      console.log("[P2 startScript] Request body:", requestBody);

      const response = await fetch("/api/script/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const data = await response.json();
      console.log("[P2 startScript] Response:", {
        status: response.status,
        ok: response.ok,
        data,
      });

      if (response.ok) {
        setIsRunning(true);
        setStartTime(Date.now());
        const methodUsed = hasAnyInstruction()
          ? "with custom instructions"
          : "using best practices";
        addOutput(`Starting Phase 2 analysis ${methodUsed}...`, "info");
      } else {
        setError(data.error || "Failed to start script");
        addOutput(`Error: ${data.error}`, "error");
      }
    } catch (e: any) {
      console.error("[P2 startScript] Exception:", e);
      setError("Failed to start script: " + e.message);
      addOutput(`Error: ${e.message}`, "error");
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
        addOutput("Stop request sent...", "warning");
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
        addOutput(`Deleted file ${selectedDataFile}`, "warning");
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
      addOutput(`Failed to delete file: ${e.message}`, "error");
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
      addOutput("No data file selected", "error");
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
        `Deleted initial codes in ${result.casesCleared} cases from ${filename}`,
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
      addOutput(`Failed to delete all codes: ${e.message}`, "error");
    }
  };

  const handleCodeSave = async (caseId: string | number, codes: string[]) => {
    try {
      setSavingCodes((prev) => ({ ...prev, [caseId]: true }));
      const currentFile = analysisStatus.currentDataFile || selectedDataFile;
      if (!currentFile) {
        addOutput("Error: No data file available for saving changes", "error");
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
        addOutput(`Saved codes for case ${caseId} to ${filename}`, "success");
      } else {
        throw new Error(result.error || "Failed to save codes");
      }
    } catch (e: any) {
      addOutput(
        `Failed to save codes for case ${caseId}: ${e.message}`,
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
      addOutput(`Regenerating codes for case ${caseId}...`, "info");
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
          `Successfully regenerated codes for case ${caseId} ${methodUsed}`,
          "success"
        );
      } else {
        throw new Error(result.error || "Failed to regenerate codes");
      }
    } catch (e: any) {
      addOutput(
        `Failed to regenerate codes for case ${caseId}: ${e.message}`,
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
      addOutput(`Adding more codes for case ${caseId}...`, "info");
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
          `Successfully added ${result.addedCount} new codes for case ${caseId} ${methodUsed}`,
          "success"
        );
      } else {
        throw new Error(result.error || "Failed to add more codes");
      }
    } catch (e: any) {
      addOutput(
        `Failed to add more codes for case ${caseId}: ${e.message}`,
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

  return (
    <div className="script-runner">
      <div className="toolbar">
        <button
          onClick={startScript}
          disabled={isRunning || !selectedDataFile}
          className="btn primary"
          title={
            !selectedDataFile ? "Please select a data file first" : undefined
          }
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
            <option value="gemini-3-pro-preview">
              Gemini 3 Pro Preview (suggested)
            </option>
            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
            <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite</option>
            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
            <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash-Lite</option>
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
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className={`btn subtle ${hasAnyInstruction() ? "has-value" : ""}`}
          title={globalInstructions.trim() || "Add custom instructions"}
          style={{ position: "relative" }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginRight: 4 }}
          >
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <line x1="10" y1="9" x2="8" y2="9" />
          </svg>
          Instructions
          {hasAnyInstruction() && (
            <span
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: "#3b82f6",
              }}
            />
          )}
        </button>
        <span className="spacer" />
        <span className="badge">{isRunning ? "Running" : "Stopped"}</span>
        {duration > 0 && (
          <span className="badge info" title="Elapsed time">
            {formatDuration(duration)}
          </span>
        )}
      </div>

      {/* Custom Instructions Panel */}
      {showInstructions && (
        <div
          style={{
            backgroundColor: "var(--card-bg)",
            border: "1px solid var(--border-color)",
            borderRadius: "8px",
            padding: "16px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "12px",
            }}
          >
            <label
              htmlFor="p2-custom-instructions"
              style={{
                fontWeight: 500,
                color: "var(--text-primary)",
                fontSize: "14px",
              }}
            >
              Custom Instructions
            </label>
            <button
              onClick={() => setShowInstructions(false)}
              className="btn subtle"
              style={{ padding: "4px 8px", fontSize: "12px" }}
            >
              Close
            </button>
          </div>
          <textarea
            id="p2-custom-instructions"
            value={globalInstructions}
            onChange={(e) => setGlobalInstructions(e.target.value)}
            placeholder="Add specific instructions for code generation...&#10;&#10;Examples:&#10;• Focus on victim characteristics&#10;• Emphasize environmental factors&#10;• Use specific crime terminology&#10;• Highlight offender behavior patterns"
            disabled={isRunning}
            style={{
              width: "100%",
              minHeight: "100px",
              padding: "12px",
              borderRadius: "6px",
              border: "1px solid var(--border-color)",
              backgroundColor: "var(--input-bg)",
              color: "var(--text-primary)",
              fontSize: "13px",
              lineHeight: "1.5",
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />
          <p
            style={{
              marginTop: "8px",
              marginBottom: 0,
              fontSize: "12px",
              color: "var(--text-muted)",
            }}
          >
            These instructions will be included in the AI prompt to guide how
            codes are generated. Leave empty to use default best practices.
          </p>
        </div>
      )}

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

      {!selectedDataFile && (
        <div className="badge warning">
          Please select a data file to analyze
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

          {/* Current processing status - show whenever running */}
          {isRunning && (
            <div className="progress-card">
              <div className="progress-header">
                <div className="pulse-dot" />
                <h4 className="progress-title">
                  {analysisStatus.phase || "Processing"}
                  {analysisStatus.currentCase &&
                    `: Case ${analysisStatus.currentCase}`}
                </h4>
              </div>
              <div className="progress-text">
                Progress: {analysisStatus.processedCases} /{" "}
                {analysisStatus.totalCases} cases
                {analysisStatus.totalCases > 0 && (
                  <span>
                    {" "}
                    (
                    {(
                      (analysisStatus.processedCases /
                        analysisStatus.totalCases) *
                      100
                    ).toFixed(1)}
                    %)
                  </span>
                )}
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width:
                      analysisStatus.totalCases > 0
                        ? `${
                            (analysisStatus.processedCases /
                              analysisStatus.totalCases) *
                            100
                          }%`
                        : "0%",
                  }}
                />
              </div>
            </div>
          )}

          {/* Live activity log */}
          {output.length > 0 && (
            <div className="activity-log">
              <h5 className="log-header">
                Activity Log (last {Math.min(output.length, 20)} entries)
              </h5>
              <div className="log-entries">
                {output.slice(-20).map((entry) => (
                  <div key={entry.id} className={`log-entry ${entry.type}`}>
                    <span className="log-timestamp">{entry.timestamp}</span>
                    {entry.text}
                  </div>
                ))}
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
              <div className="controls-bar">
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search by case ID, codes, or text..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />

                <label className="filter-checkbox">
                  <input
                    type="checkbox"
                    checked={filterRegeneratedOnly}
                    onChange={(e) => setFilterRegeneratedOnly(e.target.checked)}
                  />
                  <span>Regenerated only</span>
                </label>

                <select
                  className="filter-select"
                  value={sortBy}
                  onChange={(e) =>
                    setSortBy(e.target.value as "time" | "caseId" | "codeCount")
                  }
                >
                  <option value="time">Sort by: Time (newest)</option>
                  <option value="caseId">Sort by: Case ID</option>
                  <option value="codeCount">Sort by: Code count</option>
                </select>

                <select
                  className="filter-select"
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
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
                  >
                    Clear filters
                  </button>
                )}
              </div>

              <div className="codes-list">
                {getFilteredAndSortedCompletions().length === 0 ? (
                  <div className="codes-list-empty">
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
                  <div className="pagination-bar">
                    <div className="pagination-info">
                      Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                      {Math.min(
                        currentPage * itemsPerPage,
                        getFilteredAndSortedCompletions().length
                      )}{" "}
                      of {getFilteredAndSortedCompletions().length} cases
                    </div>

                    <div className="pagination-controls">
                      <button
                        className="btn subtle"
                        onClick={() =>
                          setCurrentPage((prev) => Math.max(1, prev - 1))
                        }
                        disabled={currentPage === 1}
                      >
                        ← Previous
                      </button>

                      <div className="page-numbers">
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
                              >
                                1
                              </button>
                            );
                            if (startPage > 2) {
                              pages.push(
                                <span
                                  key="ellipsis-start"
                                  className="page-ellipsis"
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
                                  className="page-ellipsis"
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
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}

              {/* Show summary when showing all items */}
              {getFilteredAndSortedCompletions().length > 0 &&
                totalPages <= 1 && (
                  <div className="more-codes-indicator">
                    Showing all {getFilteredAndSortedCompletions().length} cases
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
          <h3>Analysis Results</h3>
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
