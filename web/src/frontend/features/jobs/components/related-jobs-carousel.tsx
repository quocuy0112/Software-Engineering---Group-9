"use client";

import Link from "next/link";
import { useMemo } from "react";
import { RelatedJobRow } from "@/frontend/components/ui/related-job-row";
import type { JobCard } from "@/shared/contracts/jobs/discovery";
import {
  formatRelativeTime,
  formatSalary,
} from "@/shared/utils/jobs/job-display";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { CompanyLogo } from "./job-detail-sidebar";
import { SaveJobAction } from "./save-job-action";
import { jobCopy } from "./job-copy";

function relatedBadge(job: JobCard) {
  if (job.isUrgent) return "new";
  if ((job.matchScore ?? 0) >= 80) return "featured";
  return null;
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M20.8 8.8c0 5.3-8.8 10.4-8.8 10.4S3.2 14.1 3.2 8.8A4.6 4.6 0 0 1 12 6.3a4.6 4.6 0 0 1 8.8 2.5Z" />
    </svg>
  );
}

function RelatedJobSave({ job }: { job: JobCard }) {
  const copy = jobCopy(useWorkspaceLocale());
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

  const returnTo = encodeURIComponent("/jobs/" + job.slug);
  return (
    <Link
      className="job-icon-button job-heart-button"
      href={"/login?returnTo=" + returnTo}
      aria-label={copy.saveJob}
    >
      <HeartIcon />
    </Link>
  );
}

export function RelatedJobsCarousel({
  jobs,
  title = "Related jobs",
}: {
  jobs: JobCard[];
  title?: string;
}) {
  const locale = useWorkspaceLocale();
  const copy = jobCopy(locale);
  const resolvedTitle = title === "Related jobs" ? copy.relatedJobs : title;
  const rankedJobs = useMemo(
    () =>
      [...jobs]
        .sort(
          (left, right) => (right.matchScore ?? -1) - (left.matchScore ?? -1),
        )
        .slice(0, 6),
    [jobs],
  );

  return (
    <section
      className="job-related-section"
      aria-labelledby="related-jobs-heading"
    >
      <div className="job-related-heading">
        <div>
          <p className="panel-kicker">{copy.keepExploring}</p>
          <h2 id="related-jobs-heading">{resolvedTitle}</h2>
        </div>
        <Link className="job-related-see-more" href="/jobs">
          {copy.seeMoreJobs} <span aria-hidden="true">→</span>
        </Link>
      </div>

      {rankedJobs.length ? (
        <div className="job-related-list" aria-label={resolvedTitle}>
          {rankedJobs.map((job) => {
            const badge = relatedBadge(job);
            return (
              <RelatedJobRow
                key={job.id}
                href={`/jobs/${job.slug}`}
                avatarLabel={job.company.displayName.slice(0, 2).toUpperCase()}
                avatar={<CompanyLogo company={job.company} />}
                title={job.title}
                isNew={badge === "new"}
                badgeLabel={
                  badge === "new"
                    ? copy.newJob
                    : badge === "featured"
                      ? copy.featuredJob
                      : undefined
                }
                company={job.company.displayName}
                location={job.location}
                updatedAt={copy.updatedAt(
                  formatRelativeTime(job.updatedAt ?? job.publishedAt, locale),
                )}
                salaryRange={formatSalary(job.salary, locale)}
                saved={job.actions.saved}
                saveAction={<RelatedJobSave job={job} />}
              />
            );
          })}
        </div>
      ) : (
        <p className="job-section-muted">{copy.noRelatedJobs}</p>
      )}
    </section>
  );
}
