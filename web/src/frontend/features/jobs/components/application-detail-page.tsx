"use client";

import Link from "next/link";
import {
  type CandidateApplicationDetail,
} from "@/shared/contracts/jobs/applications";
import { ApplicationStageBadge } from "./application-stage-badge";
import { useNotificationContextRead } from "@/frontend/features/notifications/client/use-notification-context-read";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { applicationCopy } from "@/frontend/features/candidate-applications/i18n/application-copy";

function formatDateTime(value: string, locale: "vi" | "en") {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en", {
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
  const locale = useWorkspaceLocale();
  const copy = applicationCopy(locale);
  const detailCopy = copy.applicationDetail;
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
        <span aria-hidden="true">←</span> {detailCopy.backToApplications}
      </Link>

      <header className="application-detail-hero">
        <div>
          <p className="workspace-kicker">{application.companyName}</p>
          <h1 id="application-detail-title">{application.jobTitle}</h1>
          <p>
            {application.location} · {detailCopy.applied(
              formatDateTime(application.submittedAt, locale),
            )}
          </p>
        </div>
        <ApplicationStageBadge stage={application.stage} />
      </header>

      {!application.jobAvailable ? (
        <div className="application-detail-alert" role="status">
          {detailCopy.unavailable}
        </div>
      ) : null}

      <div className="application-detail-grid">
        <section
          className="application-detail-panel"
          aria-labelledby="application-history-title"
        >
          <div className="application-panel-heading">
            <div>
              <p className="workspace-kicker">{detailCopy.currentProgress}</p>
              <h2 id="application-history-title">{detailCopy.timeline}</h2>
            </div>
            <p>{copy.stageNextStep[application.stage]}</p>
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
                    <strong>{copy.applicationsList.statuses[event.toStage]}</strong>
                    <time dateTime={event.occurredAt}>
                      {formatDateTime(event.occurredAt, locale)}
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
          <p className="workspace-kicker">{detailCopy.submittedApplication}</p>
          <h2>{detailCopy.details}</h2>
          <Link
            className="application-detail-back"
            href={`/jobs/applied/${encodeURIComponent(application.applicationId)}/messages`}
          >
            {detailCopy.recruitmentMessages}
          </Link>
          <dl>
            <div>
              <dt>{detailCopy.applicationId}</dt>
              <dd>{application.applicationId}</dd>
            </div>
            <div>
              <dt>{detailCopy.cv}</dt>
              <dd>{application.cv.displayName}</dd>
            </div>
            <div>
              <dt>{detailCopy.lastUpdated}</dt>
              <dd>{formatDateTime(application.lastStageChangedAt, locale)}</dd>
            </div>
          </dl>
          {application.coverLetter ? (
            <div className="application-submitted-copy">
              <h3>{detailCopy.coverLetter}</h3>
              <p>{application.coverLetter}</p>
            </div>
          ) : null}
          {application.answers.length ? (
            <div className="application-submitted-copy">
              <h3>{detailCopy.screeningAnswers}</h3>
              {application.answers.map((answer) => (
                <div key={answer.question}>
                  <strong>{answer.question}</strong>
                  <p>
                    {typeof answer.answer === "boolean"
                      ? answer.answer
                        ? detailCopy.yes
                        : detailCopy.no
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
