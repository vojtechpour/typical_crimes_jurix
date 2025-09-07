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
}

const P3FileSelector: React.FC<Props> = ({
  availableFiles,
  selectedDataFile,
  setSelectedDataFile,
  isLoadingFiles = false,
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
            {selectedDataFile && (
              <span className="badge success">Ready: {selectedDataFile}</span>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default P3FileSelector;
