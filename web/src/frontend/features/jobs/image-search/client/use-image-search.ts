"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ManualSearchContext } from "@/shared/contracts/jobs/image-search";
import type { SearchIntent } from "@/shared/contracts/jobs/search-intent";
import {
  cancelImageSearch,
  consumeImageSearchResult,
  getImageSearchStatus,
  reserveImageSearch,
  uploadImageSearchContent,
  revokeImageSearchConsent,
} from "./image-search-api";

type State = Readonly<{
  phase: "IDLE" | "UPLOADING" | "PROCESSING" | "READY" | "FALLBACK" | "ERROR";
  progress: number;
  intent: SearchIntent | null;
  fallbackReason: ImageSearchFallbackReason | null;
  error: string | null;
  retryAt: string | null;
}>;

export type ImageSearchFallbackReason =
  | "LOW_CONFIDENCE"
  | "INTERPRETER_UNAVAILABLE"
  | "INTERPRETER_INVALID_OUTPUT"
  | "UNKNOWN";

function fallbackReason(
  warnings: readonly string[],
): ImageSearchFallbackReason {
  if (warnings.includes("INTERPRETER_INVALID_OUTPUT"))
    return "INTERPRETER_INVALID_OUTPUT";
  if (warnings.includes("INTERPRETER_UNAVAILABLE"))
    return "INTERPRETER_UNAVAILABLE";
  if (warnings.includes("LOW_CONFIDENCE")) return "LOW_CONFIDENCE";
  return "UNKNOWN";
}

const initialState: State = {
  phase: "IDLE",
  progress: 0,
  intent: null,
  fallbackReason: null,
  error: null,
  retryAt: null,
};

export function useImageSearch(input: {
  currentCriteria: ManualSearchContext;
  csrfProof: string;
}) {
  const [state, setState] = useState<State>(initialState);
  const active = useRef<{
    interactionId: string;
    queryId: string | null;
    capability: string | null;
    controller: AbortController;
  } | null>(null);
  const criteriaFingerprint = JSON.stringify(input.currentCriteria);
  const previousCriteriaFingerprint = useRef(criteriaFingerprint);

  const cancel = useCallback(async () => {
    const current = active.current;
    active.current = null;
    current?.controller.abort();
    setState(initialState);
    if (current?.queryId)
      await cancelImageSearch({
        queryId: current.queryId,
        capability: current.capability,
        idempotencyKey: crypto.randomUUID(),
        csrfProof: input.csrfProof,
      }).catch(() => undefined);
  }, [input.csrfProof]);

  const start = useCallback(
    async (file: File) => {
      await cancel();
      if (
        !["image/png", "image/jpeg"].includes(file.type) ||
        file.size < 1 ||
        file.size > 5_000_000
      ) {
        setState({
          ...initialState,
          phase: "ERROR",
          error: "Choose one PNG or JPEG up to 5 MB.",
        });
        return;
      }
      const interactionId = crypto.randomUUID();
      const controller = new AbortController();
      active.current = {
        interactionId,
        queryId: null,
        capability: null,
        controller,
      };
      try {
        setState({ ...initialState, phase: "UPLOADING", progress: 10 });
        const reservation = await reserveImageSearch({
          request: {
            extension: file.type === "image/png" ? "png" : "jpg",
            mediaType: file.type as "image/png" | "image/jpeg",
            bytes: file.size,
            interpreterClass: "EXTERNAL_OPENAI",
            consent: {
              provider: "openai",
              model: "gpt-5.4-mini-2026-03-17",
              purposeVersion: "job-image-search-purpose-v1",
              noticeVersion: "image-search-notice-v1",
              consentTextVersion: "image-search-consent-v1",
              retentionDisclosureVersion: "image-search-retention-v1",
            },
          },
          idempotencyKey: crypto.randomUUID(),
          csrfProof: input.csrfProof,
          signal: controller.signal,
        });
        if (
          controller.signal.aborted ||
          active.current?.interactionId !== interactionId
        ) {
          void cancelImageSearch({
            queryId: reservation.queryId,
            capability: reservation.capability,
            idempotencyKey: crypto.randomUUID(),
            csrfProof: input.csrfProof,
          }).catch(() => undefined);
          return;
        }
        active.current = {
          interactionId,
          queryId: reservation.queryId,
          capability: reservation.capability,
          controller,
        };
        await uploadImageSearchContent({
          queryId: reservation.queryId,
          capability: reservation.capability,
          file,
          idempotencyKey: crypto.randomUUID(),
          csrfProof: input.csrfProof,
          signal: controller.signal,
        });
        setState({ ...initialState, phase: "PROCESSING", progress: 30 });
        while (!controller.signal.aborted) {
          const status = await getImageSearchStatus({
            queryId: reservation.queryId,
            capability: reservation.capability,
            signal: controller.signal,
          });
          if (active.current?.interactionId !== interactionId) return;
          if (["RESULT_READY", "FALLBACK_READY"].includes(status.state)) {
            const result = await consumeImageSearchResult({
              queryId: reservation.queryId,
              capability: reservation.capability,
              currentCriteria: input.currentCriteria,
              idempotencyKey: crypto.randomUUID(),
              csrfProof: input.csrfProof,
              signal: controller.signal,
            });
            if (active.current?.interactionId !== interactionId) return;
            active.current = null;
            setState(
              result.kind === "VALIDATED_INTENT"
                ? {
                    ...initialState,
                    phase: "READY",
                    progress: 100,
                    intent: result.intent,
                  }
                : {
                    ...initialState,
                    phase: "FALLBACK",
                    progress: 100,
                    fallbackReason: fallbackReason(result.warnings),
                  },
            );
            return;
          }
          if (
            [
              "VALIDATION_FAILED",
              "INFECTED",
              "SCAN_FAILED",
              "DECODE_FAILED",
              "OCR_FAILED",
              "INTERPRET_FAILED",
              "CANCELLED",
              "EXPIRED",
              "DELETED",
            ].includes(status.state)
          )
            throw new Error(
              "Image processing ended. You can still search manually.",
            );
          setState((current) => ({
            ...current,
            progress: Math.min(90, current.progress + 8),
          }));
          await new Promise((resolve) => setTimeout(resolve, 650));
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        active.current = null;
        setState({
          ...initialState,
          phase: "ERROR",
          error: (error as Error).message,
          retryAt:
            "retryAt" in (error as object)
              ? String((error as { retryAt?: unknown }).retryAt ?? "") || null
              : null,
        });
      }
    },
    [cancel, input.csrfProof, input.currentCriteria],
  );

  const revokeConsent = useCallback(async () => {
    const current = active.current;
    if (!current?.queryId) return;
    await revokeImageSearchConsent({
      queryId: current.queryId,
      capability: current.capability,
      idempotencyKey: crypto.randomUUID(),
      csrfProof: input.csrfProof,
    });
  }, [input.csrfProof]);

  useEffect(() => {
    if (previousCriteriaFingerprint.current === criteriaFingerprint) return;
    previousCriteriaFingerprint.current = criteriaFingerprint;
    void cancel();
  }, [cancel, criteriaFingerprint]);

  useEffect(() => {
    const onPageHide = () => {
      const current = active.current;
      active.current = null;
      current?.controller.abort();
      if (current?.queryId)
        void cancelImageSearch({
          queryId: current.queryId,
          capability: current.capability,
          idempotencyKey: crypto.randomUUID(),
          csrfProof: input.csrfProof,
        }).catch(() => undefined);
    };
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      onPageHide();
    };
  }, [input.csrfProof]);

  return {
    ...state,
    start,
    cancel,
    revokeConsent,
    clear: () => setState(initialState),
  };
}
