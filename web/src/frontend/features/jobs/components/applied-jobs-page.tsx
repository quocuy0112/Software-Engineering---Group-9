"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { JobCard } from "@/shared/contracts/jobs/discovery";
import type { JobApplicationStatus } from "@/shared/contracts/jobs/preferences";
import { jobApplicationStatusLabels } from "@/shared/contracts/jobs/preferences";
import type { WorkspaceApplication } from "@/shared/contracts/jobs/workspace";
import { CompanyAvatar } from "./company-avatar";
import { EmptyState } from "./job-empty-state";

type ApplicationFilter = "all" | JobApplicationStatus;

const statusTabs: Array<{ id: ApplicationFilter; label: string }> = [
  { id: "all", label: "T\u1ea5t c\u1ea3" },
  ...(
    Object.entries(jobApplicationStatusLabels) as Array<
      [JobApplicationStatus, string]
    >
  ).map(([id, label]) => ({ id, label })),
];

function salary(job: JobCard) {
  if (!job.salary) return "M\u1ee9c l\u01b0\u01a1ng th\u1ecfa thu\u1eadn";
  const formatter = new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: job.salary.currency,
    maximumFractionDigits: 0,
  });
  return (
    formatter.format(job.salary.minimum) +
    " - " +
    formatter.format(job.salary.maximum)
  );
}

function appliedDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

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
      aria-label="Trạng thái ứng tuyển"
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
      <article className="job-card application-card">
        <div>
          <p className="panel-kicker">APPLICATION</p>
          <h2>Công việc không còn trong danh mục</h2>
          <p>Mã công việc: {item.application.jobId}</p>
        </div>
        <span className="application-status-badge">{status}</span>
      </article>
    );
  }

  return (
    <article className="job-card application-card">
      <header className="application-card-header">
        <CompanyAvatar
          name={job.company.displayName}
          imageUrl={job.company.logoUrl}
          size="md"
        />
        <div>
          <p className="panel-kicker">VIỆC LÀM ĐÃ ỨNG TUYỂN</p>
          <h2>
            <Link href={"/jobs/" + job.slug}>{job.title}</Link>
          </h2>
          <p>{job.company.displayName}</p>
        </div>
        <span className="application-status-badge">{status}</span>
      </header>
      <div className="application-card-meta">
        <span>{job.location}</span>
        <span>{salary(job)}</span>
        <span>Ứng tuyển ngày {appliedDate(item.application.appliedAt)}</span>
      </div>
      <footer>
        {item.application.aiMatchScore != null ? (
          <span className="application-match-score">
            AI match {item.application.aiMatchScore}%
          </span>
        ) : null}
        <Link className="job-secondary-link" href={"/jobs/" + job.slug}>
          Xem chi tiết
        </Link>
      </footer>
    </article>
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
          <h1 id="applied-jobs-heading">Việc làm đã ứng tuyển</h1>
          <p>Theo dõi các hồ sơ bạn đã gửi và trạng thái xử lý hiện tại.</p>
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
              Chưa có hồ sơ ở trạng thái này.
            </div>
          )}
        </>
      ) : (
        <EmptyState
          illustration="headset"
          title={
            "B\u1ea1n ch\u01b0a \u1ee9ng tuy\u1ec3n c\u00f4ng vi\u1ec7c n\u00e0o!"
          }
          description={
            "H\u00e3y b\u1eaft \u0111\u1ea7u t\u00ecm ki\u1ebfm c\u00f4ng vi\u1ec7c ph\u00f9 h\u1ee3p \u0111\u1ec3 k\u1ebft n\u1ed1i v\u1edbi c\u00e1c nh\u00e0 tuy\u1ec3n d\u1ee5ng h\u00e0ng \u0111\u1ea7u."
          }
          cta={{ href: "/jobs", label: "T\u00ecm vi\u1ec7c ngay" }}
        />
      )}
    </section>
  );
}
