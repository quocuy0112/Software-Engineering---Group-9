"use client";

import { useState } from "react";
import { currentCsrfProof } from "@/frontend/features/authentication/client/current-csrf-proof";
import { savedJobOutcomeSchema } from "@/shared/contracts/jobs/actions";

export function SaveJobAction({
  jobId,
  initialSaved,
}: {
  jobId: string;
  initialSaved: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function toggle() {
    setPending(true);
    setMessage("");
    setError("");
    try {
      const proof = await currentCsrfProof("");
      const response = await fetch(
        `/api/saved-jobs/${encodeURIComponent(jobId)}`,
        {
          method: saved ? "DELETE" : "PUT",
          headers: { "X-CSRF-Token": proof },
        },
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
      setSaved(outcome.saved);
      setMessage(outcome.message);
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

  return (
    <span className="job-inline-action">
      <button
        type="button"
        aria-pressed={saved}
        disabled={pending}
        onClick={toggle}
      >
        {pending
          ? "Updating saved job…"
          : saved
            ? "Remove saved job"
            : "Save job"}
      </button>
      {message ? <span role="status">{message}</span> : null}
      {error ? <span role="alert">{error}</span> : null}
    </span>
  );
}
