import React from "react";

interface FileInfo {
  name: string;
  size: number;
}
interface Props {
  availableFiles: FileInfo[];
  selectedDataFile: string;
  setSelectedDataFile: (v: string) => void;
  isLoadingFiles?: boolean;
  initialCodesStats?: {
    processedCases: number;
    totalCases: number;
    uniqueCodesCount: number;
  };
}

const P3FileSelector: React.FC<Props> = ({
  availableFiles,
  selectedDataFile,
  setSelectedDataFile,
  isLoadingFiles = false,
  initialCodesStats,
}) => {
  return (
    <section className="card soft">
      <div className="card-header row">
        <h3>Select data file with initial codes</h3>
      </div>
      <div className="card-body">
        {isLoadingFiles ? (
          <div className="no-files">
            <p>Loading available files…</p>
          </div>
        ) : availableFiles.length === 0 ? (
          <div className="no-files">
            <p>No files available for P3 analysis.</p>
            <p>Please ensure you have files with initial codes from Phase 2.</p>
          </div>
        ) : (
          <div className="row" style={{ alignItems: "end", gap: 12 }}>
            <div className="selector-group" style={{ minWidth: 320 }}>
              <label htmlFor="p3-file-select">Choose a file to analyze</label>
              <select
                id="p3-file-select"
                value={selectedDataFile}
                onChange={(e) => setSelectedDataFile(e.target.value)}
                className="select"
              >
                <option value="">-- Select a file --</option>
                {availableFiles.map((file) => (
                  <option key={file.name} value={file.name}>
                    {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </option>
                ))}
              </select>
            </div>
            {selectedDataFile && initialCodesStats && (
              <div
                className="row"
                style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}
              >
                <span className="badge">
                  <strong>{initialCodesStats.processedCases}</strong>
                  <span className="muted">P1-coded</span>
                </span>
                <span className="badge">
                  <strong>{initialCodesStats.totalCases}</strong>
                  <span className="muted">Total cases</span>
                </span>
                <span className="badge">
                  <strong>
                    {initialCodesStats.totalCases > 0
                      ? Math.round(
                          (initialCodesStats.processedCases /
                            initialCodesStats.totalCases) *
                            100
                        )
                      : 0}
                    %
                  </strong>
                  <span className="muted">Coverage</span>
                </span>
                <span className="badge">
                  <strong>{initialCodesStats.uniqueCodesCount}</strong>
                  <span className="muted">Unique codes</span>
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default P3FileSelector;
