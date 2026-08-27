"use client";

import type { JobPerformanceReport } from "@/shared/contracts/analytics/employer";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { recruitmentAnalyticsCopy } from "./recruitment-analytics-copy";

const stageTone: Record<string, string> = {
  APPLIED: "blue",
  VIEWED: "slate",
  SHORTLISTED: "teal",
  INTERVIEWING: "green",
  OFFERED: "violet",
  HIRED: "green",
  OFFER_DECLINED: "amber",
  REJECTED: "red",
  WAITLISTED: "slate",
};

function formatNumber(value: number, locale: string) {
  return value.toLocaleString(locale);
}

export function HiringFunnel({
  report,
  jobTitle,
}: {
  report: JobPerformanceReport;
  jobTitle: string;
}) {
  const locale = useWorkspaceLocale();
  const analyticsCopy = recruitmentAnalyticsCopy(locale);
  const copy = analyticsCopy.funnel;
  const total = report.funnel.reduce((sum, stage) => sum + stage.count, 0);
  return (
    <section
      className="recruiter-analytics-panel"
      aria-labelledby="hiring-funnel-title"
    >
      <header className="recruiter-analytics-panel__heading">
        <div>
          <p className="recruiter-analytics-eyebrow">{copy.eyebrow}</p>
          <h2 id="hiring-funnel-title">{copy.title}</h2>
          <p>{copy.description(jobTitle)}</p>
        </div>
        <span className="recruiter-analytics-cutoff">
          {copy.asOf(
            new Date(report.funnelAsOf).toLocaleString(analyticsCopy.locale),
          )}
        </span>
      </header>
      <ol className="hiring-funnel-grid" aria-label={copy.stagesLabel}>
        {report.funnel.map((stage) => (
          <li
            key={stage.stage}
            className="hiring-funnel-stage"
            data-tone={stageTone[stage.stage] ?? "blue"}
          >
            <div className="hiring-funnel-stage__topline">
              <span>{copy.stageLabels[stage.stage]}</span>
              <strong>{formatNumber(stage.count, analyticsCopy.locale)}</strong>
            </div>
            <p>{copy.pipelinePercentage(stage.percentage.toFixed(2))}</p>
            <div
              className="hiring-funnel-stage__track"
              role="progressbar"
              aria-label={`${copy.stageLabels[stage.stage]} — ${copy.pipelinePercentage(stage.percentage.toFixed(2))}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={stage.percentage}
            >
              <span style={{ width: stage.percentage + "%" }} />
            </div>
          </li>
        ))}
      </ol>
      <p className="hiring-funnel-withdrawn" role="status">
        <strong>
          {copy.withdrawn(
            formatNumber(report.withdrawnApplications, analyticsCopy.locale),
          )}
        </strong>
        <span>{copy.withdrawnDescription}</span>
      </p>
      {total === 0 ? (
        <p className="recruiter-analytics-empty-note">
          {report.withdrawnApplications > 0
            ? copy.noActiveApplications
            : copy.noApplications}
        </p>
      ) : null}
      <details className="hiring-funnel-table">
        <summary>{copy.tableSummary}</summary>
        <div className="recruiter-analytics-table-wrap">
          <table>
            <caption className="sr-only">{copy.tableCaption(jobTitle)}</caption>
            <thead>
              <tr>
                <th scope="col">{copy.stage}</th>
                <th scope="col">{copy.candidates}</th>
                <th scope="col">{copy.share}</th>
              </tr>
            </thead>
            <tbody>
              {report.funnel.map((stage) => (
                <tr key={stage.stage}>
                  <th scope="row">{copy.stageLabels[stage.stage]}</th>
                  <td>{formatNumber(stage.count, analyticsCopy.locale)}</td>
                  <td>{stage.percentage.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
