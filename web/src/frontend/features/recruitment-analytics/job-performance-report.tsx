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
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { CandidateExportPanel } from "./candidate-export-panel";
import { HiringFunnel } from "./hiring-funnel";
import { recruitmentAnalyticsCopy } from "./recruitment-analytics-copy";

function formatNumber(value: number, locale: string) {
  return value.toLocaleString(locale);
}

function formatRate(
  value: JobPerformanceReport["conversionRate"],
  notAvailable: string,
) {
  return value.availability === "AVAILABLE" && value.value !== null
    ? value.value.toFixed(2) + "%"
    : notAvailable;
}

function conversionDescription(
  value: JobPerformanceReport["conversionRate"],
  copy: ReturnType<typeof recruitmentAnalyticsCopy>["report"],
) {
  return value.availability === "NOT_APPLICABLE"
    ? copy.conversionDefinition
    : copy.qualifiedViewsDescription;
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
  const locale = useWorkspaceLocale();
  const analyticsCopy = recruitmentAnalyticsCopy(locale);
  const copy = analyticsCopy.report;
  const jobTitle = report.job.title || analyticsCopy.untitledJob;
  return (
    <section
      className="recruiter-analytics-report"
      aria-labelledby="selected-posting-title"
    >
      <header className="recruiter-analytics-report__header">
        <div>
          <p className="recruiter-analytics-eyebrow">{copy.selectedPosting}</p>
          <h2 id="selected-posting-title">{jobTitle}</h2>
          <p>{copy.description}</p>
        </div>
        <div className="recruiter-analytics-report__controls">
          <label>
            <span>{copy.posting}</span>
            <select
              value={selectedJobId}
              onChange={(event) => onSelectJob(event.target.value)}
              aria-label={copy.selectPosting}
            >
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title || analyticsCopy.untitledJob}
                </option>
              ))}
            </select>
          </label>
          <CandidateExportPanel jobId={report.job.id} jobTitle={jobTitle} />
        </div>
      </header>
      <div className="recruiter-analytics-report__meta" role="note">
        <span>
          {copy.snapshotCutoff}:{" "}
          <strong>
            {new Date(report.metadata.dataCutoff).toLocaleString(
              analyticsCopy.locale,
            )}
          </strong>
        </span>
        <span>{copy.definition(report.metadata.definitionVersion)}</span>
      </div>
      <div className="recruiter-analytics-metric-grid">
        <MetricCard
          label={copy.qualifiedViews}
          value={formatNumber(report.qualifiedViews, analyticsCopy.locale)}
          description={copy.qualifiedViewsDescription}
          tone="blue"
          icon={<Eye />}
        />
        <MetricCard
          label={copy.applications}
          value={formatNumber(
            report.submittedApplications,
            analyticsCopy.locale,
          )}
          description={copy.applicationsDescription}
          tone="teal"
          icon={<UsersRound />}
        />
        <MetricCard
          label={copy.withdrawn}
          value={formatNumber(
            report.withdrawnApplications,
            analyticsCopy.locale,
          )}
          description={copy.withdrawnDescription}
          tone="amber"
          icon={<UserRoundX />}
        />
        <MetricCard
          label={copy.conversion}
          value={formatRate(report.conversionRate, analyticsCopy.notAvailable)}
          description={conversionDescription(report.conversionRate, copy)}
          tone="violet"
          icon={<Percent />}
        />
        <MetricCard
          label={copy.funnelCandidates}
          value={formatNumber(
            report.funnel.reduce((sum, stage) => sum + stage.count, 0),
            analyticsCopy.locale,
          )}
          description={copy.funnelCandidatesDescription}
          tone="amber"
          icon={<BarChart3 />}
        />
      </div>
      <HiringFunnel report={report} jobTitle={jobTitle} />
      <details className="recruiter-analytics-definitions">
        <summary>
          <FileText aria-hidden="true" />
          {copy.definitionsSummary}
        </summary>
        <div>
          <p>{copy.qualifiedViewsDefinition}</p>
          <p>{copy.conversionDefinition}</p>
          <p>{copy.funnelDefinition}</p>
          <p>
            {copy.historicalDefinition(
              new Date(
                report.metadata.analyticsAvailableFrom,
              ).toLocaleDateString(analyticsCopy.locale),
            )}
          </p>
        </div>
      </details>
    </section>
  );
}
