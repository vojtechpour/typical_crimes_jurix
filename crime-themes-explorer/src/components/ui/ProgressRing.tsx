import React from "react";

interface ProgressRingProps {
  value: number; // 0..100
  size?: number; // px
  strokeWidth?: number; // px
  ariaLabel?: string;
  className?: string;
}

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

export default function ProgressRing({
  value,
  size = 24,
  strokeWidth = 4,
  ariaLabel = "progress",
  className = "",
}: ProgressRingProps) {
  const normalized = clamp(value, 0, 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - normalized / 100);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${ariaLabel}: ${Math.round(normalized)}%`}
      className={`progress-ring-svg ${className}`.trim()}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="transparent"
        strokeWidth={strokeWidth}
        className="progress-ring-track"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="transparent"
        strokeWidth={strokeWidth}
        className="progress-ring-value"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}
