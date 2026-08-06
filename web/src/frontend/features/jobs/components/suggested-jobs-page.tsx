"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { SuggestedWorkspaceJob } from "@/shared/contracts/jobs/workspace";
import { EmptyState } from "./job-empty-state";
import { JobCardView } from "./job-card";
import { useOptionalJobInteraction } from "./job-interaction-provider";
import { QuickViewPanel } from "./quick-view-panel";

export function MatchScoreExplainer({
  criteria,
  score,
}: {
  criteria: string[];
  score?: number;
}) {
  return (
    <details className="match-score-explainer">
      <summary>
        Vì sao phù hợp?
        {score != null ? <span>{score}%</span> : null}
      </summary>
      {criteria.length ? (
        <ul>
          {criteria.map((criterion) => (
            <li key={criterion}>
              <span aria-hidden="true">✓</span>
              {criterion}
            </li>
          ))}
        </ul>
      ) : (
        <p>Được chọn dựa trên các tùy chọn việc làm của bạn.</p>
      )}
    </details>
  );
}

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
        title="Hoàn thiện tùy chọn việc làm"
        description="Hãy cho SmartHire biết vị trí, kỹ năng, kinh nghiệm và địa điểm mong muốn để nhận được các gợi ý phù hợp hơn."
        cta={{
          href: "/jobs/settings",
          label: "Cập nhật tùy chọn",
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
          <h1 id="matches-heading">Việc làm phù hợp</h1>
          <p>
            Các gợi ý được sắp xếp dựa trên tùy chọn, kỹ năng và kinh nghiệm bạn
            đã chia sẻ.
          </p>
        </div>
      </header>
      <p className="jobs-match-count">
        Tìm thấy <strong>{visibleJobs.length}</strong> việc làm phù hợp với yêu
        cầu của bạn
      </p>
      {displayedJobs.length ? (
        <>
          <ol
            className="job-list suggested-job-list"
            aria-label="Việc làm phù hợp"
          >
            {displayedJobs.map((job) => (
              <li key={job.id}>
                <JobCardView
                  job={job}
                  onQuickView={() => setQuickViewId(job.id)}
                />
                <MatchScoreExplainer
                  criteria={job.matchedCriteria}
                  score={job.matchScore}
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
              Xem thêm
            </button>
          ) : null}
        </>
      ) : (
        <div className="workspace-inline-empty">
          Hiện chưa có việc làm phù hợp. Hãy thử mở rộng tùy chọn hoặc cập nhật
          kỹ năng của bạn.
        </div>
      )}
      <div className="jobs-preferences-prompt">
        <div>
          <strong>Chưa đúng với mong muốn của bạn?</strong>
          <p>
            Cập nhật tùy chọn việc làm để SmartHire điều chỉnh các gợi ý tiếp
            theo.
          </p>
        </div>
        <Link href="/jobs/settings">Cập nhật tùy chọn</Link>
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
