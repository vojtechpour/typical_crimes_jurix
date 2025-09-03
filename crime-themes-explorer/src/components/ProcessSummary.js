import React from "react";

// This is UI-only. Wire it to your existing WebSocket stores if you have them centrally.
export default function ProcessSummary({ p2, p3, p3b, p4 } = {}) {
  // Fallback demo props. Replace with real values passed by App via context or props.
  const phases = [
    { key: "P2", status: p2?.status || "idle", progress: p2?.progress ?? 0 },
    { key: "P3", status: p3?.status || "idle", progress: p3?.progress ?? 0 },
    { key: "3b", status: p3b?.status || "idle", progress: p3b?.progress ?? 0 },
    { key: "P4", status: p4?.status || "idle", progress: p4?.progress ?? 0 },
  ];
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
