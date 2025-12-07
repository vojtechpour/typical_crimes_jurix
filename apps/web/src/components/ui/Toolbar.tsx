import React from "react";

interface ToolbarProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export default function Toolbar({
  title,
  subtitle,
  actions,
  className = "",
}: ToolbarProps) {
  return (
    <div className={`card-header row ${className}`.trim()}>
      <div className="row" style={{ gap: 8, alignItems: "baseline" }}>
        {title && <h3>{title}</h3>}
        {subtitle && <span className="muted">{subtitle}</span>}
      </div>
      <span className="spacer" />
      {actions && (
        <div className="row" style={{ gap: 8 }}>
          {actions}
        </div>
      )}
    </div>
  );
}
