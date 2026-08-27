"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RankedApplicationPage } from "@/shared/contracts/scoring";
import type { WorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { recruiterApplicationsCopy } from "./recruiter-applications-copy";

export type RankedCandidateQuery = Readonly<{
  sort: "FINAL_SCORE" | "MANUAL_PRIORITY" | "SUBMITTED_AT";
  search?: string;
  minScore?: number;
  maxScore?: number;
  skill?: string;
  minExperience?: number;
  stage:
    | "ACTIVE_PIPELINE"
    | "ALL"
    | "APPLIED"
    | "VIEWED"
    | "SHORTLISTED"
    | "INTERVIEWING"
    | "OFFERED"
    | "HIRED"
    | "OFFER_DECLINED"
    | "REJECTED"
    | "WAITLISTED"
    | "WITHDRAWN";
  scoringStatus:
    | "ALL"
    | "PROCESSING"
    | "SCORED"
    | "UNAVAILABLE"
    | "FAILED"
    | "NOT_CALCULATED";
}>;

type RankedPageCacheEntry = Readonly<{
  page: RankedApplicationPage;
  updatedAt: number;
}>;

const RANKED_PAGE_CACHE_MAX_AGE_MS = 10 * 60_000;
const RANKED_PAGE_CACHE_MAX_ENTRIES = 100;
const rankedPageCache = new Map<string, RankedPageCacheEntry>();
const rankedPageRequests = new Map<string, Promise<RankedApplicationPage>>();
const rankedPageRequestVersions = new Map<string, number>();

function rankedPageCacheKey(
  jobId: string,
  queryKey: string,
  pageSize: number,
  pageIndex: number,
) {
  return `${jobId}:${pageSize}:${pageIndex}:${queryKey}`;
}

function readRankedPageCache(key: string) {
  const entry = rankedPageCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.updatedAt > RANKED_PAGE_CACHE_MAX_AGE_MS) {
    rankedPageCache.delete(key);
    return null;
  }
  return entry;
}

function writeRankedPageCache(key: string, page: RankedApplicationPage) {
  rankedPageCache.delete(key);
  rankedPageCache.set(key, { page, updatedAt: Date.now() });
  while (rankedPageCache.size > RANKED_PAGE_CACHE_MAX_ENTRIES) {
    const oldestKey = rankedPageCache.keys().next().value;
    if (oldestKey === undefined) break;
    rankedPageCache.delete(oldestKey);
  }
}

async function requestRankedPage(key: string, url: string, force = false) {
  const existing = rankedPageRequests.get(key);
  if (existing && !force) return existing;

  const version = (rankedPageRequestVersions.get(key) ?? 0) + 1;
  rankedPageRequestVersions.set(key, version);

  const request = (async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => null)) as
        | (RankedApplicationPage & { message?: string })
        | null;
      if (!response.ok || !payload) {
        throw new Error(
          payload?.message ?? "Unable to load candidate ranking.",
        );
      }
      // A forced refresh supersedes an older request for the same page. Do not
      // let the older response repopulate the cache after fresh data arrives.
      if (rankedPageRequestVersions.get(key) === version) {
        writeRankedPageCache(key, payload);
      }
      return payload;
    } finally {
      window.clearTimeout(timeout);
      if (rankedPageRequestVersions.get(key) === version) {
        rankedPageRequests.delete(key);
        rankedPageRequestVersions.delete(key);
      }
    }
  })();
  rankedPageRequests.set(key, request);
  return request;
}

export function useRankedCandidates(
  jobId: string,
  query: RankedCandidateQuery,
  pageSize: number,
  locale: WorkspaceLocale = "en",
) {
  const queryKey = useMemo(
    () => JSON.stringify({ ...query, pageSize }),
    [pageSize, query],
  );
  const initialCacheEntry = useMemo(
    () => readRankedPageCache(rankedPageCacheKey(jobId, queryKey, pageSize, 0)),
    [jobId, pageSize, queryKey],
  );
  const [page, setPage] = useState<RankedApplicationPage | null>(
    () => initialCacheEntry?.page ?? null,
  );
  const [loading, setLoading] = useState(() => !initialCacheEntry);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const requestId = useRef(0);
  const requestInFlight = useRef(false);

  const fetchPage = useCallback(
    async (index: number, options: { force?: boolean } = {}) => {
      const id = ++requestId.current;
      requestInFlight.current = true;
      const key = rankedPageCacheKey(jobId, queryKey, pageSize, index);
      const force = options.force === true;
      if (force) rankedPageCache.delete(key);
      const cachedPage = readRankedPageCache(key);
      const hasCachedPage = Boolean(cachedPage);
      if (cachedPage) {
        setPage(cachedPage.page);
        setPageIndex(index);
      }
      setLoading(!hasCachedPage);
      setRefreshing(hasCachedPage);
      setError(null);
      try {
        const params = new URLSearchParams({
          limit: String(pageSize),
          sort: query.sort,
          stage: query.stage,
          scoringStatus: query.scoringStatus,
          page: String(index),
        });
        for (const [key, value] of Object.entries(query)) {
          if (
            key === "sort" ||
            key === "stage" ||
            key === "scoringStatus" ||
            value === undefined ||
            value === ""
          )
            continue;
          params.set(key, String(value));
        }
        const payload = await requestRankedPage(
          key,
          `/api/recruiter/jobs/${encodeURIComponent(jobId)}/applications/ranked?${params}`,
          force,
        );
        if (id !== requestId.current) return;
        setPage(payload);
        setPageIndex(index);
      } catch (cause) {
        if (id !== requestId.current) return;
        const isAbortError =
          (cause instanceof DOMException && cause.name === "AbortError") ||
          (cause instanceof Error &&
            ["AbortError", "TimeoutError"].includes(cause.name));
        if (isAbortError) {
          setError(recruiterApplicationsCopy(locale).ranking.loadError);
          return;
        }
        if (
          cause instanceof TypeError &&
          /failed to fetch/iu.test(cause.message)
        ) {
          setError(recruiterApplicationsCopy(locale).ranking.loadError);
          return;
        }
        setError(recruiterApplicationsCopy(locale).ranking.loadError);
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
          requestInFlight.current = false;
        }
      }
    },
    [jobId, locale, pageSize, query, queryKey],
  );

  useEffect(() => {
    // The fetch callback owns loading/error/page state; this effect only starts the request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchPage(0);
    return () => {
      requestId.current += 1;
    };
  }, [fetchPage, queryKey]);

  const refresh = useCallback(() => {
    // A score update can change both the row score and its rank, so restart
    // from the first page and force a fresh snapshot. This also supersedes an
    // older in-flight request that may still contain the previous score.
    void fetchPage(0, { force: true });
  }, [fetchPage]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined")
      return;
    const refreshWhenVisible = () => {
      if (document.visibilityState !== "visible" || requestInFlight.current)
        return;
      refresh();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);
    return () => {
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
    };
  }, [refresh]);

  return {
    page,
    loading,
    refreshing,
    error,
    pageIndex,
    hasPrevious: pageIndex > 0,
    hasNext: Boolean(
      page && (pageIndex + 1) * pageSize < page.filteredCandidates,
    ),
    goToPage: (nextPageIndex: number) => {
      if (nextPageIndex < 0) return;
      const pageCount = Math.max(
        1,
        Math.ceil((page?.filteredCandidates ?? 0) / pageSize),
      );
      if (nextPageIndex >= pageCount) return;
      void fetchPage(nextPageIndex);
    },
    next: () =>
      page && (pageIndex + 1) * pageSize < page.filteredCandidates
        ? void fetchPage(pageIndex + 1)
        : undefined,
    previous: () => (pageIndex > 0 ? void fetchPage(pageIndex - 1) : undefined),
    retry: () => void fetchPage(pageIndex),
    refresh,
  };
}
