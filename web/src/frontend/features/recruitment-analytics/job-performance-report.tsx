"use client";

import {
  BarChart3,
  Eye,
  FileText,
  Percent,
  UserRoundX,
  UsersRound,
} from "lucide-react";
import type { JobPerformanceReport } from "@/shared/contracts/analytics/employer";
import type { RecruiterJob } from "@/shared/contracts/recruiter-job-posting";
import { CandidateExportPanel } from "./candidate-export-panel";
import { HiringFunnel } from "./hiring-funnel";

function formatNumber(value: number) {
  return value.toLocaleString("en-US");
}

function formatRate(value: JobPerformanceReport["conversionRate"]) {
  return value.availability === "AVAILABLE" && value.value !== null
    ? value.value.toFixed(2) + "%"
    : "N/A";
}

function conversionDescription(value: JobPerformanceReport["conversionRate"]) {
  return value.availability === "NOT_APPLICABLE"
    ? "No qualified views in the selected window"
    : "Applications divided by qualified views";
}

function MetricCard({
  label,
  value,
  description,
  icon,
  tone,
}: {
  label: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  tone: "blue" | "teal" | "violet" | "amber";
}) {
  return (
    <article className="recruiter-analytics-metric" data-tone={tone}>
      <span className="recruiter-analytics-metric__icon" aria-hidden="true">
        {icon}
      </span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{description}</small>
      </div>
    </article>
  );
}

export function JobPerformanceReport({
  report,
  jobs,
  selectedJobId,
  onSelectJob,
}: {
  report: JobPerformanceReport;
  jobs: RecruiterJob[];
  selectedJobId: string;
  onSelectJob: (jobId: string) => void;
}) {
  const jobTitle = report.job.title || "Untitled job posting";
  return (
    <section
      className="recruiter-analytics-report"
      aria-labelledby="selected-posting-title"
    >
      <header className="recruiter-analytics-report__header">
        <div>
          <p className="recruiter-analytics-eyebrow">Selected posting</p>
          <h2 id="selected-posting-title">{jobTitle}</h2>
          <p>
            Compare acquisition and pipeline health for one posting within the
            selected reporting window.
          </p>
        </div>
        <div className="recruiter-analytics-report__controls">
          <label>
            <span>Posting</span>
            <select
              value={selectedJobId}
              onChange={(event) => onSelectJob(event.target.value)}
              aria-label="Select job posting for funnel"
            >
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title || "Untitled job posting"}
                </option>
              ))}
            </select>
          </label>
          <CandidateExportPanel jobId={report.job.id} jobTitle={jobTitle} />
        </div>
      </header>
      <div className="recruiter-analytics-report__meta" role="note">
        <span>
          Snapshot cutoff:{" "}
          <strong>
            {new Date(report.metadata.dataCutoff).toLocaleString("en-US")}
          </strong>
        </span>
        <span>Definition {report.metadata.definitionVersion}</span>
      </div>
      <div className="recruiter-analytics-metric-grid">
        <MetricCard
          label="Qualified views"
          value={formatNumber(report.qualifiedViews)}
          description="Deduplicated visitor-posting-day views"
          tone="blue"
          icon={<Eye />}
        />
        <MetricCard
          label="Applications"
          value={formatNumber(report.submittedApplications)}
          description="Submitted applications in the window"
          tone="teal"
          icon={<UsersRound />}
        />
        <MetricCard
          label="Withdrawn"
          value={formatNumber(report.withdrawnApplications)}
          description="Excluded from the current funnel snapshot"
          tone="amber"
          icon={<UserRoundX />}
        />
        <MetricCard
          label="View-to-application"
          value={formatRate(report.conversionRate)}
          description={conversionDescription(report.conversionRate)}
          tone="violet"
          icon={<Percent />}
        />
        <MetricCard
          label="Funnel candidates"
          value={formatNumber(
            report.funnel.reduce((sum, stage) => sum + stage.count, 0),
          )}
          description="Current canonical stage snapshot"
          tone="amber"
          icon={<BarChart3 />}
        />
      </div>
      <HiringFunnel report={report} jobTitle={jobTitle} />
      <details className="recruiter-analytics-definitions">
        <summary>
          <FileText aria-hidden="true" />
          Metric definitions and data notes
        </summary>
        <div>
          <p>
            Qualified views exclude owner previews, automated traffic, and
            duplicate visits from the same visitor on the same platform day.
          </p>
          <p>
            Conversion is shown as N/A until the selected window contains at
            least one qualified view. To collect one, open the public posting as
            a candidate or anonymous visitor; recruiter previews, bots, and
            same-day repeat visits are excluded.
          </p>
          <p>
            The funnel is a current snapshot at the cutoff. Each application
            appears in one canonical stage, so stage counts are mutually
            exclusive.
          </p>
          <p>
            Historical reporting is available from{" "}
            {new Date(
              report.metadata.analyticsAvailableFrom,
            ).toLocaleDateString("en-US")}
            .
          </p>
        </div>
      </details>
    </section>
  );
}
