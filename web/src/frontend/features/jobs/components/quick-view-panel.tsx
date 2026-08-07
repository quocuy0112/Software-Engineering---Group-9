"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import type { JobCard } from "@/shared/contracts/jobs/discovery";
import { JobApplicationAction } from "./job-application-form";
import { QuickSkillChips } from "./quick-skill-chips";
import { useOptionalJobInteraction } from "./job-interaction-provider";
import { SaveJobAction } from "./save-job-action";
import { jobWhyHighlights } from "./job-detail-data";

function formatSalary(value: JobCard["salary"]) {
  if (!value) return "Salary not disclosed";
  const formatter = new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: value.currency,
    maximumFractionDigits: 0,
  });
  return (
    formatter.format(value.minimum) +
    " - " +
    formatter.format(value.maximum) +
    " / " +
    value.period.toLowerCase()
  );
}

function experienceLabel(value: string) {
  return value
    .replace("_", " ")
    .toLowerCase()
    .replace(/\b\w/gu, (character) => character.toUpperCase());
}

export function QuickViewPanel({
  jobs,
  jobId,
  onClose,
  onJobChange,
}: {
  jobs: JobCard[];
  jobId: string | null;
  onClose: () => void;
  onJobChange: (jobId: string) => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const returnTarget = useRef<HTMLElement | null>(null);
  const shared = useOptionalJobInteraction();
  const job = useMemo(
    () => jobs.find((item) => item.id === jobId) ?? null,
    [jobId, jobs],
  );
  const applied = job
    ? job.actions.applied || Boolean(shared?.records[job.id]?.applied)
    : false;
  const index = job ? jobs.findIndex((item) => item.id === job.id) : -1;
  const highlights = job ? jobWhyHighlights(job).slice(0, 3) : [];

  useEffect(() => {
    if (!job) return;
    returnTarget.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => panelRef.current?.focus(), 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "ArrowRight" && index < jobs.length - 1) {
        onJobChange(jobs[index + 1]!.id);
      }
      if (event.key === "ArrowLeft" && index > 0) {
        onJobChange(jobs[index - 1]!.id);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [index, job, jobs, onClose, onJobChange]);

  useEffect(() => {
    if (job) return;
    returnTarget.current?.focus();
  }, [job]);

  if (!job) return null;

  return (
    <div
      className="job-quick-view-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        ref={panelRef}
        className="job-quick-view-panel job-quick-view-panel--redesign"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-view-title"
        tabIndex={-1}
      >
        <header className="job-quick-view-header">
          <div>
            <p className="panel-kicker">QUICK VIEW</p>
            <p className="job-quick-view-counter">
              {index + 1} of {jobs.length} jobs
            </p>
          </div>
          <button
            className="job-icon-button"
            type="button"
            aria-label="Close quick view"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="job-quick-view-scroll">
          <div className="job-quick-view-company">
            <span className="job-company-logo is-large">
              <span aria-hidden="true">
                {job.company.displayName.slice(0, 1).toUpperCase()}
              </span>
            </span>
            <div>
              <p className="job-company-name">{job.company.displayName}</p>
              <span className="job-verified-inline">
                <span aria-hidden="true">✓</span> Verified company
              </span>
            </div>
          </div>

          <h2 id="quick-view-title">{job.title}</h2>
          <dl className="job-quick-view-meta">
            <div>
              <dt>Salary</dt>
              <dd>{formatSalary(job.salary)}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{job.location}</dd>
            </div>
            <div>
              <dt>Experience</dt>
              <dd>{experienceLabel(job.experienceLevel)}</dd>
            </div>
          </dl>

          <section
            className="job-quick-view-block"
            aria-labelledby="quick-skills-heading"
          >
            <div className="job-quick-view-block-heading">
              <p className="panel-kicker" id="quick-skills-heading">
                QUICK SKILL CHIPS
              </p>
              <span aria-hidden="true">◎</span>
            </div>
            <QuickSkillChips job={job} compact />
          </section>

          <section
            className="job-quick-view-block"
            aria-labelledby="quick-reasons-heading"
          >
            <div className="job-quick-view-block-heading">
              <h3 id="quick-reasons-heading">Why you&apos;ll love it</h3>
              <span aria-hidden="true">✦</span>
            </div>
            <ul className="job-quick-view-reasons">
              {highlights.map((highlight) => (
                <li key={highlight}>
                  <span aria-hidden="true">✓</span>
                  {highlight}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <footer className="job-quick-view-footer job-quick-view-footer--redesign">
          <div className="job-quick-view-cta">
            {applied ? (
              <span className="job-applied-state">✓ Applied</span>
            ) : job.actions.canApply ? (
              job.actions.authenticated ? (
                <JobApplicationAction
                  jobId={job.id}
                  jobSlug={job.slug}
                  initialApplied={job.actions.applied}
                  onActivate={onClose}
                />
              ) : (
                <Link
                  className="sh-button job-quick-view-apply"
                  href={
                    "/login?returnTo=" + encodeURIComponent("/jobs/" + job.slug)
                  }
                  onClick={onClose}
                >
                  Sign in to apply
                </Link>
              )
            ) : (
              <span className="job-closed-state">Applications closed</span>
            )}

            {job.actions.authenticated && job.actions.canSave ? (
              <SaveJobAction
                jobId={job.id}
                initialSaved={job.actions.saved}
                initialApplied={job.actions.applied}
                variant="button"
              />
            ) : (
              <Link
                className="job-secondary-button"
                href={
                  "/login?returnTo=" + encodeURIComponent("/jobs/" + job.slug)
                }
                onClick={onClose}
              >
                <span aria-hidden="true">♡</span> Save
              </Link>
            )}
          </div>
          <Link
            className="job-quick-view-full-link"
            href={"/jobs/" + job.slug}
            onClick={onClose}
          >
            View full details <span aria-hidden="true">→</span>
          </Link>
          <div
            className="job-quick-view-navigation"
            aria-label="Quick view navigation"
          >
            <button
              className="job-icon-button"
              type="button"
              aria-label="Previous job"
              disabled={index <= 0}
              onClick={() => onJobChange(jobs[index - 1]!.id)}
            >
              ←
            </button>
            <button
              className="job-icon-button"
              type="button"
              aria-label="Next job"
              disabled={index >= jobs.length - 1}
              onClick={() => onJobChange(jobs[index + 1]!.id)}
            >
              →
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
