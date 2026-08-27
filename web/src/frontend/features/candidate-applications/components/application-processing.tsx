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
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import {
  applicationTrackerSchema,
  type ApplicationTracker,
} from "@/shared/contracts/candidate-applications";
import {
  applicationCopy,
  applicationErrorMessage,
} from "../i18n/application-copy";

function date(value: string | null, locale: "vi" | "en") {
  return value
    ? new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : null;
}

function size(bytes: number) {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function stepDetail(
  code: string,
  copy: ReturnType<typeof applicationCopy>["processing"],
) {
  return code === "APPLICATION_RECEIVED"
    ? copy.applicationReceived
    : code === "CHECKING_FILES"
      ? copy.checkingFiles
      : copy.sendToRecruiter;
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
  const locale = useWorkspaceLocale();
  const copy = applicationCopy(locale).processing;
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
      if (!response.ok) throw new Error(copy.retryError);
      setTracker(applicationTrackerSchema.parse(await response.json()));
    } catch (caught) {
      setError(applicationErrorMessage(locale, caught, copy.retryError));
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
          <nav
            className="application-ui__breadcrumb"
            aria-label={copy.breadcrumb}
          >
            <Link href="/jobs/applied">{copy.applications}</Link>
            <span>/</span>
            <span>{tracker.job.title}</span>
            <span>/</span>
            <span>{copy.processingStatus}</span>
          </nav>
          <h1 id="processing-title">
            {isComplete
              ? copy.readyTitle
              : needsAttention
                ? copy.attentionTitle
                : copy.processingTitle}
          </h1>
          <p>
            {isComplete
              ? copy.readyDescription
              : needsAttention
                ? copy.attentionDescription
                : copy.processingDescription}
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
              ? copy.complete
              : needsAttention
                ? copy.actionRequired
                : copy.processing}
          </span>
          <h2>
            {isComplete
              ? copy.sentTitle
              : needsAttention
                ? copy.retryCheckTitle
                : copy.checkingTitle}
          </h2>
          <p>
            {isComplete
              ? copy.sentDescription
              : needsAttention
                ? copy.retryCheckDescription
                : copy.checkingDescription}
          </p>
          <div
            className="application-ui-progress"
            role="progressbar"
            aria-label={copy.progressAria}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={tracker.intake.progressPercent}
          >
            <i style={{ width: `${tracker.intake.progressPercent}%` }} />
          </div>
          <strong>
            {copy.completePercent(tracker.intake.progressPercent)}
          </strong>
          <small>
            {isComplete
              ? copy.fileChecksCompleted
              : needsAttention
                ? copy.retryToContinue
                : copy.usuallyUnderMinute}
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
            <h2>{copy.intakeProgress}</h2>
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
                    ? copy.stepProcessing
                    : step.status === "PENDING"
                      ? copy.stepNext
                      : step.status === "ATTENTION_REQUIRED"
                        ? copy.needsAttention
                        : (date(step.timestamp, locale) ?? copy.stepComplete);
                return (
                  <li
                    key={step.code}
                    className={`is-${step.status.toLowerCase()}`}
                  >
                    <span>{icon}</span>
                    <div>
                      <strong>
                        {step.code === "APPLICATION_RECEIVED"
                          ? copy.applicationReceived
                          : step.code === "CHECKING_FILES"
                            ? copy.checkingFiles
                            : copy.sendToRecruiter}
                      </strong>
                      <p>{stepDetail(step.code, copy)}</p>
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
                {retrying ? copy.retrying : copy.retryFileChecks}
              </button>
            ) : null}
          </section>

          <section className="application-ui-card">
            <h2>{copy.receivedFiles}</h2>
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
                  <em>{copy.received}</em>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="application-ui__sidebar">
          <section className="application-ui-card">
            <span className="application-ui-eyebrow">
              {copy.applicationEyebrow}
            </span>
            <h2>{tracker.job.title}</h2>
            <p>{tracker.job.companyName}</p>
            <code>
              {copy.applicationId}: {tracker.applicationId}
            </code>
            <small>
              {copy.submitted}{" "}
              {new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(tracker.submittedAt))}
            </small>
          </section>
          <section className="application-ui-card">
            <h2>{copy.whatYouWillSee}</h2>
            <ul className="application-ui-icon-list">
              <li>
                <Eye aria-hidden="true" />
                {copy.receiptStatus}
              </li>
              <li>
                <Eye aria-hidden="true" />
                {copy.recruitmentStages}
              </li>
              <li>
                <Eye aria-hidden="true" />
                {copy.recruiterRequests}
              </li>
            </ul>
          </section>
          <section className="application-ui-private-note">
            <TriangleAlert aria-hidden="true" />
            <div>
              <strong>{copy.internalNotShown}</strong>
              <p>{copy.privateDescription}</p>
              <small>{copy.finalDecision}</small>
            </div>
          </section>
        </aside>
      </div>

      <div className="application-ui-confirm-strip">
        <CheckCircle2 aria-hidden="true" />
        {isComplete
          ? copy.completeNotice
          : needsAttention
            ? copy.attentionNotice
            : copy.processingNotice}
      </div>
      <Link
        className="application-ui-button application-ui-button--primary application-ui-button--wide"
        href={`/jobs/applied/${encodeURIComponent(applicationId)}`}
      >
        {copy.viewApplicationStatus} <ArrowRight aria-hidden="true" />
      </Link>
    </main>
  );
}
