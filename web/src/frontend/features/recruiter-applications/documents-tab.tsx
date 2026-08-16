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

type DocumentKind = "cv" | "cover-letter";

type PreviewSegment = Readonly<{
  id: string;
  kind: "heading" | "paragraph" | "list-item";
  text: string;
}>;

type PreviewDocument = Readonly<{
  kind: DocumentKind;
  fileName: string | null;
  mediaType: string | null;
  pageCount: number | null;
  segments: readonly PreviewSegment[];
}>;

type PreviewState =
  | { status: "loading" }
  | { status: "ready"; document: PreviewDocument }
  | { status: "missing" }
  | { status: "error"; message: string };

function initialPreviewState(): Record<DocumentKind, PreviewState> {
  return {
    cv: { status: "loading" },
    "cover-letter": { status: "loading" },
  };
}

function versionSuffix(value: string) {
  return value.match(/v\d+(?:\.\d+)?$/iu)?.[0] ?? value;
}

function isPreviewDocument(value: unknown): value is PreviewDocument {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.kind === "cv" || candidate.kind === "cover-letter") &&
    (candidate.fileName === null || typeof candidate.fileName === "string") &&
    (candidate.mediaType === null || typeof candidate.mediaType === "string") &&
    (candidate.pageCount === null || typeof candidate.pageCount === "number") &&
    Array.isArray(candidate.segments) &&
    candidate.segments.every(
      (segment) =>
        Boolean(segment) &&
        typeof segment === "object" &&
        typeof (segment as Record<string, unknown>).id === "string" &&
        typeof (segment as Record<string, unknown>).text === "string",
    )
  );
}

async function loadPreview(
  jobId: string,
  applicationId: string,
  kind: DocumentKind,
  signal: AbortSignal,
): Promise<PreviewState> {
  try {
    const response = await fetch(
      `/api/recruiter/jobs/${encodeURIComponent(jobId)}/applications/${encodeURIComponent(applicationId)}/documents/${kind}/text`,
      { cache: "no-store", signal },
    );
    const payload = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (response.status === 404 || payload?.code === "DOCUMENT_NOT_FOUND") {
      return { status: "missing" };
    }
    if (!response.ok) {
      return {
        status: "error",
        message:
          typeof payload?.message === "string"
            ? payload.message
            : "Couldn't load document — try downloading the original.",
      };
    }
    if (!isPreviewDocument(payload)) {
      return {
        status: "error",
        message: "Couldn't load document — try downloading the original.",
      };
    }
    return { status: "ready", document: payload };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    return {
      status: "error",
      message: "Couldn't load document — try downloading the original.",
    };
  }
}

export function DocumentsTab({
  jobId,
  applicationId,
  automatic,
  dataQualityNotes = [],
  openKind,
  openRequest = 0,
}: {
  jobId: string;
  applicationId: string;
  automatic?: AutomaticMatch | null;
  dataQualityNotes?: AiAssessment["dataQualityNotes"];
  openKind?: DocumentKind | null;
  openRequest?: number;
}) {
  const [previews, setPreviews] = useState(initialPreviewState);
  const [viewer, setViewer] = useState<DocumentKind | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all(
      (["cv", "cover-letter"] as const).map(
        async (kind) =>
          [
            kind,
            await loadPreview(jobId, applicationId, kind, controller.signal),
          ] as const,
      ),
    )
      .then((entries) => {
        if (controller.signal.aborted) return;
        setPreviews(
          Object.fromEntries(entries) as Record<DocumentKind, PreviewState>,
        );
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [applicationId, jobId]);

  useEffect(() => {
    if (!openKind || openRequest < 1) return;
    const frame = window.requestAnimationFrame(() => {
      setViewer(openKind);
      document
        .getElementById(`document-preview-${openKind}`)
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [openKind, openRequest]);

  const parse = automatic?.cvParse;
  const parsingWarning =
    parse?.code !== "PARSED_SUCCESSFULLY" ||
    automatic?.mayBeIncomplete === true;
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
  const processingValue = parse
    ? `${(parse.processingMilliseconds / 1000).toFixed(1)}s · CV snapshot ${versionSuffix(parse.snapshotVersion)} · JD ${versionSuffix(automatic?.jdVersion ?? "—")}`
    : "—";

  return (
    <div className="documents-tab">
      <div
        className={
          parsingWarning
            ? "document-parser-status is-warning"
            : "document-parser-status"
        }
      >
        <span className="document-parser-status__icon" aria-hidden="true">
          {parsingWarning ? <AlertTriangle /> : <CheckCircle2 />}
        </span>
        <div>
          <span>Document parsing status</span>
          <strong>
            {parse
              ? `${parse.label} · ${parse.parserVersion}`
              : "Parsing status unavailable"}
          </strong>
        </div>
        <div className="document-parser-status__time">
          <span>
            <Clock3 aria-hidden="true" /> Processing time
          </span>
          <strong>{processingValue}</strong>
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
                  {note.severity === "HIGH"
                    ? "High-severity data issue"
                    : "Minor data issue"}{" "}
                  ·{" "}
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
        <DocumentCard
          id="document-preview-cv"
          title="Original CV"
          fileName={
            previews.cv.status === "ready"
              ? previews.cv.document.fileName
              : "Candidate CV"
          }
          kind="cv"
          state={previews.cv}
          onOpenOriginal={() => setViewer("cv")}
        />
        <DocumentCard
          id="document-preview-cover-letter"
          title="Cover letter"
          fileName={
            previews["cover-letter"].status === "ready"
              ? previews["cover-letter"].document.fileName
              : "Cover letter"
          }
          kind="cover-letter"
          state={previews["cover-letter"]}
          keywords={detectedKeywords}
          onOpenOriginal={() => setViewer("cover-letter")}
        />
      </div>

      <div className="documents-verification-note">
        <Eye aria-hidden="true" />
        <span>
          Use this preview to verify evidence. Select &quot;View original
          CV&quot; or &quot;View cover letter&quot; to open the full file.
        </span>
      </div>

      {viewer ? (
        <ApplicationDocumentViewer
          key={viewer}
          jobId={jobId}
          applicationId={applicationId}
          kind={viewer}
          fileName={
            viewer === "cv"
              ? previews.cv.status === "ready"
                ? previews.cv.document.fileName
                : null
              : previews["cover-letter"].status === "ready"
                ? previews["cover-letter"].document.fileName
                : null
          }
          onClose={() => setViewer(null)}
        />
      ) : null}
    </div>
  );
}

function DocumentCard({
  id,
  title,
  fileName,
  kind,
  state,
  keywords = [],
  onOpenOriginal,
}: {
  id: string;
  title: string;
  fileName: string | null;
  kind: DocumentKind;
  state: PreviewState;
  keywords?: string[];
  onOpenOriginal: () => void;
}) {
  const label = fileName ?? (kind === "cv" ? "Candidate CV" : "Cover letter");
  return (
    <article className="document-preview-card" id={id}>
      <header>
        <div>
          <span className="document-preview-card__title">
            <FileText aria-hidden="true" /> {title}
          </span>
          <small>{label}</small>
        </div>
        <button
          type="button"
          aria-label={`Open original ${title}`}
          onClick={onOpenOriginal}
          title={`Open original ${title}`}
        >
          <Ellipsis aria-hidden="true" />
        </button>
      </header>
      <div className="document-preview-surface">
        {state.status === "loading" ? (
          <div className="document-preview-loading" role="status">
            <FileText aria-hidden="true" />
            <strong>Loading preview</strong>
            <span>Preparing the parsed document content.</span>
          </div>
        ) : state.status === "ready" ? (
          <ParsedDocumentPreview
            document={state.document}
            kind={kind}
            keywords={keywords}
          />
        ) : state.status === "missing" && kind === "cover-letter" ? (
          <div className="document-missing-card">
            <FileText aria-hidden="true" />
            <strong>Cover letter not provided</strong>
            <p>This application did not include a cover letter.</p>
          </div>
        ) : (
          <div className="document-preview-error" role="alert">
            <AlertTriangle aria-hidden="true" />
            <strong>
              {state.status === "missing"
                ? "Couldn't load document"
                : "Document preview unavailable"}
            </strong>
            <p>
              {state.status === "missing"
                ? "The original document is not available."
                : state.message}
            </p>
            <button type="button" onClick={onOpenOriginal}>
              View original
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function ParsedDocumentPreview({
  document,
  kind,
  keywords,
}: {
  document: PreviewDocument;
  kind: DocumentKind;
  keywords: string[];
}) {
  const lines = document.segments.flatMap((segment) =>
    segment.text
      .split(/\r?\n+/u)
      .map((text) => ({ segment, text: text.trim() }))
      .filter(({ text }) => text.length > 0),
  );

  return (
    <div className="document-parsed-paper">
      <div className="document-parsed-paper__content">
        {lines.map(({ segment, text }, index) => {
          const isList =
            segment.kind === "list-item" || /^[•●▪*-]\s+/u.test(text);
          const cleanText = text.replace(/^[•●▪*-]\s+/u, "");
          const isHeading =
            segment.kind === "heading" ||
            (cleanText.length <= 64 &&
              (/^[A-ZÀ-Ỹ0-9][A-ZÀ-Ỹ\s&/(),.-]{3,}$/u.test(cleanText) ||
                /^(professional summary|experience|skills|education|certifications|languages)$/iu.test(
                  cleanText,
                )));

          if (isHeading) {
            return <h4 key={`${segment.id}-${index}`}>{cleanText}</h4>;
          }
          if (isList) {
            return (
              <p
                className="document-parsed-paper__list-item"
                key={`${segment.id}-${index}`}
              >
                {cleanText}
              </p>
            );
          }
          return <p key={`${segment.id}-${index}`}>{cleanText}</p>;
        })}
      </div>
      {kind === "cover-letter" && keywords.length ? (
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
      <span className="document-parsed-paper__page">
        {document.pageCount ? `1 / ${document.pageCount}` : "Parsed preview"}
      </span>
    </div>
  );
}
