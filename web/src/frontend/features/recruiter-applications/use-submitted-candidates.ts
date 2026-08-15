"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ApplicationPage,
  SubmittedCandidate,
} from "@/shared/contracts/applications";

type State = Readonly<{
  items: SubmittedCandidate[];
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
}>;

export function useSubmittedCandidates(jobId: string) {
  const [state, setState] = useState<State>({
    items: [],
    nextCursor: null,
    loading: true,
    loadingMore: false,
    error: null,
  });
  const requestId = useRef(0);

  const load = useCallback(
    async (cursor?: string, append = false) => {
      const currentRequest = ++requestId.current;
      setState((current) => ({
        ...current,
        ...(append ? { loadingMore: true } : { loading: true, error: null }),
      }));
      try {
        const query = new URLSearchParams({ limit: "25" });
        if (cursor) query.set("cursor", cursor);
        const response = await fetch(
          `/api/recruiter/jobs/${encodeURIComponent(jobId)}/applications?${query}`,
          { cache: "no-store", signal: AbortSignal.timeout(15_000) },
        );
        const payload = (await response.json()) as ApplicationPage & {
          message?: string;
        };
        if (!response.ok) throw new Error(payload.message ?? "Unable to load candidates.");
        if (currentRequest !== requestId.current) return;
        setState((current) => ({
          items: append ? [...current.items, ...payload.items] : payload.items,
          nextCursor: payload.nextCursor,
          loading: false,
          loadingMore: false,
          error: null,
        }));
      } catch (error) {
        if (currentRequest !== requestId.current) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState((current) => ({
          ...current,
          loading: false,
          loadingMore: false,
          error: error instanceof Error ? error.message : "Unable to load candidates.",
        }));
      }
    },
    [jobId],
  );

  useEffect(() => {
    void load();
    return () => {
      requestId.current += 1;
    };
  }, [load]);

  return {
    ...state,
    retry: () => void load(),
    loadMore: () =>
      state.nextCursor && !state.loadingMore
        ? void load(state.nextCursor, true)
        : undefined,
  };
}
