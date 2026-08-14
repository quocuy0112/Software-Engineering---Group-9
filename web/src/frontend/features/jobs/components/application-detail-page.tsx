"use client";

import Link from "next/link";
import {
  applicationStageLabel,
  applicationStageNextStep,
  type CandidateApplicationDetail,
} from "@/shared/contracts/jobs/applications";
import { ApplicationStageBadge } from "./application-stage-badge";
import { useNotificationContextRead } from "@/frontend/features/notifications/client/use-notification-context-read";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ApplicationDetailPage({
  application,
  csrfProof,
}: {
  application: CandidateApplicationDetail;
  csrfProof: string;
}) {
  useNotificationContextRead({
    enabled: true,
    contextType: "APPLICATION",
    contextId: application.applicationId,
    csrfProof,
  });
  return (
    <section
      className="application-detail"
      aria-labelledby="application-detail-title"
    >
      <Link className="application-detail-back" href="/jobs/applied">
        <span aria-hidden="true">←</span> Back to applications
      </Link>

      <header className="application-detail-hero">
        <div>
          <p className="workspace-kicker">{application.companyName}</p>
          <h1 id="application-detail-title">{application.jobTitle}</h1>
          <p>
            {application.location} · Applied{" "}
            {formatDateTime(application.submittedAt)}
          </p>
        </div>
        <ApplicationStageBadge stage={application.stage} />
      </header>

      {!application.jobAvailable ? (
        <div className="application-detail-alert" role="status">
          This job is no longer publicly available. Your application and its
          history are still available here.
        </div>
      ) : null}

      <div className="application-detail-grid">
        <section
          className="application-detail-panel"
          aria-labelledby="application-history-title"
        >
          <div className="application-panel-heading">
            <div>
              <p className="workspace-kicker">Current progress</p>
              <h2 id="application-history-title">Application timeline</h2>
            </div>
            <p>{applicationStageNextStep[application.stage]}</p>
          </div>
          <ol className="application-timeline">
            {application.history.map((event) => (
              <li key={event.eventId}>
                <span
                  className="application-timeline-marker"
                  aria-hidden="true"
                />
                <div>
                  <div>
                    <strong>{applicationStageLabel[event.toStage]}</strong>
                    <time dateTime={event.occurredAt}>
                      {formatDateTime(event.occurredAt)}
                    </time>
                  </div>
                  {event.candidateVisibleReason ? (
                    <p>{event.candidateVisibleReason}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <aside className="application-detail-panel application-submission-summary">
          <p className="workspace-kicker">Submitted application</p>
          <h2>Application details</h2>
          <dl>
            <div>
              <dt>Application ID</dt>
              <dd>{application.applicationId}</dd>
            </div>
            <div>
              <dt>CV</dt>
              <dd>{application.cv.displayName}</dd>
            </div>
            <div>
              <dt>Last updated</dt>
              <dd>{formatDateTime(application.lastStageChangedAt)}</dd>
            </div>
          </dl>
          {application.coverLetter ? (
            <div className="application-submitted-copy">
              <h3>Cover letter</h3>
              <p>{application.coverLetter}</p>
            </div>
          ) : null}
          {application.answers.length ? (
            <div className="application-submitted-copy">
              <h3>Screening answers</h3>
              {application.answers.map((answer) => (
                <div key={answer.question}>
                  <strong>{answer.question}</strong>
                  <p>
                    {typeof answer.answer === "boolean"
                      ? answer.answer
                        ? "Yes"
                        : "No"
                      : answer.answer}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
