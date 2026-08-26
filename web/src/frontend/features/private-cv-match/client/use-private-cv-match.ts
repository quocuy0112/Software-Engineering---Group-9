"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useCsrfProof } from "@/frontend/features/authentication/client/csrf-proof-context";
import { mutateWithCurrentCsrf } from "@/frontend/features/authentication/client/current-csrf-proof";
import {
  privateMatchResponseSchema,
  privateMatchListResponseSchema,
  type CreatePrivateMatchRequest,
  type PrivateMatchResponse,
} from "@/shared/contracts/private-cv-match";
import {
  privateMatchCopy,
  type PrivateMatchLocale,
} from "../i18n/private-match-copy";

const queryKey = (checkId: string) => ["private-cv-match", checkId] as const;
const listQueryKey = ["private-cv-match-list"] as const;

async function responseError(response: Response): Promise<Error> {
  let code = "INTERNAL_FAILURE";
  try {
    const body = (await response.json()) as { code?: unknown };
    if (typeof body.code === "string") code = body.code;
  } catch {
    // Keep a stable, non-sensitive client error for an invalid response.
  }
  return new Error(code);
}

function idempotencyKey(prefix: string) {
  const value =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${value}`.slice(0, 128);
}

export function usePrivateCvMatch(checkId: string) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const updateVisibility = () =>
      setIsVisible(document.visibilityState === "visible");
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () =>
      document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  return useQuery<PrivateMatchResponse>({
    queryKey: queryKey(checkId),
    queryFn: async () => {
      const response = await fetch(
        `/api/candidate/private-cv-matches/${encodeURIComponent(checkId)}`,
        {
          cache: "no-store",
          headers: { Accept: "application/json" },
        },
      );
      if (!response.ok) throw await responseError(response);
      return privateMatchResponseSchema.parse(await response.json());
    },
    refetchInterval: (query) => {
      if (!isVisible) return false;
      const data = query.state.data;
      return data?.view === "STATUS" &&
        (data.state === "QUEUED" || data.state === "ANALYZING")
        ? 4_000
        : (data?.view === "LIMITED_REPORT" || data?.view === "FULL_REPORT") &&
            data.retryInProgress
          ? 4_000
          : false;
    },
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function usePrivateCvMatchList() {
  return useQuery({
    queryKey: listQueryKey,
    queryFn: async () => {
      const response = await fetch("/api/candidate/private-cv-matches", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw await responseError(response);
      return privateMatchListResponseSchema.parse(await response.json());
    },
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });
}

export function useCreatePrivateCvMatch() {
  const csrfProof = useCsrfProof();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePrivateMatchRequest) => {
      const response = await mutateWithCurrentCsrf(
        "/api/candidate/private-cv-matches",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey("private-create"),
          },
          body: JSON.stringify(input),
        },
        csrfProof,
      );
      if (!response.ok) throw await responseError(response);
      return privateMatchResponseSchema.parse(await response.json());
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: listQueryKey });
      if (result.view !== "STATUS") return;
      void queryClient.invalidateQueries({
        queryKey: queryKey(result.checkId),
      });
    },
  });
}

export function useRetryPrivateCvMatch(checkId: string) {
  const csrfProof = useCsrfProof();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await mutateWithCurrentCsrf(
        `/api/candidate/private-cv-matches/${encodeURIComponent(checkId)}/retry-ai`,
        {
          method: "POST",
          headers: {
            "Idempotency-Key": idempotencyKey("private-retry"),
          },
        },
        csrfProof,
      );
      if (!response.ok) throw await responseError(response);
      return privateMatchResponseSchema.parse(await response.json());
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: listQueryKey });
      void queryClient.invalidateQueries({ queryKey: queryKey(checkId) });
    },
  });
}

export function useDeletePrivateCvMatch(checkId: string) {
  const csrfProof = useCsrfProof();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await mutateWithCurrentCsrf(
        `/api/candidate/private-cv-matches/${encodeURIComponent(checkId)}`,
        { method: "DELETE" },
        csrfProof,
      );
      if (!response.ok) throw await responseError(response);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: listQueryKey });
      void queryClient.invalidateQueries({ queryKey: queryKey(checkId) });
    },
  });
}

export function privateMatchErrorMessage(
  error: unknown,
  locale: PrivateMatchLocale = "en",
): string {
  const code = error instanceof Error ? error.message : "INTERNAL_FAILURE";
  const copy = privateMatchCopy(locale).errors;
  switch (code) {
    case "CV_NOT_PARSED":
      return copy.CV_NOT_PARSED;
    case "JOB_UNAVAILABLE":
      return copy.JOB_UNAVAILABLE;
    case "CV_UNAVAILABLE":
      return copy.CV_UNAVAILABLE;
    case "AUTH_REQUIRED":
      return copy.AUTH_REQUIRED;
    case "FORBIDDEN":
      return copy.FORBIDDEN;
    case "INVALID_REQUEST":
      return copy.INVALID_REQUEST;
    case "CONFLICT":
      return copy.CONFLICT;
    case "UNAVAILABLE":
      return copy.UNAVAILABLE;
    case "CV_NOT_RECOGNIZED_AS_CV":
      return copy.CV_NOT_RECOGNIZED_AS_CV;
    case "CV_TEXT_UNAVAILABLE":
    case "SCORING_CV_TEXT_UNAVAILABLE":
    case "CV_TEXT_TOO_SHORT":
    case "CV_TEXT_INVALID":
      return copy.CV_CONTENT_UNREADABLE;
    case "SCORING_TIMEOUT":
      return copy.SCORING_TIMEOUT;
    case "CV_CLASSIFICATION_TIMEOUT":
    case "CV_CLASSIFICATION_UNAVAILABLE":
    case "CV_CLASSIFICATION_MALFORMED":
    case "CV_CLASSIFICATION_NOT_CONFIGURED":
      return copy.SCORING_UNAVAILABLE;
    default:
      return copy.default;
  }
}
