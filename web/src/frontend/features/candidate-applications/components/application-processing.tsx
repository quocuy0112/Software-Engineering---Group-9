"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { mutateWithCurrentCsrf } from "@/frontend/features/authentication/client/current-csrf-proof";
import {
  applicationTrackerSchema,
  type ApplicationTracker,
} from "@/shared/contracts/candidate-applications";

function statusLabel(status: string) {
  if (status === "COMPLETE") return "Complete";
  if (status === "ACTIVE") return "In progress";
  if (status === "ATTENTION_REQUIRED") return "Needs attention";
  return "Waiting";
}

export function ApplicationProcessing({
  initialTracker,
  csrfProof,
}: {
  initialTracker: ApplicationTracker;
  csrfProof: string;
}) {
  const [tracker, setTracker] = useState(initialTracker);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const applicationId = tracker.applicationId;

  const poll = useCallback(async () => {
    try {
      const response = await fetch(`/api/candidate/applications/${encodeURIComponent(applicationId)}`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return;
      const next = applicationTrackerSchema.parse(await response.json());
      setTracker((current) => next.intake.progressPercent >= current.intake.progressPercent ? next : current);
    } catch {
      // A transient polling error should not erase the last persisted state.
    }
  }, [applicationId]);

  useEffect(() => {
    let timer: number | undefined;
    let mounted = true;
    const schedule = () => {
      if (!mounted || document.hidden) return;
      timer = window.setTimeout(async () => {
        if (!mounted || document.hidden) return;
        await poll();
        schedule();
      }, 4_000);
    };
    const onVisibility = () => {
      if (document.hidden) {
        if (timer !== undefined) window.clearTimeout(timer);
        timer = undefined;
      } else {
        schedule();
      }
    };
    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      mounted = false;
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [poll]);

  async function retry() {
    setRetrying(true);
    setError(null);
    try {
      const response = await mutateWithCurrentCsrf(
        `/api/candidate/applications/${encodeURIComponent(applicationId)}/processing/retry`,
        { method: "POST" },
        csrfProof,
      );
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error("The intake check could not be retried.");
      setTracker(applicationTrackerSchema.parse(body));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The intake check could not be retried.");
    } finally {
      setRetrying(false);
    }
  }

  return (
    <section className="candidate-application-flow candidate-application-processing" aria-labelledby="processing-title">
      <header className="candidate-application-flow__header"><div><p className="workspace-kicker">Application received</p><h1 id="processing-title">We’re checking your files</h1><p>{tracker.job.title} · {tracker.job.companyName}</p></div><Link href="/jobs/applied" className="job-secondary-link">Applications</Link></header>
      <div className="candidate-application-progress" role="progressbar" aria-label="Application intake progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={tracker.intake.progressPercent}><span style={{ width: `${tracker.intake.progressPercent}%` }} /></div>
      <p className="candidate-application-progress-label">{tracker.intake.progressPercent}% complete</p>
      {error ? <p className="candidate-application-error" role="alert">{error}</p> : null}
      <ol className="candidate-application-intake-steps">
        {tracker.intake.steps.map((step) => <li key={step.code} className={`intake-step intake-step--${step.status.toLowerCase()}`}><span aria-hidden="true">{step.status === "COMPLETE" ? "✓" : step.status === "ATTENTION_REQUIRED" ? "!" : "•"}</span><div><strong>{step.code === "APPLICATION_RECEIVED" ? "Application received" : step.code === "CHECKING_FILES" ? "Checking files" : "Sent to the recruiter"}</strong><small>{statusLabel(step.status)}</small></div></li>)}
      </ol>
      {tracker.intake.state === "ATTENTION_REQUIRED" ? <div className="candidate-application-warning" role="alert"><strong>One of the files needs attention.</strong><p>We couldn’t finish the technical check. Your application stage remains submitted.</p><button type="button" className="sh-button" disabled={retrying} onClick={() => void retry()}>{retrying ? "Retrying…" : "Retry file checks"}</button></div> : null}
      {tracker.intake.state === "SENT_TO_RECRUITER" ? <div className="candidate-application-success" role="status"><h2>Your application is with the recruiter</h2><p>The technical checks are complete. Your canonical application stage is still shown on the tracker.</p><Link className="sh-button" href={`/jobs/applied/${encodeURIComponent(applicationId)}`}>View application status</Link></div> : <p className="candidate-application-muted">You can leave this page. Your progress is saved and will continue in the background.</p>}
    </section>
  );
}
