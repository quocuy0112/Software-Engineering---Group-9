import Link from "next/link";
import type { ReactNode } from "react";

export type RelatedJobRowProps = {
  avatarLabel: string;
  avatar?: ReactNode;
  title: string;
  isNew?: boolean;
  badgeLabel?: string;
  company: string;
  location: string;
  updatedAt?: string;
  salaryRange: string;
  saved?: boolean;
  onToggleSave?: () => void | Promise<void>;
  saveAction?: ReactNode;
  href?: string;
  compact?: boolean;
};

function Avatar({
  avatar,
  avatarLabel,
}: Pick<RelatedJobRowProps, "avatar" | "avatarLabel">) {
  return (
    avatar ?? (
      <span className="job-related-row__avatar-fallback">{avatarLabel}</span>
    )
  );
}

export function RelatedJobRow({
  avatarLabel,
  avatar,
  title,
  isNew = false,
  badgeLabel,
  company,
  location,
  updatedAt,
  salaryRange,
  saved = false,
  onToggleSave,
  saveAction,
  href,
  compact = false,
}: RelatedJobRowProps) {
  const titleContent = href ? <Link href={href}>{title}</Link> : title;
  const badge = badgeLabel ?? (isNew ? "New" : null);

  return (
    <article
      className={[
        "sh-related-job-row",
        "job-related-list-item",
        compact ? "sh-related-job-row--compact" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {href ? (
        <Link
          className="job-related-list-logo"
          href={href}
          aria-label={`${company} - ${title}`}
        >
          <Avatar avatar={avatar} avatarLabel={avatarLabel} />
        </Link>
      ) : (
        <span className="job-related-list-logo" aria-hidden="true">
          <Avatar avatar={avatar} avatarLabel={avatarLabel} />
        </span>
      )}

      <div className="job-related-list-content">
        <div className="job-related-list-title-row">
          <h3>{titleContent}</h3>
          {badge ? <span className="job-related-badge">{badge}</span> : null}
        </div>
        <p className="job-related-list-company">{company}</p>
        <div className="job-related-list-meta">
          <span>{location}</span>
          {!compact && updatedAt ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{updatedAt}</span>
            </>
          ) : null}
        </div>
      </div>

      <div className="job-related-list-side">
        <strong>{salaryRange}</strong>
        {saveAction ??
          (onToggleSave ? (
            <button
              className="job-icon-button job-heart-button"
              type="button"
              aria-label={saved ? "Remove saved job" : "Save job"}
              aria-pressed={saved}
              onClick={() => void onToggleSave()}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path
                  d="M20.8 8.8c0 5.3-8.8 10.4-8.8 10.4S3.2 14.1 3.2 8.8A4.6 4.6 0 0 1 12 6.3a4.6 4.6 0 0 1 8.8 2.5Z"
                  fill={saved ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              </svg>
            </button>
          ) : null)}
      </div>
    </article>
  );
}
