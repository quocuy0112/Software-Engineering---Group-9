"use client";

import { useEffect, useState } from "react";
import { useCsrfProof } from "@/frontend/features/authentication/client/csrf-proof-context";
import { mutateWithCurrentCsrf } from "@/frontend/features/authentication/client/current-csrf-proof";
import { savedJobOutcomeSchema } from "@/shared/contracts/jobs/actions";
import { useOptionalJobInteraction } from "./job-interaction-provider";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { jobCopy } from "./job-copy";

export function SaveBookmarkIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.8L6 21V4.5Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
    </svg>
  );
}

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
  const copy = jobCopy(useWorkspaceLocale());
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
          throw new Error("SAVED_JOB_UPDATE_FAILED");
        }
        const outcome = savedJobOutcomeSchema.parse(body);
        setLocalSaved(outcome.saved);
        setMessage(outcome.saved ? copy.savedSuccess : copy.removedSuccess);
      }
      setPulsing(true);
      window.setTimeout(() => setPulsing(false), 380);
    } catch {
      setError(copy.updateFailed);
    } finally {
      setPending(false);
    }
  }

  const compactLabel = pending
    ? saved
      ? copy.removing
      : copy.saving
    : saved
      ? copy.saved
      : copy.save;
  const textLabel = pending
    ? saved
      ? copy.removingJob
      : copy.savingJob
    : saved
      ? copy.removeSavedJob
      : copy.saveJob;

  if (variant === "icon") {
    return (
      <span className="job-save-control">
        <button
          className={
            "job-icon-button job-heart-button" +
            (pulsing ? " job-heart-pop" : "")
          }
          type="button"
          aria-label={saved ? copy.removeSavedJob : copy.saveJob}
          aria-pressed={saved}
          aria-busy={pending}
          disabled={pending}
          onClick={() => void toggle()}
        >
          <SaveBookmarkIcon filled={saved} />
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
          <SaveBookmarkIcon filled={saved} />
          <span>{compactLabel}</span>
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
