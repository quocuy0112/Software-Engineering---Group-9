"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  applicationStageGroup,
  applicationStageLabel,
  applicationStageNextStep,
  applicationStageSchema,
  candidateApplicationListResponseSchema,
  type ApplicationStage,
  type ApplicationStageGroup,
  type CandidateApplicationSummary,
} from "@/shared/contracts/jobs/applications";
import { EmptyState } from "./job-empty-state";
import { ApplicationStageBadge } from "./application-stage-badge";

type GroupFilter = "ALL" | ApplicationStageGroup;

const groupFilters: Array<{ id: GroupFilter; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "ACTIVE", label: "Active" },
  { id: "ATTENTION", label: "Needs attention" },
  { id: "PAUSED", label: "Paused" },
  { id: "COMPLETED", label: "Completed" },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function companyInitials(companyName: string) {
  return companyName
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function groupCount(
  applications: CandidateApplicationSummary[],
  group: GroupFilter,
) {
  return group === "ALL"
    ? applications.length
    : applications.filter(
        (application) => applicationStageGroup[application.stage] === group,
      ).length;
}

export function ApplicationFilters({
  applications,
  activeGroup,
  activeStage,
  onGroupChange,
  onStageChange,
}: {
  applications: CandidateApplicationSummary[];
  activeGroup: GroupFilter;
  activeStage: "ALL" | ApplicationStage;
  onGroupChange: (group: GroupFilter) => void;
  onStageChange: (stage: "ALL" | ApplicationStage) => void;
}) {
  return (
    <div className="application-filters">
      <div className="application-group-tabs" aria-label="Application group">
        {groupFilters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={activeGroup === filter.id ? "is-active" : undefined}
            aria-pressed={activeGroup === filter.id}
            onClick={() => onGroupChange(filter.id)}
          >
            {filter.label}
            <span>{groupCount(applications, filter.id)}</span>
          </button>
        ))}
      </div>
      <label className="application-stage-filter">
        <span>Stage</span>
        <select
          value={activeStage}
          onChange={(event) =>
            onStageChange(event.target.value as "ALL" | ApplicationStage)
          }
        >
          <option value="ALL">All stages</option>
          {applicationStageSchema.options.map((stage) => (
            <option key={stage} value={stage}>
              {applicationStageLabel[stage]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function ApplicationCard({
  application,
}: {
  application: CandidateApplicationSummary;
}) {
  const title =
    application.jobAvailable && application.jobSlug ? (
      <Link href={`/jobs/${application.jobSlug}`}>{application.jobTitle}</Link>
    ) : (
      application.jobTitle
    );

  return (
    <article className="application-tracking-card">
      <div className="application-company-mark" aria-hidden="true">
        {companyInitials(application.companyName)}
      </div>
      <div className="application-card-main">
        <div className="application-card-title-row">
          <div>
            <p className="application-company-name">
              {application.companyName}
            </p>
            <h2>{title}</h2>
          </div>
          <ApplicationStageBadge stage={application.stage} />
        </div>

        <div className="application-card-meta" aria-label="Application details">
          <span>{application.location}</span>
          <span>Applied {formatDate(application.submittedAt)}</span>
          <span>Updated {formatDate(application.lastStageChangedAt)}</span>
        </div>

        {!application.jobAvailable ? (
          <p className="application-unavailable-note">
            This job is no longer available, but your application record is
            preserved.
          </p>
        ) : null}

        <div className="application-next-step">
          <span aria-hidden="true">i</span>
          <p>{applicationStageNextStep[application.stage]}</p>
        </div>

        <footer>
          <div>
            {application.scoringStatus &&
            application.scoringStatus !== "NOT_REQUESTED" ? (
              <span className="application-scoring-status">
                CV analysis: {application.scoringStatus.toLowerCase()}
              </span>
            ) : null}
          </div>
          <Link
            className="application-detail-link"
            href={`/jobs/applied/${encodeURIComponent(application.applicationId)}`}
          >
            View application
            <span aria-hidden="true">→</span>
          </Link>
        </footer>
      </div>
    </article>
  );
}

export function AppliedJobsPage({
  applications,
  nextCursor: initialNextCursor = null,
}: {
  applications: CandidateApplicationSummary[];
  nextCursor?: string | null;
}) {
  const [loadedApplications, setLoadedApplications] = useState(applications);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<GroupFilter>("ALL");
  const [activeStage, setActiveStage] = useState<"ALL" | ApplicationStage>(
    "ALL",
  );
  const filtered = useMemo(
    () =>
      loadedApplications.filter(
        (application) =>
          (activeGroup === "ALL" ||
            applicationStageGroup[application.stage] === activeGroup) &&
          (activeStage === "ALL" || application.stage === activeStage),
      ),
    [activeGroup, activeStage, loadedApplications],
  );

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const query = new URLSearchParams({ cursor: nextCursor, limit: "24" });
      const response = await fetch(`/api/candidate/applications?${query}`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("APPLICATION_LIST_REQUEST_FAILED");
      const result = candidateApplicationListResponseSchema.parse(
        await response.json(),
      );
      setLoadedApplications((current) => {
        const known = new Set(current.map((item) => item.applicationId));
        return [
          ...current,
          ...result.applications.filter(
            (item) => !known.has(item.applicationId),
          ),
        ];
      });
      setNextCursor(result.nextCursor);
    } catch {
      setLoadMoreError("Couldn’t load more applications. Please try again.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section
      className="jobs-workspace-section applications-workspace"
      aria-labelledby="applied-jobs-heading"
    >
      <header className="jobs-workspace-heading applications-heading">
        <div>
          <p className="workspace-kicker">CANDIDATE WORKSPACE</p>
          <h1 id="applied-jobs-heading">My applications</h1>
          <p>Follow every application and see what happens next.</p>
        </div>
        <span
          className="jobs-workspace-count"
          aria-label={`${loadedApplications.length} applications loaded`}
        >
          {loadedApplications.length}
        </span>
      </header>

      {loadedApplications.length ? (
        <>
          <ApplicationFilters
            applications={loadedApplications}
            activeGroup={activeGroup}
            activeStage={activeStage}
            onGroupChange={setActiveGroup}
            onStageChange={setActiveStage}
          />
          {filtered.length ? (
            <div className="application-card-list">
              {filtered.map((application) => (
                <ApplicationCard
                  key={application.applicationId}
                  application={application}
                />
              ))}
            </div>
          ) : (
            <div className="workspace-inline-empty application-filter-empty">
              <p>No applications match these filters.</p>
              <button
                type="button"
                onClick={() => {
                  setActiveGroup("ALL");
                  setActiveStage("ALL");
                }}
              >
                Clear filters
              </button>
            </div>
          )}
          {nextCursor ? (
            <div className="application-load-more">
              <button
                type="button"
                disabled={loadingMore}
                aria-busy={loadingMore}
                onClick={loadMore}
              >
                {loadingMore ? "Loading…" : "Load more applications"}
              </button>
            </div>
          ) : null}
          {loadMoreError ? (
            <p className="application-load-more-error" role="alert">
              {loadMoreError}
            </p>
          ) : null}
        </>
      ) : (
        <EmptyState
          illustration="headset"
          title="You have not applied to any jobs yet."
          description="Start searching for the right opportunity and your applications will appear here."
          cta={{ href: "/jobs", label: "Find jobs" }}
        />
      )}
    </section>
  );
}
