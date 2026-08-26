import type { ReactNode } from "react";

export type StatChipProps = {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  className?: string;
};

export function StatChip({
  icon,
  label,
  value,
  className = "",
}: StatChipProps) {
  return (
    <div className={["sh-stat-chip", className].filter(Boolean).join(" ")}>
      <span
        className="sh-stat-chip__icon job-detail-quick-info-icon"
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="sh-stat-chip__content">
        <span className="sh-stat-chip__label job-detail-quick-info-label">
          {label}
        </span>
        <strong className="sh-stat-chip__value">{value}</strong>
      </span>
    </div>
  );
}
