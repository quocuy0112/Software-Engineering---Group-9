"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import type { SubmittedCandidate } from "@/shared/contracts/applications";
import { useSubmittedCandidates } from "./use-submitted-candidates";
import { ApplicationDocumentViewer } from "./application-document-viewer";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { recruiterApplicationsCopy } from "./recruiter-applications-copy";

function formatDate(value: string, locale: "vi" | "en") {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function DocumentActions({
  candidate,
  jobId,
  onView,
  copy,
}: {
  candidate: SubmittedCandidate;
  jobId: string;
  onView: (kind: "cv" | "cover-letter", fileName?: string | null) => void;
  copy: ReturnType<typeof recruiterApplicationsCopy>["submitted"];
}) {
  return (
    <div className="submitted-candidate-document-actions">
      <button
        type="button"
        onClick={() => onView("cv")}
        disabled={!candidate.cv.available}
        aria-label={`${copy.viewCv} ${candidate.candidate.displayName}`}
      >
        {copy.viewCv}
      </button>
      <a
        href={`/api/recruiter/jobs/${encodeURIComponent(jobId)}/applications/${encodeURIComponent(candidate.applicationId)}/documents/cv/download`}
        download
        aria-label={`${copy.downloadCv} ${candidate.candidate.displayName}`}
      >
        {copy.downloadCv}
      </a>
      {candidate.coverLetter.kind === "NONE" ? (
        <span aria-label={copy.coverLetterMissing}>
          {copy.coverLetterMissing}
        </span>
      ) : (
        <>
          <button
            type="button"
            onClick={() => onView("cover-letter")}
            aria-label={`${copy.viewCoverLetter} ${candidate.candidate.displayName}`}
          >
            {copy.viewCoverLetter}
          </button>
          {candidate.coverLetter.kind !== "TEXT" ? (
            <a
              href={`/api/recruiter/jobs/${encodeURIComponent(jobId)}/applications/${encodeURIComponent(candidate.applicationId)}/documents/cover-letter/download`}
              download
              aria-label={`${copy.downloadCoverLetter} ${candidate.candidate.displayName}`}
            >
              {copy.downloadCoverLetter}
            </a>
          ) : null}
        </>
      )}
    </div>
  );
}

export function SubmittedCandidatesList({
  jobId,
  jobTitle,
  onBack,
}: {
  jobId: string;
  jobTitle: string;
  onBack?: () => void;
}) {
  const locale = useWorkspaceLocale();
  const recruiterCopy = recruiterApplicationsCopy(locale);
  const copy = recruiterCopy.submitted;
  const pipelineCopy = recruiterCopy.pipeline;
  const {
    items,
    nextCursor,
    loading,
    loadingMore,
    refreshing,
    error,
    retry,
    refresh,
    loadMore,
  } = useSubmittedCandidates(jobId, locale);
  const [viewer, setViewer] = useState<{
    applicationId: string;
    kind: "cv" | "cover-letter";
    fileName?: string | null;
  } | null>(null);

  return (
    <section
      className="submitted-candidates"
      aria-labelledby="submitted-candidates-title"
    >
      {onBack ? (
        <button type="button" onClick={onBack}>
          {copy.back}
        </button>
      ) : null}
      <div className="submitted-candidates__header">
        <div>
          <p className="recruiter-eyebrow">{copy.eyebrow}</p>
          <h1 id="submitted-candidates-title">{jobTitle}</h1>
          <p>{copy.description}</p>
        </div>
        <button
          type="button"
          className="submitted-candidates__refresh-button"
          onClick={refresh}
          disabled={loading || refreshing}
        >
          <RefreshCw
            aria-hidden="true"
            className={refreshing ? "is-spinning" : undefined}
          />
          {refreshing ? copy.refreshing : copy.refresh}
        </button>
      </div>
      <div aria-live="polite" aria-busy={loading || loadingMore || refreshing}>
        {loading ? <p role="status">{copy.loading}</p> : null}
        {refreshing ? <p role="status">{copy.updating}</p> : null}
        {error ? (
          <div role="alert">
            <p>{copy.loadError}</p>
            <button type="button" onClick={retry}>
              {copy.retry}
            </button>
          </div>
        ) : null}
        {!loading && items.length === 0 && !error ? <p>{copy.empty}</p> : null}
        {!loading && items.length > 0 ? (
          <div
            className="submitted-candidates-table"
            role="list"
            aria-label={copy.list}
          >
            {items.map((candidate) => (
              <article
                key={candidate.applicationId}
                role="listitem"
                className="submitted-candidate-row"
              >
                <div>
                  <strong>{candidate.candidate.displayName}</strong>
                  <span>{candidate.candidate.verifiedEmail}</span>
                  {candidate.candidate.sharedPhone ? (
                    <span>{candidate.candidate.sharedPhone}</span>
                  ) : null}
                </div>
                <div>
                  <span>
                    {copy.applied(formatDate(candidate.submittedAt, locale))}
                  </span>
                  <span>
                    {pipelineCopy.stageLabels[
                      candidate.stage as keyof typeof pipelineCopy.stageLabels
                    ] ?? pipelineCopy.unknownStage}
                  </span>
                </div>
                <DocumentActions
                  candidate={candidate}
                  jobId={jobId}
                  onView={(kind, fileName) =>
                    setViewer({
                      applicationId: candidate.applicationId,
                      kind,
                      fileName,
                    })
                  }
                  copy={copy}
                />
              </article>
            ))}
          </div>
        ) : null}
      </div>
      {nextCursor ? (
        <button type="button" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? copy.loadingMore : copy.loadMore}
        </button>
      ) : null}
      {viewer ? (
        <ApplicationDocumentViewer
          jobId={jobId}
          applicationId={viewer.applicationId}
          kind={viewer.kind}
          fileName={viewer.fileName}
          onClose={() => setViewer(null)}
        />
      ) : null}
    </section>
  );
}
