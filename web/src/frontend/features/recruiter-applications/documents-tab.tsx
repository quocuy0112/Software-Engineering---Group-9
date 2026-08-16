"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Ellipsis,
  Eye,
  FileText,
  Tag,
} from "lucide-react";
import type { AiAssessment, AutomaticMatch } from "@/shared/contracts/scoring";
import { ApplicationDocumentViewer } from "./application-document-viewer";

type Metadata = {
  cv: { available: boolean; fileName: string | null };
  coverLetter: { kind: "NONE" | "TEXT" | "DOCUMENT"; fileName?: string | null };
};

export function DocumentsTab({
  jobId,
  applicationId,
  automatic,
  dataQualityNotes = [],
  openKind,
}: {
  jobId: string;
  applicationId: string;
  automatic?: AutomaticMatch | null;
  dataQualityNotes?: AiAssessment["dataQualityNotes"];
  openKind?: "cv" | "cover-letter" | null;
}) {
  const [viewer, setViewer] = useState<"cv" | "cover-letter" | null>(
    openKind ?? null,
  );
  const [metadata, setMetadata] = useState<Metadata | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(
      `/api/recruiter/jobs/${encodeURIComponent(jobId)}/applications?limit=100`,
      { cache: "no-store" },
    )
      .then((response) =>
        response.ok
          ? response.json()
          : Promise.reject(new Error("metadata unavailable")),
      )
      .then((page: { items?: Array<Metadata & { applicationId: string }> }) => {
        if (!cancelled)
          setMetadata(
            page.items?.find((item) => item.applicationId === applicationId) ??
              null,
          );
      })
      .catch(() => {
        if (!cancelled) setMetadata(null);
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId, jobId]);

  const parse = automatic?.cvParse;
  const parsingWarning = automatic?.mayBeIncomplete ?? false;
  const coverAvailable =
    metadata?.coverLetter.kind === "DOCUMENT" ||
    metadata?.coverLetter.kind === "TEXT";
  const detectedKeywords = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...(automatic?.foundRequiredSkills ?? []),
            ...(automatic?.preferredSkills ?? []),
          ].map((item) => item.label),
        ),
      ).slice(0, 8),
    [automatic],
  );

  return (
    <div className="documents-tab">
      <div
        className={`document-parser-status${parsingWarning || dataQualityNotes.length ? "is-warning" : ""}`}
      >
        <span className="document-parser-status__icon" aria-hidden="true">
          {parsingWarning || dataQualityNotes.length ? (
            <AlertTriangle />
          ) : (
            <CheckCircle2 />
          )}
        </span>
        <div>
          <span>Document parsing status</span>
          <strong>
            {parse?.label ?? "Parsing status unavailable"}
            {parse ? ` · ${parse.parserVersion}` : ""}
          </strong>
          {parsingWarning ? (
            <p>
              Automatic and AI scores may be incomplete because parsing reported
              an issue.
            </p>
          ) : null}
        </div>
        <div className="document-parser-status__time">
          <span>
            <Clock3 aria-hidden="true" /> Processing time
          </span>
          <strong>
            {parse
              ? `${(parse.processingMilliseconds / 1000).toFixed(1)}s · ${parse.snapshotVersion}`
              : "—"}
          </strong>
        </div>
      </div>

      {dataQualityNotes.length > 0 ? (
        <section className="document-quality-note" role="status">
          <strong>CV data quality notes</strong>
          <p>
            These are parsing/input limitations, not candidate-fit findings.
          </p>
          <ul>
            {dataQualityNotes.map((note) => (
              <li key={note.id}>
                <strong>{note.title}</strong>
                <span>
                  {note.bucket === "input_limitation"
                    ? "Input limitation"
                    : "Extraction uncertainty"}{" "}
                  · {note.evidence}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="document-preview-grid">
        {metadata?.cv.available !== false ? (
          <DocumentCard
            title="Original CV"
            fileName={metadata?.cv.fileName ?? "Candidate CV"}
            kind="cv"
            onOpen={() => setViewer("cv")}
          />
        ) : null}
        {coverAvailable ? (
          <DocumentCard
            title="Cover letter"
            fileName={
              metadata?.coverLetter.fileName ??
              (metadata?.coverLetter.kind === "TEXT"
                ? "Submitted cover letter"
                : "Cover letter")
            }
            kind="cover-letter"
            keywords={detectedKeywords}
            onOpen={() => setViewer("cover-letter")}
          />
        ) : (
          <div className="document-missing-card">
            <FileText aria-hidden="true" />
            <strong>Cover letter not provided</strong>
            <p>This application did not include a cover letter.</p>
          </div>
        )}
      </div>

      <div className="documents-verification-note">
        <Eye aria-hidden="true" />
        <span>
          Use this preview to verify evidence. Open the original file for
          full-page verification.
        </span>
      </div>
      {viewer ? (
        <ApplicationDocumentViewer
          jobId={jobId}
          applicationId={applicationId}
          kind={viewer}
          fileName={
            viewer === "cv"
              ? metadata?.cv.fileName
              : metadata?.coverLetter.fileName
          }
          onClose={() => setViewer(null)}
        />
      ) : null}
    </div>
  );
}

function DocumentCard({
  title,
  fileName,
  kind,
  keywords = [],
  onOpen,
}: {
  title: string;
  fileName: string;
  kind: "cv" | "cover-letter";
  keywords?: string[];
  onOpen: () => void;
}) {
  return (
    <article className="document-preview-card">
      <header>
        <div>
          <span className="document-preview-card__title">
            <FileText aria-hidden="true" /> {title}
          </span>
          <small>{fileName}</small>
        </div>
        <button type="button" aria-label={`More options for ${title}`}>
          <Ellipsis aria-hidden="true" />
        </button>
      </header>
      <button type="button" className="document-paper-button" onClick={onOpen}>
        <span className="document-paper">
          {kind === "cv" ? (
            <>
              <strong>NGUYỄN MINH ANH</strong>
              <b>SENIOR BACKEND DEVELOPER</b>
              <i>
                Backend engineer with experience building Java/Spring Boot
                services, high-performance APIs, and PostgreSQL data systems.
              </i>
              <em>EXPERIENCE</em>
              <i>
                • Developed backend services and designed REST APIs for a
                payment platform.
              </i>
              <em>SKILLS</em>
              <i>Java · Spring Boot · REST API · PostgreSQL · Docker</i>
            </>
          ) : (
            <>
              <strong>Dear SmartHire Recruitment Team,</strong>
              <i>
                I am applying for the role because I want to contribute my
                experience building stable, scalable backend systems.
              </i>
              <i>
                Over the past four years, I have developed Java/Spring Boot
                services, designed REST APIs, and optimized PostgreSQL.
              </i>
              <i>Sincerely,</i>
              <b>Nguyễn Minh Anh</b>
            </>
          )}
        </span>
        <span className="document-open-link">
          <Eye aria-hidden="true" /> Open original
        </span>
      </button>
      {keywords.length ? (
        <div className="document-keywords">
          <strong>
            <Tag aria-hidden="true" /> Detected keywords
          </strong>
          <div>
            {keywords.map((keyword) => (
              <span key={keyword}>{keyword}</span>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}
