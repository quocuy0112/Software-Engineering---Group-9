"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  campaignScoringStatsResponseSchema,
  type CampaignScoringStats,
} from "@/shared/contracts/scoring";
import type { RecruiterJob } from "@/shared/contracts/recruiter-job-posting";

export type { CampaignScoringStats };

const CAMPAIGN_REFRESH_INTERVAL_MS = 90_000;
const CAMPAIGN_REQUEST_TIMEOUT_MS = 15_000;
const CAMPAIGN_STATS_BATCH_SIZE = 100;
const CAMPAIGN_STATS_CACHE_MAX_AGE_MS = 10 * 60_000;
const visibleStatuses = new Set<RecruiterJob["status"]>(["active", "closed"]);

type CampaignStatsCacheEntry = Readonly<{
  stats: Record<string, CampaignScoringStats>;
  updatedAt: number;
}>;

const campaignStatsCache = new Map<string, CampaignStatsCacheEntry>();

export type CampaignRefreshSource = "initial" | "manual" | "background";

type RecruiterCampaignResponse = {
  jobs: RecruiterJob[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseRecruiterCampaignResponse(
  value: unknown,
): RecruiterCampaignResponse {
  if (!isRecord(value) || !Array.isArray(value.jobs)) {
    throw new Error("Campaign data is invalid.");
  }

  return { jobs: value.jobs as RecruiterJob[] };
}

function campaignFingerprint(job: RecruiterJob) {
  return JSON.stringify({
    id: job.id,
    title: job.title,
    status: job.status,
    updatedAt: job.updatedAt,
    companyId: job.companyId,
    companyName: job.company?.name ?? "",
    viewCount: job.stats.viewCount,
    applicantCount: job.stats.applicantCount,
    review: job.review
      ? {
          reviewId: job.review.reviewId,
          state: job.review.state,
          sequence: job.review.sequence,
          version: job.review.version,
        }
      : null,
  });
}

function campaignsFingerprint(jobs: RecruiterJob[]) {
  return jobs.map(campaignFingerprint).join("||");
}

function campaignStatsCacheKey(jobs: RecruiterJob[]) {
  return Array.from(new Set(jobs.map((job) => `${job.id}:${job.companyId}`)))
    .sort()
    .join("|");
}

function campaignStatsJobCacheKey(job: RecruiterJob) {
  return `${job.id}:${job.companyId}`;
}

function readCampaignStatsCache(jobs: RecruiterJob[]) {
  const stats: Record<string, CampaignScoringStats> = {};
  let updatedAt = 0;
  let found = false;
  for (const job of jobs) {
    const key = campaignStatsJobCacheKey(job);
    const entry = campaignStatsCache.get(key);
    if (!entry) continue;
    if (Date.now() - entry.updatedAt > CAMPAIGN_STATS_CACHE_MAX_AGE_MS) {
      campaignStatsCache.delete(key);
      continue;
    }
    const value = entry.stats[job.id];
    if (!value) continue;
    stats[job.id] = value;
    updatedAt = Math.max(updatedAt, entry.updatedAt);
    found = true;
  }
  return found ? { stats, updatedAt } : null;
}

function writeCampaignStatsCache(
  jobs: RecruiterJob[],
  stats: Record<string, CampaignScoringStats>,
) {
  const updatedAt = Date.now();
  for (const job of jobs) {
    const value = stats[job.id];
    if (!value) continue;
    campaignStatsCache.set(campaignStatsJobCacheKey(job), {
      stats: { [job.id]: value },
      updatedAt,
    });
  }
}

function scoringFingerprint(stats: CampaignScoringStats) {
  return [
    stats.total,
    stats.strong,
    stats.review,
    stats.low,
    stats.processing,
  ].join(":");
}

function mergeCampaignJobs(previous: RecruiterJob[], incoming: RecruiterJob[]) {
  const uniqueIncoming = Array.from(
    new Map(incoming.map((job) => [job.id, job])).values(),
  );
  const incomingById = new Map(uniqueIncoming.map((job) => [job.id, job]));
  const previousById = new Map(previous.map((job) => [job.id, job]));
  const orderedIds = [
    ...previous.map((job) => job.id).filter((id) => incomingById.has(id)),
    ...uniqueIncoming
      .map((job) => job.id)
      .filter((id) => !previousById.has(id)),
  ];
  const changedJobIds = new Set<string>();
  let changed = previous.length !== orderedIds.length;
  const jobs = orderedIds.map((id) => {
    const next = incomingById.get(id)!;
    const current = previousById.get(id);
    if (current && campaignFingerprint(current) === campaignFingerprint(next)) {
      return current;
    }
    changed = true;
    changedJobIds.add(id);
    return next;
  });

  return {
    jobs: changed ? jobs : previous,
    changedJobIds,
  };
}

function mergeCampaignStats(
  previous: Record<string, CampaignScoringStats>,
  incoming: Record<string, CampaignScoringStats>,
) {
  const changedJobIds = new Set<string>();
  const merged: Record<string, CampaignScoringStats> = {};
  let changed = Object.keys(previous).length !== Object.keys(incoming).length;

  for (const [jobId, next] of Object.entries(incoming)) {
    const current = previous[jobId];
    if (current && scoringFingerprint(current) === scoringFingerprint(next)) {
      merged[jobId] = current;
      continue;
    }
    merged[jobId] = next;
    changed = true;
    if (current) changedJobIds.add(jobId);
  }

  return {
    stats: changed ? merged : previous,
    changedJobIds,
  };
}

async function fetchJson(url: string, signal: AbortSignal) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" },
    signal,
  });
  if (!response.ok)
    throw new Error(`Request failed with status ${response.status}`);
  return response.json();
}

function chunkJobIds(jobIds: string[]) {
  const chunks: string[][] = [];
  for (
    let index = 0;
    index < jobIds.length;
    index += CAMPAIGN_STATS_BATCH_SIZE
  ) {
    chunks.push(jobIds.slice(index, index + CAMPAIGN_STATS_BATCH_SIZE));
  }
  return chunks;
}

async function fetchCampaignStats(jobIds: string[], signal: AbortSignal) {
  const batches = chunkJobIds(jobIds);
  if (batches.length === 0) return { stats: {} };

  const responses = await Promise.all(
    batches.map(async (batch) =>
      campaignScoringStatsResponseSchema.parse(
        await fetchJson(
          `/api/recruiter/jobs/scoring-summary?jobIds=${encodeURIComponent(batch.join(","))}`,
          signal,
        ),
      ),
    ),
  );
  return {
    stats: Object.assign({}, ...responses.map((response) => response.stats)),
  };
}

export function useCampaignScoringStats(initialJobs: RecruiterJob[]) {
  const [jobs, setJobs] = useState(initialJobs);
  const initialStatsCacheKey = campaignStatsCacheKey(initialJobs);
  const initialStatsCache = readCampaignStatsCache(initialJobs);
  const [stats, setStats] = useState<Record<string, CampaignScoringStats>>(
    () => initialStatsCache?.stats ?? {},
  );
  const [statsLoading, setStatsLoading] = useState(() => !initialStatsCache);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [campaignError, setCampaignError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [changedJobIds, setChangedJobIds] = useState<Set<string>>(
    () => new Set(),
  );
  const jobsRef = useRef(initialJobs);
  const initialJobsFingerprintRef = useRef(campaignsFingerprint(initialJobs));
  const statsCacheKeyRef = useRef(initialStatsCacheKey);
  const statsRef = useRef<Record<string, CampaignScoringStats>>(
    initialStatsCache?.stats ?? {},
  );
  const hasStatsBaselineRef = useRef(Boolean(initialStatsCache));
  const inFlightRef = useRef<Promise<void> | null>(null);
  const activeControllerRef = useRef<AbortController | null>(null);
  const refreshRef = useRef<(source?: CampaignRefreshSource) => Promise<void>>(
    async () => undefined,
  );

  const addChangedJobIds = useCallback((ids: Iterable<string>) => {
    const changedIds = Array.from(ids);
    if (!changedIds.length) return;
    setChangedJobIds((current) => {
      const next = new Set(current);
      let changed = false;
      for (const id of changedIds) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, []);

  const clearChangedJob = useCallback((jobId: string) => {
    setChangedJobIds((current) => {
      if (!current.has(jobId)) return current;
      const next = new Set(current);
      next.delete(jobId);
      return next;
    });
  }, []);

  const refresh = useCallback(
    (source: CampaignRefreshSource = "manual") => {
      const isManual = source === "manual";
      if (isManual) setRefreshing(true);
      if (inFlightRef.current) {
        if (isManual) {
          void inFlightRef.current.finally(() => setRefreshing(false));
        }
        return inFlightRef.current;
      }

      const hadStatsBaseline = hasStatsBaselineRef.current;
      if (!hadStatsBaseline) setStatsLoading(true);
      const controller = new AbortController();
      activeControllerRef.current = controller;
      const requestTimer = window.setTimeout(
        () => controller.abort(),
        CAMPAIGN_REQUEST_TIMEOUT_MS,
      );

      const request = (async () => {
        let campaignLoaded = false;
        let statsLoaded = false;

        try {
          const campaignPayload = parseRecruiterCampaignResponse(
            await fetchJson("/api/recruiter/job-postings", controller.signal),
          );
          const previousJobs = jobsRef.current;
          const merged = mergeCampaignJobs(previousJobs, campaignPayload.jobs);
          jobsRef.current = merged.jobs;
          if (merged.jobs !== previousJobs) setJobs(merged.jobs);
          addChangedJobIds(merged.changedJobIds);
          setCampaignError(null);
          campaignLoaded = true;
        } catch {
          if (!controller.signal.aborted) {
            setCampaignError("Campaign data is temporarily unavailable.");
          }
        }

        const jobIds = jobsRef.current
          .filter((job) => visibleStatuses.has(job.status))
          .map((job) => job.id)
          .sort();

        try {
          const payload = await fetchCampaignStats(jobIds, controller.signal);
          const merged = mergeCampaignStats(statsRef.current, payload.stats);
          statsRef.current = merged.stats;
          setStats(merged.stats);
          writeCampaignStatsCache(jobsRef.current, merged.stats);
          addChangedJobIds(
            hasStatsBaselineRef.current ? merged.changedJobIds : [],
          );
          hasStatsBaselineRef.current = true;
          setStatsError(null);
          statsLoaded = true;
        } catch {
          if (!controller.signal.aborted) {
            setStatsError("Scoring insights are temporarily unavailable.");
          }
        } finally {
          if (!hadStatsBaseline) setStatsLoading(false);
        }

        if (campaignLoaded || statsLoaded) setLastUpdatedAt(new Date());
      })().finally(() => {
        window.clearTimeout(requestTimer);
        if (activeControllerRef.current === controller) {
          activeControllerRef.current = null;
        }
        if (inFlightRef.current === request) inFlightRef.current = null;
        if (isManual) setRefreshing(false);
      });

      inFlightRef.current = request;
      return request;
    },
    [addChangedJobIds],
  );

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    const nextFingerprint = campaignsFingerprint(initialJobs);
    const nextStatsCacheKey = campaignStatsCacheKey(initialJobs);
    if (nextFingerprint === initialJobsFingerprintRef.current) {
      if (nextStatsCacheKey === statsCacheKeyRef.current) return;
    }
    initialJobsFingerprintRef.current = nextFingerprint;
    if (nextStatsCacheKey !== statsCacheKeyRef.current) {
      statsCacheKeyRef.current = nextStatsCacheKey;
      const cached = readCampaignStatsCache(initialJobs);
      statsRef.current = cached?.stats ?? {};
      hasStatsBaselineRef.current = Boolean(cached);
      setStats(statsRef.current);
      setStatsLoading(!cached);
      setLastUpdatedAt(null);
    }
    const previousJobs = jobsRef.current;
    const merged = mergeCampaignJobs(previousJobs, initialJobs);
    jobsRef.current = merged.jobs;
    if (merged.jobs !== previousJobs) setJobs(merged.jobs);
  }, [initialJobs]);

  useEffect(() => {
    void refreshRef.current("initial");
    return () => {
      activeControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    let timer: number | undefined;
    let lastReturnRefreshAt = 0;

    const clearTimer = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
    };
    const schedule = () => {
      clearTimer();
      if (document.visibilityState !== "visible") return;
      timer = window.setTimeout(() => {
        if (document.visibilityState === "visible") {
          void refreshRef.current("background");
        }
        schedule();
      }, CAMPAIGN_REFRESH_INTERVAL_MS);
    };
    const refreshOnReturn = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastReturnRefreshAt < 1_000) return;
      lastReturnRefreshAt = now;
      void refreshRef.current("background");
      schedule();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshOnReturn();
      else clearTimer();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", refreshOnReturn);
    schedule();

    return () => {
      clearTimer();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", refreshOnReturn);
    };
  }, []);

  return {
    jobs,
    stats,
    error: statsError,
    campaignError,
    loading: statsLoading,
    refreshing,
    lastUpdatedAt,
    changedJobIds,
    clearChangedJob,
    refresh,
  };
}
