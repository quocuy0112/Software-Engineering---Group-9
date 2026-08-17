"use client";

import Link from "next/link";
import { useEffect } from "react";
import { JobHeroCard } from "@/frontend/components/ui/job-hero-card";
import type { JobDetail } from "@/shared/contracts/jobs/discovery";
import { formatSalary } from "@/shared/utils/jobs/job-display";
import { CompanyLogo, JobDetailSidebar } from "./job-detail-sidebar";
import { JobDetailOverview, JobDetailSections } from "./job-detail-sections";
import { JobMetaIcon } from "./job-meta-icon";
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

function DetailActionButtons({
  job,
  applied,
}: {
  job: JobDetail;
  applied: boolean;
}) {
  const applyPath = "/jobs/" + job.slug + "/apply";
  const returnTo = encodeURIComponent(applyPath);

  return (
    <div className="job-detail-primary-actions">
      {job.state === "ACTIVE" && job.actions.canApply ? (
        applied ? (
          <span className="job-applied-state">✓ Applied</span>
        ) : job.actions.authenticated ? (
          <Link
            className="sh-button job-detail-apply-button job-detail-board-apply-button"
            href={applyPath}
          >
            Apply now
          </Link>
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

      {job.actions.authenticated && job.state === "ACTIVE" ? (
        <Link
          className="job-secondary-button job-detail-match-button"
          href={`/cv-match-check/new?jobId=${encodeURIComponent(job.id)}`}
        >
          Check CV fit privately
        </Link>
      ) : null}

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
  const applied =
    job.actions.applied ||
    Boolean(shared?.records[job.id]?.applied);
  const registerJob = shared?.registerJob;

  useEffect(() => {
    registerJob?.(job.id, {
      saved: job.actions.saved,
      applied: job.actions.applied,
    });
  }, [job.actions.applied, job.actions.saved, job.id, registerJob]);

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
          <JobHeroCard
            className="job-detail-hero"
            company={job.company}
            companyLogo={<CompanyLogo company={job.company} large />}
            verified={job.isVerified}
            status={stateLabel[job.state]}
            title={job.title}
            stats={[
              {
                icon: <JobMetaIcon name="location" />,
                label: "Location",
                value: job.location,
              },
              {
                icon: <JobMetaIcon name="experience" />,
                label: "Experience",
                value:
                  job.experienceMinYears !== undefined
                    ? job.experienceMinYears + "+ years"
                    : "No experience required",
              },
              {
                icon: <JobMetaIcon name="deadline" />,
                label: "Application deadline",
                value: job.applicationDeadline
                  ? jobDate.format(new Date(job.applicationDeadline))
                  : "Open until filled",
              },
            ]}
            pitch={job.summary}
            salaryRange={
              <span
                className={
                  job.salary?.isNegotiable
                    ? "job-salary--negotiable"
                    : undefined
                }
              >
                {formatSalary(job.salary)}
              </span>
            }
            actions={
              <DetailActionButtons
                job={job}
                applied={applied}
              />
            }
          />

          <JobDetailOverview job={job} />
          <WhyJoinUsSection job={job} />
          <JobDetailSections job={job} includeOverview={false} />

          <RelatedJobsCarousel jobs={job.relatedJobs ?? []} />
        </main>

        <JobDetailSidebar job={job} />
      </div>
    </article>
  );
}

export const JobDetailView = JobDetailPage;
