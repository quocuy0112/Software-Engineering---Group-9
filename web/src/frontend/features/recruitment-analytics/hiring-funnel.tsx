"use client";

import type { JobPerformanceReport } from "@/shared/contracts/analytics/employer";

const stageLabels: Record<
  JobPerformanceReport["funnel"][number]["stage"],
  string
> = {
  APPLIED: "Applied",
  VIEWED: "Viewed",
  SHORTLISTED: "Shortlisted",
  INTERVIEWING: "Interviewing",
  OFFERED: "Offered",
  HIRED: "Hired",
  OFFER_DECLINED: "Offer declined",
  REJECTED: "Rejected",
  WAITLISTED: "Waitlisted",
};

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

function formatNumber(value: number) {
  return value.toLocaleString("en-US");
}

export function HiringFunnel({
  report,
  jobTitle,
}: {
  report: JobPerformanceReport;
  jobTitle: string;
}) {
  const total = report.funnel.reduce((sum, stage) => sum + stage.count, 0);
  return (
    <section
      className="recruiter-analytics-panel"
      aria-labelledby="hiring-funnel-title"
    >
      <header className="recruiter-analytics-panel__heading">
        <div>
          <p className="recruiter-analytics-eyebrow">Pipeline snapshot</p>
          <h2 id="hiring-funnel-title">Hiring funnel</h2>
          <p>
            Current candidate distribution for {jobTitle}. Percentages are based
            on the full funnel at the report cutoff.
          </p>
        </div>
        <span className="recruiter-analytics-cutoff">
          As of {new Date(report.funnelAsOf).toLocaleString("en-US")}
        </span>
      </header>
      <ol className="hiring-funnel-grid" aria-label="Hiring funnel stages">
        {report.funnel.map((stage) => (
          <li
            key={stage.stage}
            className="hiring-funnel-stage"
            data-tone={stageTone[stage.stage] ?? "blue"}
          >
            <div className="hiring-funnel-stage__topline">
              <span>{stageLabels[stage.stage]}</span>
              <strong>{formatNumber(stage.count)}</strong>
            </div>
            <p>{stage.percentage.toFixed(2)}% of pipeline</p>
            <div
              className="hiring-funnel-stage__track"
              role="progressbar"
              aria-label={
                stageLabels[stage.stage] + " percentage of candidate pipeline"
              }
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={stage.percentage}
            >
              <span style={{ width: stage.percentage + "%" }} />
            </div>
          </li>
        ))}
      </ol>
      {total === 0 ? (
        <p className="recruiter-analytics-empty-note">
          No applications yet for this job posting.
        </p>
      ) : null}
      <details className="hiring-funnel-table">
        <summary>View funnel as a table</summary>
        <div className="recruiter-analytics-table-wrap">
          <table>
            <caption className="sr-only">
              Hiring funnel data for {jobTitle}
            </caption>
            <thead>
              <tr>
                <th scope="col">Stage</th>
                <th scope="col">Candidates</th>
                <th scope="col">Share of pipeline</th>
              </tr>
            </thead>
            <tbody>
              {report.funnel.map((stage) => (
                <tr key={stage.stage}>
                  <th scope="row">{stageLabels[stage.stage]}</th>
                  <td>{formatNumber(stage.count)}</td>
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
