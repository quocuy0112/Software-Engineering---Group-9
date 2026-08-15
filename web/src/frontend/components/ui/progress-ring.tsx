import type { CSSProperties } from "react";

function clampPercent(percent: number) {
  return Math.min(100, Math.max(0, Number.isFinite(percent) ? percent : 0));
}

/** Use in spacious hero content. Use ProgressBar for compact profile panels. */
export function ProgressRing({
  percent,
  size = 150,
  label = "Profile completion",
  caption = "complete",
}: {
  percent: number;
  size?: number;
  label?: string;
  caption?: string;
}) {
  const value = clampPercent(percent);

  return (
    <div
      className="sh-progress-ring"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      style={{ "--sh-progress-ring-size": `${size}px` } as CSSProperties}
    >
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="sh-progress-ring__track" cx="60" cy="60" r="52" />
        <circle
          className="sh-progress-ring__value"
          cx="60"
          cy="60"
          r="52"
          pathLength="100"
          strokeDasharray={`${value} 100`}
        />
      </svg>
      <span className="sh-progress-ring__copy">
        <strong>{value}%</strong>
        <small>{caption}</small>
      </span>
    </div>
  );
}
