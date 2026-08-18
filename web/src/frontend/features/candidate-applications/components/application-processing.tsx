"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";
import { mutateWithCurrentCsrf } from "@/frontend/features/authentication/client/current-csrf-proof";
import {
  applicationTrackerSchema,
  type ApplicationTracker,
} from "@/shared/contracts/candidate-applications";

function date(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : null;
}

function size(bytes: number) {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function stepDetail(code: string) {
  return code === "APPLICATION_RECEIVED"
    ? "Your application has been received."
    : code === "CHECKING_FILES"
      ? "We are checking readability and standardizing your files."
      : "Your application will be available to the recruiter.";
}

function isIntakeProcessing(state: ApplicationTracker["intake"]["state"]) {
  return state === "RECEIVED" || state === "CHECKING_FILES";
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
  const isComplete = tracker.intake.state === "SENT_TO_RECRUITER";
  const needsAttention = tracker.intake.state === "ATTENTION_REQUIRED";
  const isProcessing = isIntakeProcessing(tracker.intake.state);

  const poll = useCallback(async (): Promise<ApplicationTracker | null> => {
    try {
      const response = await fetch(
        `/api/candidate/applications/${encodeURIComponent(applicationId)}`,
        {
          cache: "no-store",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        },
      );
      if (!response.ok) return null;

      const next = applicationTrackerSchema.parse(await response.json());
      setTracker((current) =>
        next.intake.progressPercent >= current.intake.progressPercent
          ? next
          : current,
      );
      return next;
    } catch {
      // Keep the last persisted state during a transient poll failure.
      return null;
    }
  }, [applicationId]);

  useEffect(() => {
    if (!isProcessing) return;

    let timer: number | undefined;
    let mounted = true;
    const schedule = () => {
      if (!mounted || document.hidden || timer !== undefined) return;
      timer = window.setTimeout(async () => {
        timer = undefined;
        const next = await poll();
        if (!mounted) return;
        // A terminal response must not schedule another request. The effect
        // also cleans up when the rendered state changes to complete.
        if (!next || isIntakeProcessing(next.intake.state)) schedule();
      }, 4000);
    };
    const visibility = () => {
      if (document.hidden) {
        if (timer !== undefined) {
          window.clearTimeout(timer);
          timer = undefined;
        }
      } else {
        schedule();
      }
    };

    schedule();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      mounted = false;
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [isProcessing, poll]);

  async function retry() {
    setRetrying(true);
    setError(null);
    try {
      const response = await mutateWithCurrentCsrf(
        `/api/candidate/applications/${encodeURIComponent(applicationId)}/processing/retry`,
        { method: "POST" },
        csrfProof,
      );
      if (!response.ok)
        throw new Error("The intake check could not be retried.");
      setTracker(applicationTrackerSchema.parse(await response.json()));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The intake check could not be retried.",
      );
    } finally {
      setRetrying(false);
    }
  }

  const heroClassName = [
    "application-ui-processing-hero",
    isComplete ? "is-complete" : null,
    needsAttention ? "is-attention-required" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main className="application-ui" aria-labelledby="processing-title">
      <header className="application-ui__header">
        <div>
          <nav className="application-ui__breadcrumb" aria-label="Breadcrumb">
            <Link href="/jobs/applied">Applications</Link>
            <span>/</span>
            <span>{tracker.job.title}</span>
            <span>/</span>
            <span>Processing status</span>
          </nav>
          <h1 id="processing-title">
            {isComplete
              ? "Your application is ready for review"
              : needsAttention
                ? "Your application needs attention"
                : "Your application is being processed"}
          </h1>
          <p>
            {isComplete
              ? "Your files have been checked and your application is available to the recruiter."
              : needsAttention
                ? "We could not finish checking the submitted files. You can retry the file check below."
                : "Your application has been received. You can leave this page and return later."}
          </p>
        </div>
      </header>

      <section className={heroClassName} aria-live="polite">
        <span className="application-ui-processing-hero__icon">
          {isComplete ? (
            <CheckCircle2 aria-hidden="true" />
          ) : needsAttention ? (
            <TriangleAlert aria-hidden="true" />
          ) : (
            <LoaderCircle aria-hidden="true" />
          )}
        </span>
        <div>
          <span>
            {isComplete
              ? "COMPLETE"
              : needsAttention
                ? "ACTION REQUIRED"
                : "PROCESSING"}
          </span>
          <h2>
            {isComplete
              ? "Your application has been sent to the recruiter"
              : needsAttention
                ? "The system needs another file check"
                : "The system is checking the submitted files"}
          </h2>
          <p>
            {isComplete
              ? "All submitted files passed the readability and standardization check."
              : needsAttention
                ? "The application is safe, but the file check needs to be retried."
                : "This is a file-readability and standardization check, not a self-scoring step."}
          </p>
          <div
            className="application-ui-progress"
            role="progressbar"
            aria-label="Application intake progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={tracker.intake.progressPercent}
          >
            <i style={{ width: `${tracker.intake.progressPercent}%` }} />
          </div>
          <strong>{tracker.intake.progressPercent}% complete</strong>
          <small>
            {isComplete
              ? "File checks completed"
              : needsAttention
                ? "Retry the check to continue"
                : "Usually completed in under 1 minute"}
          </small>
        </div>
      </section>

      {error ? (
        <p
          className="application-ui-alert application-ui-alert--error"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="application-ui__columns">
        <div className="application-ui__main">
          <section className="application-ui-card">
            <h2>Application intake progress</h2>
            <ol className="application-ui-intake-list">
              {tracker.intake.steps.map((step) => {
                const icon =
                  step.status === "COMPLETE" ? (
                    <Check aria-hidden="true" />
                  ) : step.status === "ACTIVE" ? (
                    <LoaderCircle aria-hidden="true" />
                  ) : step.status === "ATTENTION_REQUIRED" ? (
                    <TriangleAlert aria-hidden="true" />
                  ) : (
                    <Clock3 aria-hidden="true" />
                  );
                const statusLabel =
                  step.status === "ACTIVE"
                    ? "Processing"
                    : step.status === "PENDING"
                      ? "Next"
                      : step.status === "ATTENTION_REQUIRED"
                        ? "Needs attention"
                        : (date(step.timestamp) ?? "Complete");
                return (
                  <li
                    key={step.code}
                    className={`is-${step.status.toLowerCase()}`}
                  >
                    <span>{icon}</span>
                    <div>
                      <strong>
                        {step.code === "APPLICATION_RECEIVED"
                          ? "Application received"
                          : step.code === "CHECKING_FILES"
                            ? "Checking files"
                            : "Send to recruiter"}
                      </strong>
                      <p>{stepDetail(step.code)}</p>
                    </div>
                    <small>{statusLabel}</small>
                  </li>
                );
              })}
            </ol>
            {needsAttention ? (
              <button
                type="button"
                className="application-ui-button application-ui-button--secondary"
                onClick={() => void retry()}
                disabled={retrying}
              >
                <TriangleAlert aria-hidden="true" />
                {retrying ? "Retrying…" : "Retry file checks"}
              </button>
            ) : null}
          </section>

          <section className="application-ui-card">
            <h2>Received files</h2>
            <ul className="application-ui-file-list">
              {tracker.files.map((file) => (
                <li key={file.versionId}>
                  <span className="application-ui-file-icon">
                    <FileText aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{file.displayName}</strong>
                    <small>{size(file.byteSize)}</small>
                  </span>
                  <em>Received</em>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="application-ui__sidebar">
          <section className="application-ui-card">
            <span className="application-ui-eyebrow">APPLICATION</span>
            <h2>{tracker.job.title}</h2>
            <p>{tracker.job.companyName}</p>
            <code>Application ID: {tracker.applicationId}</code>
            <small>
              Submitted{" "}
              {new Intl.DateTimeFormat("en", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(tracker.submittedAt))}
            </small>
          </section>
          <section className="application-ui-card">
            <h2>What you will see</h2>
            <ul className="application-ui-icon-list">
              <li>
                <Eye aria-hidden="true" />
                Application receipt status
              </li>
              <li>
                <Eye aria-hidden="true" />
                Main stages of the recruitment process
              </li>
              <li>
                <Eye aria-hidden="true" />
                Requests for more information from the recruiter
              </li>
            </ul>
          </section>
          <section className="application-ui-private-note">
            <TriangleAlert aria-hidden="true" />
            <div>
              <strong>Internal information is not shown</strong>
              <p>
                Match scores, AI scores, rankings, and recruiter notes are not
                shown in the candidate portal.
              </p>
              <small>
                The recruiter always makes the final hiring decision.
              </small>
            </div>
          </section>
        </aside>
      </div>

      <div className="application-ui-confirm-strip">
        <CheckCircle2 aria-hidden="true" />
        {isComplete
          ? "Your application is now available to the recruiter."
          : needsAttention
            ? "Your application is saved while the file check is retried."
            : "You do not need to keep this page open. We will notify you when the status changes."}
      </div>
      <Link
        className="application-ui-button application-ui-button--primary application-ui-button--wide"
        href={`/jobs/applied/${encodeURIComponent(applicationId)}`}
      >
        View application status <ArrowRight aria-hidden="true" />
      </Link>
    </main>
  );
}
