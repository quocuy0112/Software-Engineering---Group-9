"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { SuggestedWorkspaceJob } from "@/shared/contracts/jobs/workspace";
import { EmptyState } from "./job-empty-state";
import { JobCardView } from "./job-card";
import { useOptionalJobInteraction } from "./job-interaction-provider";
import { QuickViewPanel } from "./quick-view-panel";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { jobCopy } from "./job-copy";

export function SuggestedJobsPage({
  jobs,
  preferencesConfigured,
}: {
  jobs: SuggestedWorkspaceJob[];
  preferencesConfigured: boolean;
}) {
  const copy = jobCopy(useWorkspaceLocale());
  const shared = useOptionalJobInteraction();
  const [showAll, setShowAll] = useState(false);
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const visibleJobs = useMemo(
    () =>
      jobs.filter((job) => {
        const record = shared?.records[job.id];
        return !record?.hidden && !record?.applied;
      }),
    [jobs, shared?.records],
  );
  const displayedJobs = showAll ? visibleJobs : visibleJobs.slice(0, 6);
  const activeQuickViewId =
    quickViewId && visibleJobs.some((job) => job.id === quickViewId)
      ? quickViewId
      : null;

  if (!preferencesConfigured) {
    return (
      <EmptyState
        illustration="preferences"
        title={copy.completePreferences}
        description={copy.completePreferencesDescription}
        cta={{
          href: "/jobs/settings",
          label: copy.updatePreferences,
        }}
      />
    );
  }

  return (
    <section
      className="jobs-workspace-section"
      aria-labelledby="matches-heading"
    >
      <header className="jobs-workspace-heading jobs-workspace-heading--wide">
        <div>
          <p className="workspace-kicker">{copy.candidateWorkspace}</p>
          <h1 id="matches-heading">{copy.suggestedJobsTitle}</h1>
          <p>{copy.suggestedJobsDescription}</p>
        </div>
      </header>
      <p className="jobs-match-count">
        {copy.foundPrefix} <strong>{visibleJobs.length}</strong>{" "}
        {copy.foundSuffix}
      </p>
      {displayedJobs.length ? (
        <>
          <ol
            className="job-list suggested-job-list"
            aria-label={copy.suggestedJobsAria}
          >
            {displayedJobs.map((job) => (
              <li key={job.id}>
                <JobCardView
                  job={job}
                  variant="row"
                  timeMode="updated"
                  onQuickView={() => setQuickViewId(job.id)}
                />
              </li>
            ))}
          </ol>
          {!showAll && visibleJobs.length > displayedJobs.length ? (
            <button
              className="jobs-show-more"
              type="button"
              onClick={() => setShowAll(true)}
            >
              {copy.seeMore}
            </button>
          ) : null}
        </>
      ) : (
        <div className="workspace-inline-empty">
          {copy.noMatchingJobs}
        </div>
      )}
      <div className="jobs-preferences-prompt">
        <div>
          <strong>{copy.notQuiteRight}</strong>
          <p>{copy.recommendationsImprove}</p>
        </div>
        <Link href="/jobs/settings">{copy.updatePreferences}</Link>
      </div>
      <QuickViewPanel
        jobs={visibleJobs}
        jobId={activeQuickViewId}
        onClose={() => setQuickViewId(null)}
        onJobChange={setQuickViewId}
      />
    </section>
  );
}
