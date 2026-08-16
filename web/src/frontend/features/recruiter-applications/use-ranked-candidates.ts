"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RankedApplicationPage } from "@/shared/contracts/scoring";

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
    | "WAITLISTED";
  scoringStatus:
    | "ALL"
    | "PROCESSING"
    | "SCORED"
    | "UNAVAILABLE"
    | "NOT_CALCULATED";
}>;

export function useRankedCandidates(
  jobId: string,
  query: RankedCandidateQuery,
  pageSize: number,
) {
  const [page, setPage] = useState<RankedApplicationPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const cursors = useRef<Array<string | undefined>>([undefined]);
  const requestId = useRef(0);
  const activeController = useRef<AbortController | null>(null);
  const queryKey = useMemo(
    () => JSON.stringify({ ...query, pageSize }),
    [pageSize, query],
  );

  const fetchPage = useCallback(
    async (cursor: string | undefined, index: number) => {
      const id = ++requestId.current;
      activeController.current?.abort();
      const controller = new AbortController();
      activeController.current = controller;
      const timeout = window.setTimeout(() => controller.abort(), 15_000);
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          limit: String(pageSize),
          sort: query.sort,
          stage: query.stage,
          scoringStatus: query.scoringStatus,
        });
        if (cursor) params.set("cursor", cursor);
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
        const response = await fetch(
          `/api/recruiter/jobs/${encodeURIComponent(jobId)}/applications/ranked?${params}`,
          { cache: "no-store", signal: controller.signal },
        );
        const payload = (await response.json().catch(() => null)) as
          | (RankedApplicationPage & { message?: string })
          | null;
        if (!response.ok || !payload)
          throw new Error(
            payload?.message ?? "Unable to load candidate ranking.",
          );
        if (id !== requestId.current) return;
        setPage(payload);
        setPageIndex(index);
        cursors.current[index + 1] = payload.nextCursor ?? undefined;
      } catch (cause) {
        if (id !== requestId.current) return;
        const isAbortError =
          (cause instanceof DOMException && cause.name === "AbortError") ||
          (cause instanceof Error && cause.name === "AbortError");
        if (isAbortError) {
          setError("Candidate ranking took too long to respond.");
          return;
        }
        if (
          cause instanceof TypeError &&
          /failed to fetch/iu.test(cause.message)
        ) {
          setError(
            "The ranking service is temporarily unavailable. Please retry.",
          );
          return;
        }
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to load candidate ranking.",
        );
      } finally {
        window.clearTimeout(timeout);
        if (activeController.current === controller) {
          activeController.current = null;
        }
        if (id === requestId.current) setLoading(false);
      }
    },
    [jobId, pageSize, query],
  );

  useEffect(() => {
    cursors.current = [undefined];
    // The fetch callback owns loading/error/page state; this effect only starts the request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchPage(undefined, 0);
    return () => {
      requestId.current += 1;
      activeController.current?.abort();
      activeController.current = null;
    };
  }, [fetchPage, queryKey]);

  const refresh = useCallback(() => {
    // A score update can change both the row score and its rank. Reusing the
    // current cursor would reuse the old ranking snapshot and keep stale
    // values on pages after the first one.
    cursors.current = [undefined];
    void fetchPage(undefined, 0);
  }, [fetchPage]);

  return {
    page,
    loading,
    error,
    pageIndex,
    hasPrevious: pageIndex > 0,
    hasNext: Boolean(page?.nextCursor),
    next: () =>
      page?.nextCursor
        ? void fetchPage(page.nextCursor, pageIndex + 1)
        : undefined,
    previous: () =>
      pageIndex > 0
        ? void fetchPage(cursors.current[pageIndex - 1], pageIndex - 1)
        : undefined,
    retry: () => void fetchPage(cursors.current[pageIndex], pageIndex),
    refresh,
  };
}
