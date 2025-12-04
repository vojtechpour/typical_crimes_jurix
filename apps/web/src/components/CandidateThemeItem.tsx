import React, { useState } from "react";

interface Props {
  candidateTheme: string;
  side: "left" | "right";
  onDragStart: (
    e: React.DragEvent,
    candidateTheme: string,
    side: "left" | "right"
  ) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onEdit: (oldName: string, newName: string, side: "left" | "right") => void;
  onDelete: (candidateTheme: string, side: "left" | "right") => void;
  isDragging?: boolean;
}

const CandidateThemeItem: React.FC<Props> = ({
  candidateTheme,
  side,
  onDragStart,
  onDragEnd,
  onEdit,
  onDelete,
  isDragging,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(candidateTheme);

  const handleEdit = () => {
    setIsEditing(true);
    setEditValue(candidateTheme);
  };

  const handleSave = () => {
    if (editValue.trim() && editValue !== candidateTheme) {
      onEdit(candidateTheme, editValue.trim(), side);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(candidateTheme);
    setIsEditing(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  return (
    <div
      className={`candidate-item ${isDragging ? "dragging" : ""}`}
      draggable={!isEditing}
      onDragStart={(e) => onDragStart(e, candidateTheme, side)}
      onDragEnd={onDragEnd}
    >
      <span className="drag-handle">⋮⋮</span>

      {isEditing ? (
        <div className="edit-container">
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyPress}
            onBlur={handleSave}
            className="edit-input"
            autoFocus
          />
        </div>
      ) : (
        <span className="candidate-name">{candidateTheme}</span>
      )}

      <div className="candidate-actions">
        {isEditing ? (
          <>
            <button onClick={handleSave} className="edit-btn" title="Save">
              ✓
            </button>
            <button
              onClick={handleCancel}
              className="cancel-edit-btn"
              title="Cancel"
            >
              ✕
            </button>
          </>
        ) : (
          <>
            <button onClick={handleEdit} className="edit-btn" title="Edit">
              ✏️
            </button>
            <button
              onClick={() => onDelete(candidateTheme, side)}
              className="delete-btn"
              title="Delete"
            >
              🗑️
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default CandidateThemeItem;
