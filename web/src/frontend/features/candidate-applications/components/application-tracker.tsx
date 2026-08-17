"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { mutateWithCurrentCsrf } from "@/frontend/features/authentication/client/current-csrf-proof";
import {
  applicationTrackerSchema,
  notificationPreferenceSchema,
  type ApplicationTracker,
} from "@/shared/contracts/candidate-applications";

const publicStages = [
  ["APPLICATION_SUBMITTED", "Application submitted"],
  ["UNDER_REVIEW", "Under review"],
  ["INTERVIEW", "Interview"],
  ["OUTCOME", "Outcome"],
] as const;

function date(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function ApplicationTracker({
  initialTracker,
  csrfProof,
}: {
  initialTracker: ApplicationTracker;
  csrfProof: string;
}) {
  const [tracker, setTracker] = useState(initialTracker);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const applicationId = tracker.applicationId;

  const poll = useCallback(async () => {
    try {
      const response = await fetch(`/api/candidate/applications/${encodeURIComponent(applicationId)}`, { cache: "no-store", credentials: "same-origin", headers: { Accept: "application/json" } });
      if (!response.ok) return;
      const next = applicationTrackerSchema.parse(await response.json());
      setTracker((current) => next.stageVersion >= current.stageVersion && next.intake.progressPercent >= current.intake.progressPercent ? next : current);
    } catch {
      // Keep the last safe server projection visible during transient failures.
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

  async function setPreference(field: "emailEnabled" | "inAppEnabled", value: boolean) {
    setPending(field);
    setError(null);
    const current = tracker.notificationPreference;
    try {
      const response = await mutateWithCurrentCsrf(
        `/api/candidate/applications/${encodeURIComponent(applicationId)}/notification-preferences`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            emailEnabled: field === "emailEnabled" ? value : current.emailEnabled,
            inAppEnabled: field === "inAppEnabled" ? value : current.inAppEnabled,
            expectedVersion: current.version,
          }),
        },
        csrfProof,
      );
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error("Notification settings could not be updated. Refresh and try again.");
      const preference = notificationPreferenceSchema.parse(body);
      setTracker((currentTracker) => ({ ...currentTracker, notificationPreference: preference }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Notification settings could not be updated.");
    } finally {
      setPending(null);
    }
  }

  async function withdraw() {
    if (!tracker.canWithdraw || pending) return;
    if (!window.confirm("Withdraw this application? This cannot be undone.")) return;
    setPending("withdraw");
    setError(null);
    try {
      const response = await mutateWithCurrentCsrf(
        `/api/candidate/applications/${encodeURIComponent(applicationId)}/withdraw`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "idempotency-key": crypto.randomUUID() },
          body: JSON.stringify({ expectedVersion: tracker.stageVersion, confirmed: true }),
        },
        csrfProof,
      );
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error("This application could not be withdrawn. Refresh and try again.");
      await poll();
      void body;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This application could not be withdrawn.");
    } finally {
      setPending(null);
    }
  }

  const activeIndex = Math.max(0, publicStages.findIndex(([stage]) => stage === tracker.publicStage));
  return (
    <section className="candidate-application-flow candidate-application-tracker" aria-labelledby="application-tracker-title">
      <header className="candidate-application-flow__header"><div><p className="workspace-kicker">Application tracker</p><h1 id="application-tracker-title">{tracker.job.title}</h1><p>{tracker.job.companyName} · {tracker.job.location}</p><p className="candidate-application-muted">Application ID {tracker.applicationId} · Submitted {date(tracker.submittedAt)}</p></div><Link href="/jobs/applied" className="job-secondary-link">Back to applications</Link></header>
      {error ? <p className="candidate-application-error" role="alert">{error}</p> : null}
      <ol className="candidate-application-stage-stepper" aria-label="Application stage">
        {publicStages.map(([stage, label], index) => <li key={stage} className={index <= activeIndex ? "is-active" : undefined}><span>{index + 1}</span>{label}</li>)}
      </ol>
      {tracker.publicOutcome === "WITHDRAWN" ? <p className="candidate-application-warning" role="status">You withdrew this application. Its canonical stage remains {tracker.canonicalStage}.</p> : null}
      <div className="candidate-application-tracker-grid">
        <section className="candidate-application-panel" aria-labelledby="recent-updates-heading"><p className="workspace-kicker">Recent updates</p><h2 id="recent-updates-heading">Application timeline</h2>{tracker.updates.length ? <ol className="candidate-application-timeline">{tracker.updates.map((update) => <li key={update.id}><span aria-hidden="true" /> <div><strong>{update.title}</strong><time dateTime={update.occurredAt}>{date(update.occurredAt)}</time></div></li>)}</ol> : <p className="candidate-application-muted">No public updates yet.</p>}</section>
        <aside className="candidate-application-panel"><p className="workspace-kicker">Submitted files</p><h2>Application details</h2><ul className="candidate-application-file-list">{tracker.files.map((file) => <li key={file.versionId}><strong>{file.displayName}</strong><span>{file.mimeType} · {Math.ceil(file.byteSize / 1024)} KB</span></li>)}</ul><p className="candidate-application-muted">Private match scores, rankings, employer notes, and other candidates are not part of the candidate tracker.</p></aside>
        <aside className="candidate-application-panel"><p className="workspace-kicker">Notifications</p><h2>For this application</h2><label className="candidate-application-toggle"><input type="checkbox" checked={tracker.notificationPreference.emailEnabled} disabled={pending !== null} onChange={(event) => void setPreference("emailEnabled", event.target.checked)} /> Email</label><label className="candidate-application-toggle"><input type="checkbox" checked={tracker.notificationPreference.inAppEnabled} disabled={pending !== null} onChange={(event) => void setPreference("inAppEnabled", event.target.checked)} /> In-app notifications</label></aside>
      </div>
      {tracker.canWithdraw ? <footer className="candidate-application-withdraw"><button type="button" className="job-secondary-button" disabled={pending !== null} onClick={() => void withdraw()}>{pending === "withdraw" ? "Withdrawing…" : "Withdraw application"}</button><span>You can withdraw before the interview stage.</span></footer> : null}
    </section>
  );
}
