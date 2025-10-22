import React from "react";
import ProgressRing from "./ui/ProgressRing";

interface Phase {
  progress: number;
  status: string;
}

type PhaseWithKey = Phase & {
  key: string;
};

interface Props {
  p2?: Phase;
  p3?: Phase;
  p3b?: Phase;
  p4?: Phase;
}

const ProcessSummary: React.FC<Props> = ({ p2, p3, p3b, p4 }) => {
  const phases: PhaseWithKey[] = [];

  return (
    <div className="row" aria-label="Process summary" title="Pipeline status">
      {phases.map((p) => (
        <div
          key={p.key}
          className="row"
          style={{ gap: 6, alignItems: "center" }}
        >
          <ProgressRing
            value={p.progress}
            size={18}
            strokeWidth={3}
            ariaLabel={`${p.key} progress`}
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
};

export default ProcessSummary;
