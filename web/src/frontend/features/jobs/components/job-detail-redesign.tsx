"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useEffect } from "react";
import { JobHeroCard } from "@/frontend/components/ui/job-hero-card";
import type { JobDetail } from "@/shared/contracts/jobs/discovery";
import { formatSalary } from "@/shared/utils/jobs/job-display";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { CompanyLogo, JobDetailSidebar } from "./job-detail-sidebar";
import { JobDetailOverview, JobDetailSections } from "./job-detail-sections";
import { JobMetaIcon } from "./job-meta-icon";
import { RelatedJobsCarousel } from "./related-jobs-carousel";
import { SaveBookmarkIcon, SaveJobAction } from "./save-job-action";
import { useOptionalJobInteraction } from "./job-interaction-provider";
import { WhyJoinUsSection } from "./why-join-us-section";
import { jobCopy } from "./job-copy";

function DetailActionButtons({
  job,
  applied,
  copy,
}: {
  job: JobDetail;
  applied: boolean;
  copy: ReturnType<typeof jobCopy>;
}) {
  const applyPath = "/jobs/" + job.slug + "/apply";
  const returnTo = encodeURIComponent(applyPath);

  return (
    <div className="job-detail-primary-actions">
      {applied ? (
        <span className="job-applied-state">✓ {copy.applied}</span>
      ) : job.state === "ACTIVE" && job.actions.applicationLimitReached ? (
        <span
          role="status"
          aria-label={copy.applicationLimitReached}
          className="job-closed-state"
        >
          {copy.applicationLimitReached}
        </span>
      ) : job.state === "ACTIVE" && job.actions.canApply ? (
        job.actions.authenticated ? (
          <Link
            className="sh-button job-detail-apply-button job-detail-board-apply-button"
            href={applyPath}
          >
            {copy.applyNow}
          </Link>
        ) : (
          <Link
            className="sh-button job-detail-apply-button job-detail-board-apply-button"
            href={"/login?returnTo=" + returnTo}
          >
            {copy.signInToApply}
          </Link>
        )
      ) : (
        <span className="job-closed-state">{copy.applicationsClosed}</span>
      )}

      {job.actions.authenticated && job.state === "ACTIVE" ? (
        <Link
          className="job-secondary-button job-detail-match-button"
          href={`/cv-match-check/new?jobId=${encodeURIComponent(job.id)}`}
          aria-label={copy.checkCvFitAria}
        >
          <Sparkles aria-hidden="true" />
          <span>{copy.checkCvFit}</span>
          <span className="job-detail-match-private-label">{copy.private}</span>
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
          className="job-secondary-button job-save-button"
          href={"/login?returnTo=" + returnTo}
        >
          <SaveBookmarkIcon />
          <span>{copy.save}</span>
        </Link>
      )}
    </div>
  );
}

export function JobDetailPage({ job }: { job: JobDetail }) {
  const locale = useWorkspaceLocale();
  const copy = jobCopy(locale);
  const stateLabel = {
    ACTIVE: copy.active,
    CLOSED: copy.closed,
    EXPIRED: copy.expired,
  } as const;
  const jobDate = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", {
    dateStyle: "medium",
  });
  const shared = useOptionalJobInteraction();
  const applied =
    job.actions.applied || Boolean(shared?.records[job.id]?.applied);
  const registerJob = shared?.registerJob;

  useEffect(() => {
    registerJob?.(job.id, {
      saved: job.actions.saved,
      applied: job.actions.applied,
    });
  }, [job.actions.applied, job.actions.saved, job.id, registerJob]);

  return (
    <article className="jobs-detail-page job-redesign-detail job-detail-board-page">
      <nav className="job-detail-breadcrumb" aria-label={copy.breadcrumb}>
        <Link href="/jobs">{copy.jobs}</Link>
        <span aria-hidden="true">&gt;</span>
        <Link href="/jobs">
          {job.categoryFamily ?? job.company.industry ?? copy.allJobs}
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
            verifiedLabel={copy.verifiedEmployer}
            status={stateLabel[job.state]}
            title={job.title}
            backLabel={copy.backToJobs}
            eyebrow={copy.roleWorthNextMove}
            statusLabelPrefix={copy.jobStatus}
            keyInformationLabel={copy.keyJobInformation}
            actionsLabel={copy.jobActions}
            stats={[
              {
                icon: <JobMetaIcon name="location" />,
                label: copy.location,
                value: job.location,
              },
              {
                icon: <JobMetaIcon name="experience" />,
                label: copy.experience,
                value:
                  job.experienceMinYears !== undefined
                    ? copy.years(job.experienceMinYears)
                    : copy.noExperienceRequired,
              },
              {
                icon: <JobMetaIcon name="deadline" />,
                label: copy.applicationDeadline,
                value: job.applicationDeadline
                  ? jobDate.format(new Date(job.applicationDeadline))
                  : copy.openUntilFilled,
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
                {formatSalary(job.salary, locale)}
              </span>
            }
            actions={
              <DetailActionButtons job={job} applied={applied} copy={copy} />
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
