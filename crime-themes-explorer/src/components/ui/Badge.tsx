import React from "react";

export default function Badge({
  tone = "",
  children,
  className = "",
}: {
  tone?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`badge ${tone} ${className}`.trim()}>{children}</span>
  );
}
