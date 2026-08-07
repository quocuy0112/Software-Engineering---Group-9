"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { JobCard as JobCardData } from "@/shared/contracts/jobs/discovery";
import {
  formatRelativeTime,
  formatSalary,
} from "@/shared/utils/jobs/job-display";
import { ApplyFormSection } from "./apply-form-section";
import { CompanyAvatar } from "./company-avatar";
import { QuickViewPanel } from "./quick-view-panel";
import { useOptionalJobInteraction } from "./job-interaction-provider";
import { SaveJobAction } from "./save-job-action";

const labels: Record<string, string> = {
  FULL_TIME: "Full time",
  PART_TIME: "Part time",
  CONTRACT: "Contract",
  INTERNSHIP: "Internship",
  TEMPORARY: "Temporary",
  ENTRY: "Entry level",
  JUNIOR: "Junior",
  MID: "Mid-level",
  SENIOR: "Senior",
  LEAD: "Lead",
  MANAGER: "Manager",
  ONSITE: "On-site",
  HYBRID: "Hybrid",
  REMOTE: "Remote",
};

export type JobCardVariant = "grid" | "row";
export type JobCardTimeMode = "posted" | "updated";

function timeLabel(job: JobCardData, timeMode: JobCardTimeMode) {
  const value =
    timeMode === "updated"
      ? (job.updatedAt ?? job.publishedAt)
      : job.publishedAt;
  return (
    (timeMode === "updated" ? "Updated " : "Posted ") +
    formatRelativeTime(value)
  );
}

function visibleTagValues(job: JobCardData) {
  return [...job.skills].filter(
    (value, index, values): value is string =>
      Boolean(value) && values.indexOf(value) === index,
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.8 8.8c0 5.3-8.8 10.4-8.8 10.4S3.2 14.1 3.2 8.8A4.6 4.6 0 0 1 12 6.3a4.6 4.6 0 0 1 8.8 2.5Z" />
    </svg>
  );
}

function HideIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A10.7 10.7 0 0 0 2.5 12c1.5 4 5 7 9.5 7 1.2 0 2.3-.2 3.3-.6M14.1 4.8c3.5.8 6.3 3.6 7.4 7.2a12 12 0 0 1-2.1 4.1" />
    </svg>
  );
}

function QuickViewIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

export function JobCardHeader({
  job,
  timeMode,
}: {
  job: JobCardData;
  timeMode: JobCardTimeMode;
}) {
  return (
    <header className="job-card-header job-redesign-card-header">
      <CompanyAvatar
        name={job.company.displayName}
        imageUrl={job.company.logoUrl}
        size="sm"
        className="job-card-avatar"
      />
      <div className="job-card-company-block">
        <p className="job-card-company-name">{job.company.displayName}</p>
      </div>
      <div className="job-card-header-meta">
        <p
          className={
            "job-salary" +
            (job.salary?.isNegotiable ? " job-salary--negotiable" : "")
          }
        >
          {formatSalary(job.salary)}
        </p>
        <p className="job-card-timing">
          <time
            dateTime={
              timeMode === "updated"
                ? (job.updatedAt ?? job.publishedAt)
                : job.publishedAt
            }
          >
            {timeLabel(job, timeMode)}
          </time>
        </p>
      </div>
    </header>
  );
}

export function JobCardBody({ job }: { job: JobCardData }) {
  const tagValues = visibleTagValues(job);
  const secondaryTags = [
    labels[job.employmentType] ?? job.employmentType,
    labels[job.experienceLevel] ?? job.experienceLevel,
  ];
  const taxonomyPreview = tagValues.slice(0, 3).join(" | ");
  const overflowTags = tagValues.slice(3);

  return (
    <div className="job-card-body">
      <h2 id={"job-" + job.id} className="job-card-title">
        <Link href={"/jobs/" + job.slug}>{job.title}</Link>
      </h2>
      <p className="job-card-location">{job.location}</p>
      <div className="job-card-tags" aria-label="Job tags">
        {secondaryTags.map((tag) => (
          <span className="job-card-tag" key={tag}>
            {tag}
          </span>
        ))}
        {taxonomyPreview ? (
          <span className="job-card-tag job-card-tag--taxonomy">
            {taxonomyPreview}
          </span>
        ) : null}
        {overflowTags.length ? (
          <details className="job-card-overflow">
            <summary
              aria-label={"Show " + String(overflowTags.length) + " more tags"}
            >
              +{overflowTags.length}
            </summary>
            <div role="tooltip">{overflowTags.join(" | ")}</div>
          </details>
        ) : null}
      </div>
    </div>
  );
}

function SignInApplyLink({ job }: { job: JobCardData }) {
  const returnTo = "/jobs/" + job.slug + "?openApply=true#apply";
  return (
    <Link
      className="sh-button job-card-apply-button"
      href={"/login?returnTo=" + encodeURIComponent(returnTo)}
    >
      Apply
    </Link>
  );
}

function JobCardApplicationDialog({
  job,
  applied,
  onClose,
}: {
  job: JobCardData;
  applied: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => dialogRef.current?.focus(), 0);

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="job-card-apply-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="job-card-apply-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-apply-heading"
        tabIndex={-1}
      >
        <ApplyFormSection
          jobId={job.id}
          jobTitle={job.title}
          open
          applied={applied}
          onOpenChange={(open) => {
            if (!open) onClose();
          }}
        />
      </div>
    </div>
  );
}

export function ApplyButton({ job }: { job: JobCardData }) {
  const shared = useOptionalJobInteraction();
  const [open, setOpen] = useState(false);
  const applied =
    job.actions.applied || Boolean(shared?.records[job.id]?.applied);
  const close = useCallback(() => setOpen(false), []);

  if (applied) {
    return (
      <span role="status" className="job-applied-state">
        Applied
      </span>
    );
  }

  if (!job.actions.canApply) {
    return <span className="job-closed-state">Applications closed</span>;
  }

  if (!job.actions.authenticated) return <SignInApplyLink job={job} />;

  return (
    <>
      <button
        className="sh-button job-card-apply-button"
        type="button"
        aria-expanded={open}
        aria-controls={"job-apply-dialog-" + job.id}
        onClick={() => setOpen(true)}
      >
        Apply
      </button>
      {open ? (
        <div id={"job-apply-dialog-" + job.id}>
          <JobCardApplicationDialog
            job={job}
            applied={applied}
            onClose={close}
          />
        </div>
      ) : null}
    </>
  );
}

export function SaveButton({ job }: { job: JobCardData }) {
  if (job.actions.authenticated && job.actions.canSave) {
    return (
      <SaveJobAction
        jobId={job.id}
        initialSaved={job.actions.saved}
        initialApplied={job.actions.applied}
        variant="icon"
      />
    );
  }

  return (
    <Link
      className="job-icon-button job-heart-button"
      href={"/login?returnTo=" + encodeURIComponent("/jobs/" + job.slug)}
      aria-label="Sign in to save this job"
      title="Sign in to save this job"
    >
      <HeartIcon />
    </Link>
  );
}

export function HideButton({
  jobId,
  onHidden,
}: {
  jobId: string;
  onHidden?: () => void;
}) {
  const shared = useOptionalJobInteraction();

  return (
    <button
      className="job-icon-button job-card-hover-action"
      type="button"
      aria-label="Hide job"
      title="Hide job"
      onClick={() => {
        shared?.hideJob(jobId);
        onHidden?.();
      }}
    >
      <HideIcon />
    </button>
  );
}

export function QuickViewButton({ onQuickView }: { onQuickView: () => void }) {
  return (
    <button
      className="job-icon-button job-card-hover-action"
      type="button"
      aria-label="Quick view"
      title="Quick view"
      onClick={onQuickView}
    >
      <QuickViewIcon />
    </button>
  );
}

export function JobCardActions({
  job,
  variant,
  onQuickView,
  onHidden,
}: {
  job: JobCardData;
  variant: JobCardVariant;
  onQuickView?: () => void;
  onHidden?: () => void;
}) {
  const [localQuickViewOpen, setLocalQuickViewOpen] = useState(false);
  const openQuickView = () => {
    if (onQuickView) onQuickView();
    else setLocalQuickViewOpen(true);
  };

  return (
    <>
      <footer
        className={
          "job-card-footer job-redesign-card-footer job-card-footer--" + variant
        }
      >
        {variant === "row" ? (
          <div className="job-card-row-actions" aria-label="Job actions">
            <QuickViewButton onQuickView={openQuickView} />
            <HideButton jobId={job.id} onHidden={onHidden} />
            <SaveButton job={job} />
            <ApplyButton job={job} />
          </div>
        ) : (
          <div className="job-card-grid-actions" aria-label="Job actions">
            <QuickViewButton onQuickView={openQuickView} />
            <HideButton jobId={job.id} onHidden={onHidden} />
            <ApplyButton job={job} />
            <SaveButton job={job} />
          </div>
        )}
      </footer>

      {!onQuickView ? (
        <QuickViewPanel
          jobs={[job]}
          jobId={localQuickViewOpen ? job.id : null}
          onClose={() => setLocalQuickViewOpen(false)}
          onJobChange={() => setLocalQuickViewOpen(true)}
        />
      ) : null}
    </>
  );
}

export function JobCard({
  job,
  variant = "row",
  timeMode = "posted",
  onQuickView,
  onHidden,
}: {
  job: JobCardData;
  variant?: JobCardVariant;
  timeMode?: JobCardTimeMode;
  onQuickView?: () => void;
  onHidden?: () => void;
}) {
  return (
    <article
      className={"group job-card job-redesign-card job-card--" + variant}
      aria-labelledby={"job-" + job.id}
    >
      <JobCardHeader job={job} timeMode={timeMode} />
      <JobCardBody job={job} />
      <JobCardActions
        job={job}
        variant={variant}
        onQuickView={onQuickView}
        onHidden={onHidden}
      />
    </article>
  );
}

export function JobCardView(props: {
  job: JobCardData;
  variant?: JobCardVariant;
  timeMode?: JobCardTimeMode;
  onQuickView?: () => void;
  onHidden?: () => void;
}) {
  return <JobCard {...props} />;
}
