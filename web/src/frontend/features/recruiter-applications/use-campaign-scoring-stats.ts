"use client";

import { useEffect, useMemo, useState } from "react";
import {
  campaignScoringStatsResponseSchema,
  type CampaignScoringStats,
} from "@/shared/contracts/scoring";
import type { RecruiterJob } from "@/shared/contracts/recruiter-job-posting";

export type { CampaignScoringStats };

export function useCampaignScoringStats(jobs: RecruiterJob[]) {
  const jobIds = useMemo(
    () =>
      jobs
        .map((job) => job.id)
        .sort()
        .join(","),
    [jobs],
  );
  const [stats, setStats] = useState<Record<string, CampaignScoringStats>>({});
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ids = jobIds ? jobIds.split(",") : [];
    if (!ids.length) return;

    let cancelled = false;
    let controller: AbortController | null = null;
    let requestTimer: number | undefined;
    const start = () => {
      if (cancelled) return;
      controller = new AbortController();
      setError(null);
      requestTimer = window.setTimeout(() => controller?.abort(), 15_000);
      void fetch(
        `/api/recruiter/jobs/scoring-summary?jobIds=${encodeURIComponent(jobIds)}`,
        { cache: "no-store", signal: controller.signal },
      )
        .then(async (response) => {
          if (!response.ok) throw new Error("Scoring insights unavailable");
          return campaignScoringStatsResponseSchema.parse(
            await response.json(),
          );
        })
        .then((payload) => {
          if (cancelled) return;
          setStats(payload.stats);
          setLoadedKey(jobIds);
          setError(null);
        })
        .catch(() => {
          if (cancelled) return;
          setStats({});
          setLoadedKey(jobIds);
          setError("Scoring insights are temporarily unavailable.");
        })
        .finally(() => {
          if (requestTimer !== undefined) window.clearTimeout(requestTimer);
        });
    };
    const startTimer = window.setTimeout(start, 100);

    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
      if (requestTimer !== undefined) window.clearTimeout(requestTimer);
      controller?.abort();
    };
  }, [jobIds]);

  return {
    stats,
    error,
    loading: Boolean(jobIds) && loadedKey !== jobIds,
  };
}
