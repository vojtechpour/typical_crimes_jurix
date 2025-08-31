import React from "react";

const P3FileSelector = ({
  availableFiles,
  selectedDataFile,
  setSelectedDataFile,
}) => {
  return (
    <div className="file-selection-section">
      <h3>📁 Select Data File with Initial Codes</h3>
      <p className="section-description">
        Choose a file that contains Phase 2 initial codes to generate candidate
        themes.
      </p>

      {availableFiles.length === 0 ? (
        <div className="no-files-available">
          <p>📤 No files available for P3 analysis.</p>
          <p>Please ensure you have files with initial codes from Phase 2.</p>
        </div>
      ) : (
        <div className="file-selector">
          <div className="selector-group">
            <label htmlFor="p3-file-select">Choose a file to analyze:</label>
            <select
              id="p3-file-select"
              value={selectedDataFile}
              onChange={(e) => setSelectedDataFile(e.target.value)}
              className="file-select"
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
            <div className="selected-file-info">
              <p>
                ✅ Ready for P3 analysis: <strong>{selectedDataFile}</strong>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default P3FileSelector;
