"use client";

import { Users } from "lucide-react";
import type { CampaignScoringStats } from "./use-campaign-scoring-stats";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { recruiterApplicationsCopy } from "./recruiter-applications-copy";

function percentageLabel(value: number) {
  return `${value.toFixed(1).replace(/\.0$/u, "")}%`;
}

export function CampaignDistributionBar({
  jobId,
  stats,
  fallbackTotal,
  loading,
  error,
}: {
  jobId: string;
  stats?: CampaignScoringStats;
  fallbackTotal: number;
  loading: boolean;
  error: boolean;
}) {
  const locale = useWorkspaceLocale();
  const copy = recruiterApplicationsCopy(locale).campaigns.distribution;
  const items = [
    {
      label: copy.strong,
      value: stats?.strong ?? 0,
      tone: "green" as const,
    },
    {
      label: copy.review,
      value: stats?.review ?? 0,
      tone: "amber" as const,
    },
    { label: copy.low, value: stats?.low ?? 0, tone: "red" as const },
  ];
  const total = stats?.total ?? fallbackTotal;
  const scoredTotal = items.reduce((sum, item) => sum + item.value, 0);
  const scoringInProgress = !stats || scoredTotal === 0;
  const unavailable = !stats && !loading && error;
  const tooltipId = `campaign-distribution-tooltip-${jobId}`;
  const tooltipText = items
    .map((item) => {
      const percent = scoredTotal ? (item.value / scoredTotal) * 100 : 0;
      return `${item.label}: ${percentageLabel(percent)}`;
    })
    .join(" · ");

  return (
    <section className="campaign-distribution" aria-label={copy.summary}>
      {scoringInProgress || unavailable || loading ? (
        <div
          className={`campaign-distribution__placeholder${unavailable ? "is-unavailable" : ""}`}
          role="status"
        >
          <span>{unavailable ? copy.unavailable : copy.inProgress}</span>
        </div>
      ) : (
        <div className="campaign-distribution__bar-wrap">
          <div
            className="campaign-distribution__bar"
            role="img"
            tabIndex={0}
            aria-describedby={tooltipId}
            aria-label={`${tooltipText}. ${copy.stillScoring(stats?.processing ?? 0)}.`}
            title={tooltipText}
          >
            {items.map((item) => (
              <span
                className={`campaign-distribution__segment campaign-distribution__segment--${item.tone}`}
                key={item.label}
                style={{
                  width: `${scoredTotal ? (item.value / scoredTotal) * 100 : 0}%`,
                }}
              />
            ))}
          </div>
          <span
            className="campaign-distribution__tooltip"
            id={tooltipId}
            role="tooltip"
          >
            {tooltipText}
          </span>
        </div>
      )}
      <div className="campaign-distribution__legend">
        {items.map((item) => (
          <span
            className={`campaign-distribution__legend-item campaign-distribution__legend-item--${item.tone}`}
            key={item.label}
          >
            <span className="campaign-distribution__dot" aria-hidden="true" />
            <strong>{item.value.toLocaleString("en-US")}</strong>
            <span>{item.label}</span>
          </span>
        ))}
        <span
          className="campaign-distribution__total"
          title={
            stats?.processing ? copy.stillScoring(stats.processing) : undefined
          }
        >
          <Users aria-hidden="true" />
          <strong>{total.toLocaleString("en-US")}</strong>
          <span>{copy.total}</span>
        </span>
      </div>
    </section>
  );
}
