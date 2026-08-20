import {
  canonicalAnalyticsStages,
  type CanonicalAnalyticsStage,
  type MetricRate,
} from "@/shared/contracts/analytics";
import { makeMetricRate, roundRate } from "./report-time-policy";

export function calculateConversionRate(
  submittedApplications: number,
  qualifiedViews: number,
): MetricRate {
  return makeMetricRate(submittedApplications, qualifiedViews);
}

export function calculateFunnel(
  counts: Readonly<Partial<Record<CanonicalAnalyticsStage, number>>>,
) {
  const total = canonicalAnalyticsStages.reduce(
    (sum, stage) => sum + (counts[stage] ?? 0),
    0,
  );
  return canonicalAnalyticsStages.map((stage) => {
    const count = counts[stage] ?? 0;
    return {
      stage,
      count,
      percentage: total === 0 ? 0 : roundRate((count / total) * 100),
    };
  });
}

export function calculateApplicationsPerCandidate(
  submittedApplications: number,
  distinctSubmittingCandidates: number,
) {
  return makeMetricRate(
    submittedApplications,
    distinctSubmittingCandidates,
  );
}
