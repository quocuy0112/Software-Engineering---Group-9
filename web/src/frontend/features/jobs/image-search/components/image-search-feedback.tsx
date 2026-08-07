"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import type { ImageSearchFallbackReason } from "../client/use-image-search";

type FeedbackPhase =
  | "IDLE"
  | "UPLOADING"
  | "PROCESSING"
  | "READY"
  | "FALLBACK"
  | "ERROR";

function retryDescription(error: string, retryAt: string | null) {
  if (!retryAt) return error;
  const retryDate = new Date(retryAt);
  if (Number.isNaN(retryDate.getTime())) return error;
  return `${error} Try again after ${retryDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}.`;
}

export function ImageSearchFeedback({
  phase,
  error,
  fallbackReason,
  retryAt,
  proposalCount,
  warningCount,
}: {
  phase: FeedbackPhase;
  error: string | null;
  fallbackReason: ImageSearchFallbackReason | null;
  retryAt: string | null;
  proposalCount: number;
  warningCount: number;
}) {
  useEffect(() => {
    if (phase === "ERROR" && error) {
      toast.error("Image search could not continue", {
        id: "image-search-feedback",
        description: retryDescription(error, retryAt),
        duration: 8_000,
      });
      return;
    }
    if (phase === "FALLBACK") {
      const invalid = fallbackReason === "INTERPRETER_INVALID_OUTPUT";
      const lowConfidence = fallbackReason === "LOW_CONFIDENCE";
      toast.warning(
        lowConfidence
          ? "Image text was not clear enough"
          : invalid
            ? "AI filters need another attempt"
            : "AI filter suggestions are unavailable",
        {
          id: "image-search-feedback",
          description:
            "No recognized text was added to the header search or Find jobs filters.",
          duration: 7_000,
        },
      );
      return;
    }
    if (phase !== "READY") return;
    if (proposalCount === 0 || warningCount > 0) {
      toast.warning("Job filters are ready for review", {
        id: "image-search-feedback",
        description:
          proposalCount === 0
            ? "No reliable filters were found. Ordinary job search is still available."
            : `${proposalCount} suggested ${proposalCount === 1 ? "filter" : "filters"} found; review the highlighted guidance before applying them.`,
        duration: 7_000,
      });
      return;
    }
    toast.success("Job filters are ready", {
      id: "image-search-feedback",
      description: `${proposalCount} suggested ${proposalCount === 1 ? "filter" : "filters"} found. Review and apply only what you want.`,
      duration: 5_000,
    });
  }, [error, fallbackReason, phase, proposalCount, retryAt, warningCount]);

  return null;
}
