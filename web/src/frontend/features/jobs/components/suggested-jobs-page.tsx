"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { SuggestedWorkspaceJob } from "@/shared/contracts/jobs/workspace";
import { EmptyState } from "./job-empty-state";
import { JobCardView } from "./job-card";
import { useOptionalJobInteraction } from "./job-interaction-provider";
import { QuickViewPanel } from "./quick-view-panel";

export function SuggestedJobsPage({
  jobs,
  preferencesConfigured,
}: {
  jobs: SuggestedWorkspaceJob[];
  preferencesConfigured: boolean;
}) {
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
        title="Complete your job preferences"
        description="Share your target position, skills, experience, and location so SmartHire can recommend better opportunities."
        cta={{
          href: "/jobs/settings",
          label: "Update preferences",
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
          <p className="workspace-kicker">CANDIDATE WORKSPACE</p>
          <h1 id="matches-heading">Suggested Jobs</h1>
          <p>
            Recommendations are based on the preferences, skills, and experience
            you have shared.
          </p>
        </div>
      </header>
      <p className="jobs-match-count">
        Found <strong>{visibleJobs.length}</strong> jobs that match your
        preferences
      </p>
      {displayedJobs.length ? (
        <>
          <ol
            className="job-list suggested-job-list"
            aria-label="Suggested jobs"
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
              See more
            </button>
          ) : null}
        </>
      ) : (
        <div className="workspace-inline-empty">
          No matching jobs are available right now. Try broadening your
          preferences.
        </div>
      )}
      <div className="jobs-preferences-prompt">
        <div>
          <strong>Not quite right?</strong>
          <p>Update your preferences to improve future recommendations.</p>
        </div>
        <Link href="/jobs/settings">Update preferences</Link>
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
