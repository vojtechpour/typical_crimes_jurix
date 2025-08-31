import React from "react";
import { useDroppable } from "@dnd-kit/core";
import DraggableItem from "./DraggableItem";

const DragDropContainer = ({ theme, items, originalCount, side }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `container-${theme}`,
    data: {
      theme: theme,
      type: "container",
    },
  });

  const { setNodeRef: setEndDropRef, isOver: isOverEnd } = useDroppable({
    id: `container-end-${theme}`,
    data: {
      theme: theme,
      type: "container-end",
      index: items.length,
    },
  });

  const getChangeIndicator = () => {
    const currentCount = items.length;
    const change = currentCount - originalCount;

    if (change > 0) {
      return `🟢 (+${change})`;
    } else if (change < 0) {
      return `🔴 (${change})`;
    } else {
      return "⚪";
    }
  };

  return (
    <div
      className={`drag-drop-container ${side} ${
        isOver || isOverEnd ? "drag-over" : ""
      }`}
    >
      <div className="container-header">
        <h3>
          {getChangeIndicator()} {theme} ({items.length} items)
        </h3>
      </div>

      <div className="container-content">
        {items.length === 0 ? (
          <div className="empty-container">
            <p>No items - drag items here</p>
          </div>
        ) : (
          <div className="items-list">
            {items.map((item, index) => (
              <DraggableItem
                key={`${item}|||${theme}|||${index}`}
                id={`${item}|||${theme}|||${index}`}
                text={item}
                index={index}
              />
            ))}
            <div
              ref={setEndDropRef}
              className={`end-drop-zone ${isOverEnd ? "active" : ""}`}
            >
              {isOverEnd && (
                <div className="insertion-indicator">
                  <div className="insertion-line"></div>
                  <span className="insertion-text">Drop at end</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DragDropContainer;
