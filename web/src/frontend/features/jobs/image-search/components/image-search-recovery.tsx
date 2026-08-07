"use client";

import type { ImageSearchFallbackReason } from "../client/use-image-search";

const fallbackContent: Record<
  ImageSearchFallbackReason,
  { heading: string; description: string }
> = {
  LOW_CONFIDENCE: {
    heading: "Image text was not clear enough",
    description:
      "OpenAI did not receive sufficiently reliable text to create job filters. Try a clearer image.",
  },
  INTERPRETER_UNAVAILABLE: {
    heading: "AI filter suggestions are unavailable",
    description:
      "OpenAI could not create filter suggestions for this image. No recognized text was added to your search.",
  },
  INTERPRETER_INVALID_OUTPUT: {
    heading: "AI filters need another attempt",
    description:
      "The AI response could not be converted into supported job filters. No recognized text was added to your search.",
  },
  UNKNOWN: {
    heading: "No compatible AI filters were created",
    description:
      "This image did not produce supported job filters. No recognized text was added to your search.",
  },
};

export function ImageSearchRecovery({
  error,
  fallbackReason,
  retryAt,
  onRetry,
  onManual,
}: {
  error: string | null;
  fallbackReason: ImageSearchFallbackReason | null;
  retryAt?: string | null;
  onRetry(): void;
  onManual(): void;
}) {
  if (fallbackReason) {
    const content = fallbackContent[fallbackReason];
    return (
      <div
        role="status"
        className="image-search-recovery image-search-recovery-warning"
      >
        <h3>{content.heading}</h3>
        <p>{content.description}</p>
        <button type="button" onClick={onRetry}>
          Try another image
        </button>
        <button type="button" onClick={() => onManual()}>
          Continue to Find jobs
        </button>
      </div>
    );
  }
  if (!error) return null;
  const retryDate = retryAt ? new Date(retryAt) : null;
  const retryLabel =
    retryDate && !Number.isNaN(retryDate.getTime())
      ? retryDate.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;
  return (
    <div
      role="alert"
      className="image-search-recovery image-search-recovery-error"
    >
      <h3>Image search unavailable</h3>
      <p>{error}</p>
      {retryLabel ? <p>Try again after {retryLabel}.</p> : null}
      <p>Ordinary text search is still available.</p>
      <button type="button" onClick={onRetry}>
        Try another image
      </button>
      <button type="button" onClick={() => onManual()}>
        Search manually
      </button>
    </div>
  );
}
