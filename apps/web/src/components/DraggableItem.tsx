import React from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";

interface Props {
  id: string;
  text: string;
  index: number;
}

const DraggableItem: React.FC<Props> = ({ id, text, index }) => {
  const {
    attributes,
    listeners,
    setNodeRef: setDragNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: id,
    data: {
      text: text,
      index: index,
      // Extract theme from id for easier access
      theme: id.split("|||")[1],
    },
  });

  const { setNodeRef: setDropNodeRef, isOver } = useDroppable({
    id: `drop-${id}`,
    data: {
      text: text,
      index: index,
      theme: id.split("|||")[1],
      type: "item",
    },
  });

  // Combine both refs
  const setNodeRef = (node: HTMLElement | null) => {
    setDragNodeRef(node);
    setDropNodeRef(node);
  };

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 9999,
        position: "relative" as const,
      }
    : {};

  const displayText = text.length > 50 ? text.substring(0, 50) + "..." : text;

  return (
    <>
      {/* Insertion indicator above this item */}
      {isOver && (
        <div className="insertion-indicator">
          <div className="insertion-line"></div>
          <span className="insertion-text">Drop here</span>
        </div>
      )}

      <div
        ref={setNodeRef}
        style={style}
        className={`draggable-item ${isDragging ? "dragging" : ""} ${
          isOver ? "drop-target" : ""
        }`}
        {...listeners}
        {...attributes}
      >
        <div className="item-content">
          <span className="drag-handle">⋮⋮</span>
          <span className="item-text">{displayText}</span>
        </div>
      </div>
    </>
  );
};

export default DraggableItem;
