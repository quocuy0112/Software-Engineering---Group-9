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
        title={"B\u1ea1n ch\u01b0a l\u01b0u c\u00f4ng vi\u1ec7c n\u00e0o!"}
        cta={{
          href: "/jobs",
          label: "T\u00ecm vi\u1ec7c ngay \u2192",
        }}
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
          <p className="workspace-kicker">CANDIDATE WORKSPACE</p>
          <h1 id="saved-jobs-heading">Việc làm đã lưu</h1>
          <p>Danh sách những cơ hội bạn muốn xem lại và ứng tuyển sau.</p>
        </div>
        <span className="jobs-workspace-count">{visibleJobs.length}</span>
      </header>
      <ol className="job-list" aria-label="Việc làm đã lưu">
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
    </section>
  );
}
