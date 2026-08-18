"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import {
  BadgeCheck,
  BriefcaseBusiness,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  MapPin,
  Sparkles,
  WalletCards,
  X,
} from "lucide-react";
import type { JobCard } from "@/shared/contracts/jobs/discovery";
import { formatSalary } from "@/shared/utils/jobs/job-display";
import { JobApplicationAction } from "./job-application-form";
import { QuickSkillChips } from "./quick-skill-chips";
import { useOptionalJobInteraction } from "./job-interaction-provider";
import { SaveBookmarkIcon, SaveJobAction } from "./save-job-action";
import { jobWhyHighlights } from "./job-detail-data";
import { CompanyAvatar } from "./company-avatar";

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
            <p className="panel-kicker">Quick view</p>
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
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="job-quick-view-scroll">
          <div className="job-quick-view-company">
            <CompanyAvatar
              name={job.company.displayName}
              imageUrl={job.company.logoUrl}
              size="lg"
              className="job-company-logo is-large"
              loading="eager"
            />
            <div>
              <div className="job-quick-view-company-meta">
                <p className="job-company-name">{job.company.displayName}</p>
                <span className="job-verified-inline">
                  <BadgeCheck aria-hidden="true" /> Verified company
                </span>
              </div>
              <h2 id="quick-view-title">{job.title}</h2>
            </div>
          </div>

          <dl className="job-quick-view-meta">
            <div>
              <dt>
                <WalletCards aria-hidden="true" /> Salary
              </dt>
              <dd
                className={
                  job.salary?.isNegotiable
                    ? "job-salary--negotiable"
                    : undefined
                }
              >
                {formatSalary(job.salary)}
              </dd>
            </div>
            <div>
              <dt>
                <MapPin aria-hidden="true" /> Location
              </dt>
              <dd>{job.location}</dd>
            </div>
            <div>
              <dt>
                <BriefcaseBusiness aria-hidden="true" /> Experience
              </dt>
              <dd>{experienceLabel(job.experienceLevel)}</dd>
            </div>
          </dl>

          <section
            className="job-quick-view-block"
            aria-labelledby="quick-skills-heading"
          >
            <div className="job-quick-view-block-heading">
              <p className="panel-kicker" id="quick-skills-heading">
                Required skills
              </p>
              <CircleHelp aria-hidden="true" />
            </div>
            <QuickSkillChips job={job} compact />
          </section>

          <section
            className="job-quick-view-block"
            aria-labelledby="quick-reasons-heading"
          >
            <div className="job-quick-view-block-heading">
              <h3 id="quick-reasons-heading">
                <Sparkles aria-hidden="true" /> Why you&apos;ll love it
              </h3>
            </div>
            <ul className="job-quick-view-reasons">
              {highlights.map((highlight) => (
                <li key={highlight}>
                  <Check aria-hidden="true" />
                  {highlight}
                </li>
              ))}
            </ul>
          </section>

          <Link
            className="job-quick-view-full-link"
            href={"/jobs/" + job.slug}
            onClick={onClose}
          >
            View full job details <ChevronRight aria-hidden="true" />
          </Link>
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
                className="job-secondary-button job-save-button"
                href={
                  "/login?returnTo=" + encodeURIComponent("/jobs/" + job.slug)
                }
                onClick={onClose}
              >
                <SaveBookmarkIcon />
                <span>Save</span>
              </Link>
            )}
          </div>
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
              <ChevronLeft aria-hidden="true" />
            </button>
            <button
              className="job-icon-button"
              type="button"
              aria-label="Next job"
              disabled={index >= jobs.length - 1}
              onClick={() => onJobChange(jobs[index + 1]!.id)}
            >
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
