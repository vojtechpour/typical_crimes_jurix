import React from "react";

// This is UI-only. Wire it to your existing WebSocket stores if you have them centrally.
export default function ProcessSummary({ p2, p3, p3b, p4 } = {}) {
  // Fallback demo props. Replace with real values passed by App via context or props.
  const phases = [];
  return (
    <div className="row" aria-label="Process summary" title="Pipeline status">
      {phases.map((p) => (
        <div key={p.key} className="row" style={{ gap: 6 }}>
          <div
            className="progress-ring"
            style={{ "--p": p.progress }}
            aria-hidden
          />
          <span className="badge">
            <strong>{p.key}</strong>
            <span className="muted">{p.status}</span>
            {p.progress > 0 && <span>{Math.round(p.progress)}%</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
