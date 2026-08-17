"use client";

import { useEffect, useState } from "react";
import { useCsrfProof } from "@/frontend/features/authentication/client/csrf-proof-context";
import { mutateWithCurrentCsrf } from "@/frontend/features/authentication/client/current-csrf-proof";
import { savedJobOutcomeSchema } from "@/shared/contracts/jobs/actions";
import { useOptionalJobInteraction } from "./job-interaction-provider";

export function SaveJobAction({
  jobId,
  initialSaved,
  initialApplied = false,
  variant = "text",
}: {
  jobId: string;
  initialSaved: boolean;
  initialApplied?: boolean;
  variant?: "text" | "icon" | "button";
}) {
  const csrfProof = useCsrfProof();
  const shared = useOptionalJobInteraction();
  const [localSaved, setLocalSaved] = useState(initialSaved);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pulsing, setPulsing] = useState(false);
  const saved = shared?.records[jobId]?.saved ?? localSaved;
  const registerJob = shared?.registerJob;

  useEffect(() => {
    registerJob?.(jobId, {
      saved: initialSaved,
      applied: initialApplied,
    });
  }, [initialApplied, initialSaved, jobId, registerJob]);

  async function toggle() {
    setPending(true);
    setMessage("");
    setError("");
    try {
      if (shared) {
        await shared.toggleSaved(jobId);
      } else {
        const response = await mutateWithCurrentCsrf(
          "/api/saved-jobs/" + encodeURIComponent(jobId),
          { method: saved ? "DELETE" : "PUT" },
          csrfProof,
        );
        const body: unknown = await response.json();
        if (!response.ok) {
          const problem = body as { message?: unknown };
          throw new Error(
            typeof problem.message === "string"
              ? problem.message
              : "Could not update this saved job. Try again.",
          );
        }
        const outcome = savedJobOutcomeSchema.parse(body);
        setLocalSaved(outcome.saved);
        setMessage(outcome.message);
      }
      setPulsing(true);
      window.setTimeout(() => setPulsing(false), 380);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not update this saved job. Try again.",
      );
    } finally {
      setPending(false);
    }
  }

  const compactLabel = pending
    ? saved
      ? "Removing..."
      : "Saving..."
    : saved
      ? "Saved"
      : "Save";
  const textLabel = pending
    ? saved
      ? "Removing saved job..."
      : "Saving job..."
    : saved
      ? "Remove saved job"
      : "Save job";

  if (variant === "icon") {
    return (
      <span className="job-save-control">
        <button
          className={
            "job-icon-button job-heart-button" +
            (pulsing ? " job-heart-pop" : "")
          }
          type="button"
          aria-label={saved ? "Remove saved job" : "Save job"}
          aria-pressed={saved}
          aria-busy={pending}
          disabled={pending}
          onClick={() => void toggle()}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.8L6 21V4.5Z"
              fill={saved ? "currentColor" : "none"}
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.2"
            />
          </svg>
        </button>
        {error ? <span role="alert">{error}</span> : null}
      </span>
    );
  }

  if (variant === "button") {
    return (
      <span className="job-save-control">
        <button
          className={
            "job-secondary-button job-save-button" +
            (pulsing ? " job-heart-pop" : "")
          }
          type="button"
          aria-pressed={saved}
          aria-busy={pending}
          disabled={pending}
          onClick={() => void toggle()}
        >
          <span aria-hidden="true">{saved ? "♥" : "♡"}</span> {compactLabel}
        </button>
        {error ? <span role="alert">{error}</span> : null}
      </span>
    );
  }

  return (
    <span className="job-inline-action">
      <button
        type="button"
        aria-pressed={saved}
        aria-busy={pending}
        disabled={pending}
        onClick={() => void toggle()}
      >
        {textLabel}
      </button>
      {message ? <span role="status">{message}</span> : null}
      {error ? <span role="alert">{error}</span> : null}
    </span>
  );
}
