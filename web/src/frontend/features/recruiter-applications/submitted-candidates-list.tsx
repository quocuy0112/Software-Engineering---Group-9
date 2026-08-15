"use client";

import { useState } from "react";
import type { SubmittedCandidate } from "@/shared/contracts/applications";
import { useSubmittedCandidates } from "./use-submitted-candidates";
import { ApplicationDocumentViewer } from "./application-document-viewer";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function DocumentActions({
  candidate,
  jobId,
  onView,
}: {
  candidate: SubmittedCandidate;
  jobId: string;
  onView: (kind: "cv" | "cover-letter", fileName?: string | null) => void;
}) {
  return (
    <div className="submitted-candidate-document-actions">
      <button
        type="button"
        onClick={() => onView("cv")}
        disabled={!candidate.cv.available}
        aria-label={`View CV for ${candidate.candidate.displayName}`}
      >
        View CV
      </button>
      <a
        href={`/api/recruiter/jobs/${encodeURIComponent(jobId)}/applications/${encodeURIComponent(candidate.applicationId)}/documents/cv/download`}
        download
        aria-label={`Download CV for ${candidate.candidate.displayName}`}
      >
        Download CV
      </a>
      {candidate.coverLetter.kind === "NONE" ? (
        <span aria-label="Cover letter not provided">Not provided</span>
      ) : (
        <>
          <button
            type="button"
            onClick={() => onView("cover-letter")}
            aria-label={`View cover letter for ${candidate.candidate.displayName}`}
          >
            View cover letter
          </button>
          {candidate.coverLetter.kind !== "TEXT" ? (
            <a
              href={`/api/recruiter/jobs/${encodeURIComponent(jobId)}/applications/${encodeURIComponent(candidate.applicationId)}/documents/cover-letter/download`}
              download
              aria-label={`Download cover letter for ${candidate.candidate.displayName}`}
            >
              Download cover letter
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
  const { items, nextCursor, loading, loadingMore, error, retry, loadMore } =
    useSubmittedCandidates(jobId);
  const [viewer, setViewer] = useState<{
    applicationId: string;
    kind: "cv" | "cover-letter";
    fileName?: string | null;
  } | null>(null);

  return (
    <section className="submitted-candidates" aria-labelledby="submitted-candidates-title">
      {onBack ? <button type="button" onClick={onBack}>Back to job postings</button> : null}
      <p className="recruiter-eyebrow">Submitted candidates</p>
      <h1 id="submitted-candidates-title">{jobTitle}</h1>
      <p>Review the evidence candidates submitted for this job. Scores are not part of this view.</p>
      <div aria-live="polite" aria-busy={loading || loadingMore}>
        {loading ? <p role="status">Loading submitted candidates…</p> : null}
        {error ? (
          <div role="alert">
            <p>Submitted candidates could not be loaded.</p>
            <button type="button" onClick={retry}>Retry</button>
          </div>
        ) : null}
        {!loading && !error && items.length === 0 ? (
          <p>No candidates have applied to this job yet.</p>
        ) : null}
        {!loading && !error && items.length > 0 ? (
          <div className="submitted-candidates-table" role="list" aria-label="Submitted candidates">
            {items.map((candidate) => (
              <article key={candidate.applicationId} role="listitem" className="submitted-candidate-row">
                <div>
                  <strong>{candidate.candidate.displayName}</strong>
                  <span>{candidate.candidate.verifiedEmail}</span>
                  {candidate.candidate.sharedPhone ? <span>{candidate.candidate.sharedPhone}</span> : null}
                </div>
                <div>
                  <span>Applied {formatDate(candidate.submittedAt)}</span>
                  <span>{candidate.stage.replaceAll("_", " ")}</span>
                </div>
                <DocumentActions candidate={candidate} jobId={jobId} onView={(kind, fileName) => setViewer({ applicationId: candidate.applicationId, kind, fileName })} />
              </article>
            ))}
          </div>
        ) : null}
      </div>
      {nextCursor ? <button type="button" onClick={loadMore} disabled={loadingMore}>{loadingMore ? "Loading…" : "Load more candidates"}</button> : null}
      {viewer ? <ApplicationDocumentViewer jobId={jobId} applicationId={viewer.applicationId} kind={viewer.kind} fileName={viewer.fileName} onClose={() => setViewer(null)} /> : null}
    </section>
  );
}
