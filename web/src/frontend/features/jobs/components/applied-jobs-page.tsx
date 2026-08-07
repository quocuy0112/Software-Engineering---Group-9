"use client";

import { useMemo, useState } from "react";
import type { JobApplicationStatus } from "@/shared/contracts/jobs/preferences";
import { jobApplicationStatusLabels } from "@/shared/contracts/jobs/preferences";
import type { WorkspaceApplication } from "@/shared/contracts/jobs/workspace";
import { formatRelativeTime } from "@/shared/utils/jobs/job-display";
import { EmptyState } from "./job-empty-state";
import { JobCardView } from "./job-card";

type ApplicationFilter = "all" | JobApplicationStatus;

const statusTabs: Array<{ id: ApplicationFilter; label: string }> = [
  { id: "all", label: "All" },
  ...(
    Object.entries(jobApplicationStatusLabels) as Array<
      [JobApplicationStatus, string]
    >
  ).map(([id, label]) => ({ id, label })),
];

export function StatusTabs({
  active,
  applications,
  onChange,
}: {
  active: ApplicationFilter;
  applications: WorkspaceApplication[];
  onChange: (value: ApplicationFilter) => void;
}) {
  return (
    <div
      className="application-status-tabs"
      role="tablist"
      aria-label="Application status"
    >
      {statusTabs.map((tab) => {
        const count =
          tab.id === "all"
            ? applications.length
            : applications.filter((item) => item.application.status === tab.id)
                .length;
        return (
          <button
            key={tab.id}
            className={active === tab.id ? "is-active" : undefined}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
            <span>{count}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ApplicationCard({ item }: { item: WorkspaceApplication }) {
  const job = item.job;
  const status = jobApplicationStatusLabels[item.application.status];
  if (!job) {
    return (
      <div className="application-card">
        <div className="application-card-status-row">
          <span className="application-status-badge">{status}</span>
          <span>Application ID: {item.application.jobId}</span>
        </div>
        <h2>This job is no longer available</h2>
      </div>
    );
  }

  return (
    <div className="application-card">
      <div className="application-card-status-row">
        <span className="application-status-badge">{status}</span>
        <span>Applied {formatRelativeTime(item.application.appliedAt)}</span>
      </div>
      <JobCardView job={job} variant="row" timeMode="posted" />
    </div>
  );
}

export function AppliedJobsPage({
  applications,
}: {
  applications: WorkspaceApplication[];
}) {
  const [active, setActive] = useState<ApplicationFilter>("all");
  const filtered = useMemo(
    () =>
      active === "all"
        ? applications
        : applications.filter((item) => item.application.status === active),
    [active, applications],
  );

  return (
    <section
      className="jobs-workspace-section"
      aria-labelledby="applied-jobs-heading"
    >
      <header className="jobs-workspace-heading">
        <div>
          <p className="workspace-kicker">CANDIDATE WORKSPACE</p>
          <h1 id="applied-jobs-heading">Applied Jobs</h1>
          <p>Track the jobs you have applied for and their current status.</p>
        </div>
        <span className="jobs-workspace-count">{applications.length}</span>
      </header>
      {applications.length ? (
        <>
          <StatusTabs
            active={active}
            applications={applications}
            onChange={setActive}
          />
          {filtered.length ? (
            <div className="application-card-list">
              {filtered.map((item) => (
                <ApplicationCard key={item.application.jobId} item={item} />
              ))}
            </div>
          ) : (
            <div className="workspace-inline-empty">
              No applications have this status yet.
            </div>
          )}
        </>
      ) : (
        <EmptyState
          illustration="headset"
          title="You have not applied to any jobs yet."
          description="Start searching for the right opportunity and connect with leading employers."
          cta={{ href: "/jobs", label: "Find jobs" }}
        />
      )}
    </section>
  );
}
