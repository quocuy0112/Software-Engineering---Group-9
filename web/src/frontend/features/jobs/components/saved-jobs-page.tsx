"use client";

import { useMemo, useState } from "react";
import type { JobCard } from "@/shared/contracts/jobs/discovery";
import { EmptyState } from "./job-empty-state";
import { JobCardView } from "./job-card";
import { useOptionalJobInteraction } from "./job-interaction-provider";
import { QuickViewPanel } from "./quick-view-panel";

export function SavedJobsPage({ jobs }: { jobs: JobCard[] }) {
  const shared = useOptionalJobInteraction();
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const visibleJobs = useMemo(
    () =>
      jobs.filter((job) => {
        const record = shared?.records[job.id];
        return !record?.hidden && (record ? record.saved : job.actions.saved);
      }),
    [jobs, shared?.records],
  );
  const activeQuickViewId =
    quickViewId && visibleJobs.some((job) => job.id === quickViewId)
      ? quickViewId
      : null;

  if (!visibleJobs.length) {
    return (
      <EmptyState
        illustration="folder"
        title="You have not saved any jobs yet."
        cta={{ href: "/jobs", label: "Find jobs \u2192" }}
      />
    );
  }

  return (
    <section
      className="jobs-workspace-section"
      aria-labelledby="saved-jobs-heading"
    >
      <header className="jobs-workspace-heading">
        <div>
          <p className="workspace-kicker">Candidate workspace</p>
          <h1 id="saved-jobs-heading">Saved Jobs</h1>
          <p>Keep track of opportunities you want to revisit.</p>
        </div>
        <span className="jobs-workspace-count">{visibleJobs.length}</span>
      </header>
      <ol className="job-list saved-job-grid" aria-label="Saved jobs">
        {visibleJobs.map((job) => (
          <li key={job.id}>
            <JobCardView
              job={job}
              variant="grid"
              timeMode="posted"
              onQuickView={() => setQuickViewId(job.id)}
            />
          </li>
        ))}
      </ol>
      <QuickViewPanel
        jobs={visibleJobs}
        jobId={activeQuickViewId}
        onClose={() => setQuickViewId(null)}
        onJobChange={setQuickViewId}
      />
    </section>
  );
}
