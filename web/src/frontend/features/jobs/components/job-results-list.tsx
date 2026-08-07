"use client";

import { useMemo, useState } from "react";
import type { JobCard } from "@/shared/contracts/jobs/discovery";
import { JobCardView } from "./job-card";
import { useOptionalJobInteraction } from "./job-interaction-provider";
import { QuickViewPanel } from "./quick-view-panel";

export function JobResultsList({ jobs }: { jobs: JobCard[] }) {
  const shared = useOptionalJobInteraction();
  const [quickViewId, setQuickViewId] = useState<string | null>(null);

  const visibleJobs = useMemo(
    () => jobs.filter((job) => !shared?.records[job.id]?.hidden),
    [jobs, shared?.records],
  );
  const activeQuickViewId =
    quickViewId && visibleJobs.some((job) => job.id === quickViewId)
      ? quickViewId
      : null;

  return (
    <>
      <ol className="job-list" aria-label="Matching jobs">
        {visibleJobs.map((job) => (
          <li key={job.id}>
            <JobCardView job={job} onQuickView={() => setQuickViewId(job.id)} />
          </li>
        ))}
      </ol>
      <QuickViewPanel
        jobs={visibleJobs}
        jobId={activeQuickViewId}
        onClose={() => setQuickViewId(null)}
        onJobChange={setQuickViewId}
      />
    </>
  );
}
