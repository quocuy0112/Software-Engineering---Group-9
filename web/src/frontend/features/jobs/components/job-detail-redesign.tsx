"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { JobDetail } from "@/shared/contracts/jobs/discovery";
import { formatSalary } from "@/shared/utils/jobs/job-display";
import { ApplyFormSection } from "./apply-form-section";
import { CompanyLogo, JobDetailSidebar } from "./job-detail-sidebar";
import { JobDetailOverview, JobDetailSections } from "./job-detail-sections";
import { QuickSkillChips } from "./quick-skill-chips";
import { RelatedJobsCarousel } from "./related-jobs-carousel";
import { SaveJobAction } from "./save-job-action";
import { useOptionalJobInteraction } from "./job-interaction-provider";
import { WhyJoinUsSection } from "./why-join-us-section";

const stateLabel = {
  ACTIVE: "Active",
  CLOSED: "Closed",
  EXPIRED: "Expired",
} as const;

const jobDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

function shouldOpenApplyFromLocation() {
  const params = new URLSearchParams(window.location.search);
  return (
    window.location.hash.toLowerCase() === "#apply" ||
    params.get("apply") === "true" ||
    params.get("openApply") === "true"
  );
}

function DetailActionButtons({
  job,
  applied,
  applyOpen,
  onApply,
}: {
  job: JobDetail;
  applied: boolean;
  applyOpen: boolean;
  onApply: () => void;
}) {
  const returnTo = encodeURIComponent("/jobs/" + job.slug);

  return (
    <div className="job-detail-primary-actions">
      {job.state === "ACTIVE" && job.actions.canApply ? (
        applied ? (
          <span className="job-applied-state">✓ Applied</span>
        ) : job.actions.authenticated ? (
          <button
            className="sh-button job-detail-apply-button job-detail-board-apply-button"
            type="button"
            aria-expanded={applyOpen}
            aria-controls="apply"
            onClick={onApply}
          >
            {applyOpen ? "Hide application form" : "Apply now"}
          </button>
        ) : (
          <Link
            className="sh-button job-detail-apply-button job-detail-board-apply-button"
            href={"/login?returnTo=" + returnTo}
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
          href={"/login?returnTo=" + returnTo}
        >
          <span aria-hidden="true">♡</span> Save
        </Link>
      )}
    </div>
  );
}

export function JobDetailPage({ job }: { job: JobDetail }) {
  const shared = useOptionalJobInteraction();
  const [applyOpen, setApplyOpen] = useState(false);
  const [submittedHere, setSubmittedHere] = useState(false);
  const applied =
    job.actions.applied ||
    submittedHere ||
    Boolean(shared?.records[job.id]?.applied);
  const registerJob = shared?.registerJob;

  useEffect(() => {
    registerJob?.(job.id, {
      saved: job.actions.saved,
      applied: job.actions.applied,
    });
  }, [job.actions.applied, job.actions.saved, job.id, registerJob]);
  useEffect(() => {
    function syncApplyState() {
      setApplyOpen(shouldOpenApplyFromLocation());
    }

    syncApplyState();
    window.addEventListener("hashchange", syncApplyState);
    window.addEventListener("popstate", syncApplyState);
    return () => {
      window.removeEventListener("hashchange", syncApplyState);
      window.removeEventListener("popstate", syncApplyState);
    };
  }, []);

  function setApplyVisibility(next: boolean) {
    setApplyOpen(next);
    const url = new URL(window.location.href);
    if (next) {
      url.searchParams.set("apply", "true");
      url.searchParams.delete("openApply");
      url.hash = "";
    } else {
      url.hash = "";
      url.searchParams.delete("apply");
      url.searchParams.delete("openApply");
    }
    window.history.replaceState(null, "", url);
  }

  return (
    <article className="jobs-detail-page job-redesign-detail job-detail-board-page">
      <nav className="job-detail-breadcrumb" aria-label="Breadcrumb">
        <Link href="/jobs">Jobs</Link>
        <span aria-hidden="true">&gt;</span>
        <Link href="/jobs">
          {job.categoryFamily ?? job.company.industry ?? "All jobs"}
        </Link>
        <span aria-hidden="true">&gt;</span>
        <span aria-current="page">{job.title}</span>
      </nav>

      <div className="job-detail-layout job-detail-layout--redesign job-detail-layout--board">
        <main className="job-detail-main job-detail-main--redesign job-detail-main--board">
          <header className="job-detail-hero job-detail-hero--redesign">
            <div className="job-detail-header-topline">
              <Link className="job-detail-back" href="/jobs">
                <span aria-hidden="true">←</span> Back to jobs
              </Link>
              <span
                className="job-state"
                aria-label={"Job status: " + stateLabel[job.state]}
              >
                {stateLabel[job.state]}
              </span>
            </div>

            <div className="job-detail-company-lockup">
              <CompanyLogo company={job.company} large />
              <div>
                <p className="job-company-name">{job.company.displayName}</p>
                {job.isVerified ? (
                  <span className="job-verified-inline">
                    <span aria-hidden="true">✓</span> Verified SmartHire
                    employer
                  </span>
                ) : null}
              </div>
            </div>

            <p className="job-detail-eyebrow">A ROLE WORTH YOUR NEXT MOVE</p>
            <h1>{job.title}</h1>
            <div
              className="job-detail-quick-info"
              aria-label="Key job information"
            >
              <div className="job-detail-quick-info-item">
                <span className="job-detail-quick-info-icon" aria-hidden="true">
                  ⌖
                </span>
                <span>
                  <span className="job-detail-quick-info-label">Location</span>
                  <strong>{job.location}</strong>
                </span>
              </div>
              <div className="job-detail-quick-info-item">
                <span className="job-detail-quick-info-icon" aria-hidden="true">
                  ✦
                </span>
                <span>
                  <span className="job-detail-quick-info-label">
                    Experience
                  </span>
                  <strong>
                    {job.experienceMinYears !== undefined
                      ? job.experienceMinYears + "+ years"
                      : "No experience required"}
                  </strong>
                </span>
              </div>
              <div className="job-detail-quick-info-item">
                <span className="job-detail-quick-info-icon" aria-hidden="true">
                  ◷
                </span>
                <span>
                  <span className="job-detail-quick-info-label">
                    Application deadline
                  </span>
                  <strong>
                    {job.applicationDeadline
                      ? jobDate.format(new Date(job.applicationDeadline))
                      : "Open until filled"}
                  </strong>
                </span>
              </div>
            </div>
            <p className="job-detail-summary">{job.summary}</p>

            <div className="job-detail-salary-line">
              <strong
                className={
                  job.salary?.isNegotiable
                    ? "job-salary--negotiable"
                    : undefined
                }
              >
                {formatSalary(job.salary)}
              </strong>
            </div>

            <div className="job-detail-action-row" aria-label="Job actions">
              <DetailActionButtons
                job={job}
                applied={applied}
                applyOpen={applyOpen}
                onApply={() => setApplyVisibility(!applyOpen)}
              />
            </div>
          </header>

          <JobDetailOverview job={job} />
          <QuickSkillChips job={job} />
          <WhyJoinUsSection job={job} />
          <JobDetailSections job={job} includeOverview={false} />

          <ApplyFormSection
            jobId={job.id}
            jobTitle={job.title}
            open={applyOpen}
            applied={applied}
            onOpenChange={setApplyVisibility}
            onSubmitted={() => setSubmittedHere(true)}
          />
          <RelatedJobsCarousel jobs={job.relatedJobs ?? []} />
        </main>

        <JobDetailSidebar job={job} />
      </div>
    </article>
  );
}

export const JobDetailView = JobDetailPage;
