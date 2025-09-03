import React, { useEffect, useRef } from "react";

export default function LogPanel({ lines = [] }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines]);
  return (
    <div className="terminal" ref={ref} role="log" aria-live="polite">
      {lines.map((l, i) => (
        <div key={i} className="line">
          {typeof l === "string" ? (
            l
          ) : (
            <>
              {l.phase && <span className="tag">[{l.phase}]</span>} {l.text}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
