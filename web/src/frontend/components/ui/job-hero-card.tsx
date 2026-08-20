import Link from "next/link";
import type { ReactNode } from "react";
import type { StatChipProps } from "./stat-chip";
import { StatChip } from "./stat-chip";

export type JobHeroCardProps = {
  company: { displayName: string };
  companyLogo?: ReactNode;
  verified?: boolean;
  status: string;
  title: string;
  stats: readonly StatChipProps[];
  pitch?: ReactNode;
  salaryRange?: ReactNode;
  onApply?: () => void;
  applyAction?: ReactNode;
  saved?: boolean;
  onToggleSave?: () => void;
  saveAction?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
  eyebrow?: string;
  className?: string;
};

export function JobHeroCard({
  company,
  companyLogo,
  verified = false,
  status,
  title,
  stats,
  pitch,
  salaryRange,
  onApply,
  applyAction,
  saved = false,
  onToggleSave,
  saveAction,
  actions,
  backHref = "/jobs",
  backLabel = "Back to jobs",
  eyebrow = "A role worth your next move",
  className = "",
}: JobHeroCardProps) {
  return (
    <article
      className={["sh-job-hero", "job-detail-hero--redesign", className]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="job-detail-header-topline">
        <Link className="job-detail-back" href={backHref}>
          <span aria-hidden="true">←</span> {backLabel}
        </Link>
        <span
          className="job-state"
          data-state={status.toLowerCase()}
          aria-label={`Job status: ${status}`}
        >
          <span className="job-state__dot" aria-hidden="true" />
          {status}
        </span>
      </div>

      <div className="job-detail-company-lockup">
        {companyLogo}
        <div>
          <p className="job-company-name">{company.displayName}</p>
          {verified ? (
            <span className="job-verified-inline">
              <span aria-hidden="true">✓</span> Verified SmartHire employer
            </span>
          ) : null}
        </div>
      </div>

      <p className="job-detail-eyebrow">{eyebrow}</p>
      <h1>{title}</h1>

      <div className="job-detail-quick-info" aria-label="Key job information">
        {stats.map((stat) => (
          <StatChip
            key={stat.label}
            {...stat}
            className={["job-detail-quick-info-item", stat.className]
              .filter(Boolean)
              .join(" ")}
          />
        ))}
      </div>

      {pitch ? <p className="job-detail-summary">{pitch}</p> : null}
      {salaryRange ? (
        <div className="job-detail-salary-line">
          <strong>{salaryRange}</strong>
        </div>
      ) : null}

      <div className="job-detail-action-row" aria-label="Job actions">
        {actions ?? (
          <div className="job-detail-primary-actions">
            {applyAction ??
              (onApply ? (
                <button
                  className="sh-button job-detail-apply-button job-detail-board-apply-button"
                  type="button"
                  onClick={onApply}
                >
                  Apply now
                </button>
              ) : null)}
            {saveAction ??
              (onToggleSave ? (
                <button
                  className="job-secondary-button job-save-button"
                  type="button"
                  aria-pressed={saved}
                  onClick={onToggleSave}
                >
                  {saved ? "Saved" : "Save"}
                </button>
              ) : null)}
          </div>
        )}
      </div>
    </article>
  );
}
