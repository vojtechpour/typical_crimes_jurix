import React, { useEffect, useRef } from "react";

type LogLine =
  | string
  | {
      phase?: string;
      text?: string;
      [key: string]: unknown;
    };

interface LogPanelProps {
  lines?: LogLine[];
}

const LogPanel: React.FC<LogPanelProps> = ({ lines = [] }) => {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines]);

  const renderLine = (line: LogLine): React.ReactNode => {
    if (typeof line === "string") {
      return line;
    }

    const phase =
      typeof line.phase === "string" && line.phase.length > 0
        ? line.phase
        : null;
    const text =
      typeof line.text === "string" && line.text.length > 0
        ? line.text
        : JSON.stringify(line);

    return (
      <>
        {phase && <span className="tag">[{phase}]</span>} {text}
      </>
    );
  };

  return (
    <div className="terminal" ref={ref} role="log" aria-live="polite">
      {lines.map((line, index) => (
        <div key={index} className="line">
          {renderLine(line)}
        </div>
      ))}
    </div>
  );
};

export default LogPanel;
