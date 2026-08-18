"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  Check,
  CheckCircle2,
  CircleSlash,
  Clock3,
  Copy,
  Eye,
  FileText,
  Handshake,
  ListChecks,
  LockKeyhole,
  Mail,
  MessageCircle,
  PauseCircle,
  SearchCheck,
  Send,
  ToggleLeft,
  ToggleRight,
  Undo2,
  XCircle,
} from "lucide-react";
import { mutateWithCurrentCsrf } from "@/frontend/features/authentication/client/current-csrf-proof";
import { NOTIFICATION_CHANGED_EVENT } from "@/frontend/features/notifications/client/use-notification-context-read";
import {
  applicationTrackerSchema,
  notificationPreferenceSchema,
  type ApplicationTracker,
} from "@/shared/contracts/candidate-applications";

const steps = [
  { id: 0, label: "Application submitted" },
  { id: 1, label: "Under review" },
  { id: 2, label: "Interview" },
  { id: 3, label: "Outcome" },
] as const;

const canonicalStepIndex: Record<ApplicationTracker["canonicalStage"], number> =
  {
    APPLIED: 0,
    VIEWED: 1,
    SHORTLISTED: 1,
    INTERVIEWING: 2,
    OFFERED: 2,
    HIRED: 3,
    OFFER_DECLINED: 3,
    REJECTED: 3,
    WAITLISTED: 3,
  };

function date(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function label(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function stageCopy(
  canonicalStage: ApplicationTracker["canonicalStage"],
  outcome: ApplicationTracker["publicOutcome"],
) {
  if (outcome === "WITHDRAWN") {
    return [
      "Application withdrawn",
      "You withdrew this application. The recruitment team has been notified.",
    ];
  }
  if (canonicalStage === "APPLIED") {
    return [
      "Application submitted",
      "Your application has been received and is ready for the recruiter's review.",
    ];
  }
  if (canonicalStage === "VIEWED") {
    return ["Application viewed", "The recruiter has opened your application."];
  }
  if (canonicalStage === "SHORTLISTED") {
    return [
      "Application shortlisted",
      "The recruiter is considering you for the next step.",
    ];
  }
  if (canonicalStage === "INTERVIEWING") {
    return [
      "Interview stage",
      "The recruiter has moved your application to the interview stage.",
    ];
  }
  if (canonicalStage === "OFFERED") {
    return [
      "Offer sent",
      "Review the offer and choose whether you would like to accept it.",
    ];
  }
  if (canonicalStage === "HIRED") {
    return [
      "Offer accepted",
      "Congratulations! The recruiter has marked this application as hired.",
    ];
  }
  if (canonicalStage === "OFFER_DECLINED") {
    return [
      "Offer declined",
      "You declined this offer. This application is now complete.",
    ];
  }
  if (canonicalStage === "REJECTED") {
    return [
      "Application rejected",
      "The recruiter is not moving forward with this application.",
    ];
  }
  if (canonicalStage === "WAITLISTED") {
    return [
      "Application waitlisted",
      "There is no open interview slot right now, but your application may be considered again.",
    ];
  }
  return [
    "Recruitment outcome",
    "The recruiter has published an update for this application.",
  ];
}

function updateDescription(update: ApplicationTracker["updates"][number]) {
  switch (update.canonicalStage) {
    case "APPLIED":
      return "Your application was successfully submitted.";
    case "VIEWED":
      return "The recruiter has opened your application.";
    case "SHORTLISTED":
      return "The recruiter has shortlisted your application.";
    case "INTERVIEWING":
      return "The recruiter has moved your application to the interview stage.";
    case "OFFERED":
      return "An offer has been sent and is waiting for your response.";
    case "HIRED":
      return "You accepted the offer and the application is now marked hired.";
    case "OFFER_DECLINED":
      return "You declined the offer for this application.";
    case "REJECTED":
      return "The recruiter is not moving forward with this application.";
    case "WAITLISTED":
      return "The recruiter has waitlisted your application because no interview slot is open.";
  }
  if (update.kind === "WITHDRAWN")
    return "Your application is no longer active.";
  return "The recruitment status has been updated.";
}

function updateIcon(update: ApplicationTracker["updates"][number]) {
  switch (update.canonicalStage) {
    case "VIEWED":
      return <Eye aria-hidden="true" />;
    case "SHORTLISTED":
      return <ListChecks aria-hidden="true" />;
    case "INTERVIEWING":
      return <Clock3 aria-hidden="true" />;
    case "OFFERED":
      return <Send aria-hidden="true" />;
    case "HIRED":
      return <CheckCircle2 aria-hidden="true" />;
    case "OFFER_DECLINED":
      return <CircleSlash aria-hidden="true" />;
    case "REJECTED":
      return <XCircle aria-hidden="true" />;
    case "WAITLISTED":
      return <PauseCircle aria-hidden="true" />;
    case "APPLIED":
      return <Check aria-hidden="true" />;
  }
  if (update.kind === "UNDER_REVIEW") return <SearchCheck aria-hidden="true" />;
  if (update.kind === "INTERVIEW" || update.kind === "OUTCOME")
    return <Clock3 aria-hidden="true" />;
  return <Check aria-hidden="true" />;
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
      const response = await fetch(
        `/api/candidate/applications/${encodeURIComponent(applicationId)}`,
        {
          cache: "no-store",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        },
      );
      if (!response.ok) return;
      const next = applicationTrackerSchema.parse(await response.json());
      setTracker((current) =>
        next.stageVersion >= current.stageVersion &&
        next.intake.progressPercent >= current.intake.progressPercent
          ? next
          : current,
      );
    } catch {
      // Preserve the last safe projection during a transient poll failure.
    }
  }, [applicationId]);

  useEffect(() => {
    let timer: number | undefined;
    let mounted = true;
    const schedule = () => {
      if (!mounted || document.hidden) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(async () => {
        await poll();
        schedule();
      }, 4000);
    };
    const visibility = () => {
      if (document.hidden) {
        if (timer) window.clearTimeout(timer);
        return;
      }
      if (timer) window.clearTimeout(timer);
      void poll();
      schedule();
    };
    const refreshOnNotification = () => {
      if (!document.hidden) void poll();
    };
    schedule();
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("focus", refreshOnNotification);
    window.addEventListener(NOTIFICATION_CHANGED_EVENT, refreshOnNotification);
    return () => {
      mounted = false;
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("focus", refreshOnNotification);
      window.removeEventListener(
        NOTIFICATION_CHANGED_EVENT,
        refreshOnNotification,
      );
    };
  }, [poll]);

  async function setPreference(
    field: "emailEnabled" | "inAppEnabled",
    value: boolean,
  ) {
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
            emailEnabled:
              field === "emailEnabled" ? value : current.emailEnabled,
            inAppEnabled:
              field === "inAppEnabled" ? value : current.inAppEnabled,
            expectedVersion: current.version,
          }),
        },
        csrfProof,
      );
      if (!response.ok) {
        throw new Error(
          "Notification settings could not be updated. Refresh and try again.",
        );
      }
      const preference = notificationPreferenceSchema.parse(
        await response.json(),
      );
      setTracker((currentTracker) => ({
        ...currentTracker,
        notificationPreference: preference,
      }));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Notification settings could not be updated.",
      );
    } finally {
      setPending(null);
    }
  }

  async function withdraw() {
    if (
      !tracker.canWithdraw ||
      pending ||
      !window.confirm("Withdraw this application? This cannot be undone.")
    ) {
      return;
    }
    setPending("withdraw");
    setError(null);
    try {
      const response = await mutateWithCurrentCsrf(
        `/api/candidate/applications/${encodeURIComponent(applicationId)}/withdraw`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "idempotency-key": crypto.randomUUID(),
          },
          body: JSON.stringify({
            expectedVersion: tracker.stageVersion,
            confirmed: true,
          }),
        },
        csrfProof,
      );
      if (!response.ok) {
        throw new Error(
          "This application could not be withdrawn. Refresh and try again.",
        );
      }
      await poll();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "This application could not be withdrawn.",
      );
    } finally {
      setPending(null);
    }
  }

  async function respondToOffer(decision: "ACCEPT" | "DECLINE") {
    if (tracker.canonicalStage !== "OFFERED" || pending) return;
    setPending(decision === "ACCEPT" ? "accept-offer" : "decline-offer");
    setError(null);
    try {
      const response = await mutateWithCurrentCsrf(
        `/api/candidate/applications/${encodeURIComponent(applicationId)}/offer-response`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "idempotency-key": crypto.randomUUID(),
          },
          body: JSON.stringify({
            decision,
            expectedVersion: tracker.stageVersion,
          }),
        },
        csrfProof,
      );
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!response.ok) {
        throw new Error(
          payload?.message ??
            "Your offer response could not be recorded. Refresh and try again.",
        );
      }
      await poll();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Your offer response could not be recorded.",
      );
    } finally {
      setPending(null);
    }
  }

  const isBranchOutcome =
    tracker.canonicalStage === "REJECTED" ||
    tracker.canonicalStage === "WAITLISTED";
  const transitionOriginIndex = tracker.transitionFromStage
    ? canonicalStepIndex[tracker.transitionFromStage]
    : tracker.canonicalStage === "REJECTED"
      ? 0
      : 1;
  const activeIndex =
    tracker.canonicalStage === "OFFERED"
      ? 3
      : canonicalStepIndex[tracker.canonicalStage];
  const outcomeDetail =
    tracker.canonicalStage === "OFFERED"
      ? "Awaiting response"
      : tracker.publicOutcome === "WITHDRAWN"
        ? "Withdrawn"
        : tracker.canonicalStage === "HIRED"
          ? "Hired"
          : tracker.canonicalStage === "OFFER_DECLINED"
            ? "Offer declined"
            : tracker.canonicalStage === "REJECTED"
              ? "Rejected"
              : tracker.canonicalStage === "WAITLISTED"
                ? "Waitlisted"
                : "Not started";
  const [headline, description] = stageCopy(
    tracker.canonicalStage,
    tracker.publicOutcome,
  );

  return (
    <main
      className="application-ui application-ui--tracker"
      aria-labelledby="application-tracker-title"
    >
      <header className="application-ui__header">
        <div>
          <nav className="application-ui__breadcrumb" aria-label="Breadcrumb">
            <Link href="/jobs/applied">Applications</Link>
            <span>/</span>
            <span>{tracker.job.title}</span>
          </nav>
          <h1 id="application-tracker-title">My application</h1>
          <p>Follow official updates from the recruiter.</p>
        </div>
        <Link
          className="application-ui-button application-ui-button--secondary"
          href="/support"
        >
          <MessageCircle aria-hidden="true" />
          Contact support
        </Link>
      </header>

      {error ? (
        <p
          className="application-ui-alert application-ui-alert--error"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <section
        className="application-ui-status-hero"
        aria-labelledby="current-status-title"
      >
        <span className="application-ui-status-hero__icon">
          {tracker.publicOutcome === "WITHDRAWN" ? (
            <Clock3 aria-hidden="true" />
          ) : (
            <SearchCheck aria-hidden="true" />
          )}
        </span>
        <div>
          <span>CURRENT STATUS</span>
          <h2 id="current-status-title">{headline}</h2>
          <p>{description}</p>
        </div>
        <aside aria-label="Latest application update">
          <small>Latest update</small>
          <strong>{date(tracker.lastUpdatedAt)}</strong>
          <code>{applicationId}</code>
        </aside>
      </section>

      <section
        className="application-ui-card application-ui-progress-card"
        aria-labelledby="recruitment-progress-title"
      >
        <h2 id="recruitment-progress-title">Recruitment progress</h2>
        <ol className="application-ui-stage-progress">
          {steps.map((step, index) => {
            const skipped =
              isBranchOutcome && index > transitionOriginIndex && index < 3;
            const complete =
              !skipped &&
              (isBranchOutcome
                ? index <= transitionOriginIndex
                : index < activeIndex);
            const active = !skipped && index === activeIndex;
            const detail = skipped
              ? "Skipped"
              : index === 1 &&
                  (tracker.canonicalStage === "VIEWED" ||
                    tracker.canonicalStage === "SHORTLISTED" ||
                    (isBranchOutcome && transitionOriginIndex === 1))
                ? tracker.canonicalStage === "VIEWED" ||
                  (isBranchOutcome && tracker.transitionFromStage === "VIEWED")
                  ? "Viewed"
                  : "Shortlisted"
                : index === 2 &&
                    (tracker.canonicalStage === "INTERVIEWING" ||
                      (isBranchOutcome &&
                        tracker.transitionFromStage === "INTERVIEWING"))
                  ? "Interviewing"
                  : index === 3
                    ? outcomeDetail
                    : complete
                      ? "Complete"
                      : active
                        ? "Current"
                        : "Not started";
            return (
              <li
                key={step.id}
                className={
                  [
                    complete && "is-complete",
                    active && "is-active",
                    skipped && "is-skipped",
                  ]
                    .filter(Boolean)
                    .join(" ") || undefined
                }
                data-step-state={
                  skipped
                    ? "skipped"
                    : active
                      ? "active"
                      : complete
                        ? "complete"
                        : "upcoming"
                }
              >
                <span>
                  {complete ? <Check aria-hidden="true" /> : index + 1}
                </span>
                <strong>{step.label}</strong>
                <small>{detail}</small>
              </li>
            );
          })}
        </ol>
      </section>

      {tracker.canonicalStage === "OFFERED" ? (
        <section
          className="application-ui-offer-response"
          aria-labelledby="offer-response-title"
          role="status"
        >
          <div className="application-ui-offer-response__badge">
            <Send aria-hidden="true" />
            <span>OFFER SENT</span>
          </div>
          <div className="application-ui-offer-response__copy">
            <h2 id="offer-response-title">You have received an offer</h2>
            <p>
              Review the offer details shared by the recruiter and let them know
              your decision.
            </p>
          </div>
          <div className="application-ui-offer-response__actions">
            <button
              type="button"
              className="application-ui-button application-ui-button--primary"
              disabled={pending !== null}
              onClick={() => void respondToOffer("ACCEPT")}
            >
              <Handshake aria-hidden="true" />
              {pending === "accept-offer" ? "Accepting…" : "Accept offer"}
            </button>
            <button
              type="button"
              className="application-ui-button application-ui-button--secondary"
              disabled={pending !== null}
              onClick={() => void respondToOffer("DECLINE")}
            >
              <CircleSlash aria-hidden="true" />
              {pending === "decline-offer" ? "Declining…" : "Decline offer"}
            </button>
          </div>
        </section>
      ) : null}

      <div className="application-ui__columns">
        <div className="application-ui__main">
          <section
            className="application-ui-card"
            aria-labelledby="recent-updates-title"
          >
            <h2 id="recent-updates-title">Recent updates</h2>
            {tracker.updates.length ? (
              <ol className="application-ui-timeline">
                {[...tracker.updates].reverse().map((update, index) => (
                  <li
                    key={update.id}
                    className={index === 0 ? "is-highlighted" : undefined}
                  >
                    <span
                      className={
                        update.canonicalStage === "APPLIED"
                          ? "is-complete"
                          : undefined
                      }
                    >
                      {updateIcon(update)}
                    </span>
                    <div>
                      <strong>{update.title}</strong>
                      <p>{updateDescription(update)}</p>
                    </div>
                    <time dateTime={update.occurredAt}>
                      {date(update.occurredAt)}
                    </time>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="application-ui-muted">No public updates yet.</p>
            )}
          </section>

          <section
            id="submitted-files"
            className="application-ui-card"
            aria-labelledby="submitted-files-title"
          >
            <div className="application-ui-card__heading">
              <h2 id="submitted-files-title">Submitted files</h2>
              <span className="application-ui-lock">
                <LockKeyhole aria-hidden="true" />
                Version locked
              </span>
            </div>
            <ul className="application-ui-file-list">
              {tracker.files.map((file) => (
                <li key={file.versionId}>
                  <span className="application-ui-file-icon">
                    <FileText aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{file.displayName}</strong>
                  </span>
                  <button
                    className="application-ui-file-action"
                    type="button"
                    disabled
                    aria-label={`View unavailable for ${file.displayName}`}
                  >
                    View unavailable
                  </button>
                </li>
              ))}
            </ul>
            <div className="application-ui-disclosure application-ui-disclosure--compact">
              <LockKeyhole aria-hidden="true" />
              <p>
                <strong>Screening status: Completed.</strong> Match scores, AI
                scores, rankings, and internal recruiter notes remain private.
              </p>
            </div>
          </section>
        </div>

        <aside className="application-ui__sidebar">
          <section className="application-ui-card application-ui-job-card">
            <span className="application-ui-job-card__eyebrow">
              APPLICATION
            </span>
            <h2>{tracker.job.title}</h2>
            <p>{tracker.job.companyName}</p>
            <small>
              {tracker.job.location} · {label(tracker.job.workArrangement)}
            </small>
            <div className="application-ui-tags">
              <span>{label(tracker.job.employmentType)}</span>
              <span>{label(tracker.job.experienceLevel)}</span>
            </div>
            <div className="application-ui-job-info">
              <div>
                <span>Submitted</span>
                <time dateTime={tracker.submittedAt}>
                  {date(tracker.submittedAt)}
                </time>
              </div>
              <div>
                <span>Application ID</span>
                <code>{applicationId}</code>
              </div>
            </div>
          </section>

          <section
            className="application-ui-card"
            aria-labelledby="status-notifications-title"
          >
            <h2 id="status-notifications-title">Status notifications</h2>
            <button
              type="button"
              className="application-ui-toggle"
              disabled={pending !== null}
              aria-pressed={tracker.notificationPreference.emailEnabled}
              onClick={() =>
                void setPreference(
                  "emailEnabled",
                  !tracker.notificationPreference.emailEnabled,
                )
              }
            >
              <span className="application-ui-toggle__content">
                <Mail aria-hidden="true" />
                <span>
                  <strong>Email</strong>
                  <small>
                    {tracker.notificationPreference.emailEnabled
                      ? "Enabled"
                      : "Disabled"}
                  </small>
                </span>
              </span>
              {tracker.notificationPreference.emailEnabled ? (
                <ToggleRight aria-hidden="true" />
              ) : (
                <ToggleLeft aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              className="application-ui-toggle"
              disabled={pending !== null}
              aria-pressed={tracker.notificationPreference.inAppEnabled}
              onClick={() =>
                void setPreference(
                  "inAppEnabled",
                  !tracker.notificationPreference.inAppEnabled,
                )
              }
            >
              <span className="application-ui-toggle__content">
                <Bell aria-hidden="true" />
                <span>
                  <strong>In-app notifications</strong>
                  <small>
                    {tracker.notificationPreference.inAppEnabled
                      ? "Enabled"
                      : "Disabled"}
                  </small>
                </span>
              </span>
              {tracker.notificationPreference.inAppEnabled ? (
                <ToggleRight aria-hidden="true" />
              ) : (
                <ToggleLeft aria-hidden="true" />
              )}
            </button>
          </section>

          <div className="application-ui-actions-stack">
            <Link
              className="application-ui-button application-ui-button--primary"
              href={`/jobs/applied/${encodeURIComponent(applicationId)}/submitted`}
            >
              <Copy aria-hidden="true" />
              View submitted application
            </Link>
            {tracker.canWithdraw ? (
              <button
                type="button"
                className="application-ui-button application-ui-button--secondary"
                disabled={pending !== null}
                onClick={() => void withdraw()}
              >
                <Undo2 aria-hidden="true" />
                {pending === "withdraw"
                  ? "Withdrawing…"
                  : "Withdraw application"}
              </button>
            ) : (
              <p className="application-ui-withdraw-note">
                Withdrawal is no longer available once an application reaches
                the interview stage.
              </p>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
