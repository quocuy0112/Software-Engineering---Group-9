"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Ellipsis,
  Eye,
  FileText,
  LoaderCircle,
  Tag,
} from "lucide-react";
import type { StructuredDocumentPreview } from "@/shared/contracts/applications/document-preview";
import { structuredDocumentPreviewSchema } from "@/shared/contracts/applications/document-preview";
import type { AutomaticMatch } from "@/shared/contracts/scoring";
import { ApplicationDocumentViewer } from "./application-document-viewer";

type DocumentKind = "cv" | "cover-letter";

type PreviewState =
  | { status: "loading" }
  | { status: "ready"; document: StructuredDocumentPreview }
  | { status: "missing" }
  | { status: "error"; message: string; retryable: boolean };

const CLIENT_PREVIEW_CACHE_TTL_MS = 30 * 60_000;
const previewCache = new Map<
  string,
  { state: PreviewState; cachedAt: number }
>();

function readPreviewCache(key: string): PreviewState | null {
  const cached = previewCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > CLIENT_PREVIEW_CACHE_TTL_MS) {
    previewCache.delete(key);
    return null;
  }
  return cached.state;
}

function writePreviewCache(key: string, state: PreviewState) {
  previewCache.set(key, { state, cachedAt: Date.now() });
}

function initialPreviewState(): Record<DocumentKind, PreviewState> {
  return {
    cv: { status: "loading" },
    "cover-letter": { status: "loading" },
  };
}

function versionSuffix(value: string) {
  return value.match(/v\d+(?:\.\d+)?$/iu)?.[0] ?? value;
}

function previewCacheKey(
  jobId: string,
  applicationId: string,
  kind: DocumentKind,
  scoringVersion: string,
) {
  return [jobId, applicationId, kind, scoringVersion].join(":");
}

async function loadPreview(
  jobId: string,
  applicationId: string,
  kind: DocumentKind,
  scoringVersion: string,
  signal: AbortSignal,
): Promise<PreviewState> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 7_500);
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  try {
    const query = new URLSearchParams({ cacheVersion: scoringVersion });
    const response = await fetch(
      `/api/recruiter/jobs/${encodeURIComponent(jobId)}/applications/${encodeURIComponent(applicationId)}/documents/${kind}/text?${query.toString()}`,
      { cache: "no-store", signal: controller.signal },
    );
    const payload = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (response.status === 404) return { status: "missing" };
    if (!response.ok) {
      return {
        status: "error",
        message:
          typeof payload?.message === "string"
            ? payload.message
            : "Couldn't load document — try downloading the original.",
        retryable: true,
      };
    }
    const parsed = structuredDocumentPreviewSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        status: "error",
        message: "Couldn't load document — try downloading the original.",
        retryable: true,
      };
    }
    return { status: "ready", document: parsed.data };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      if (timedOut) {
        return {
          status: "error",
          message:
            "Parsing is taking longer than 7.5 seconds. Try again or open the original file.",
          retryable: true,
        };
      }
      throw error;
    }
    return {
      status: "error",
      message: "Couldn't load document — try downloading the original.",
      retryable: true,
    };
  } finally {
    globalThis.clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
  }
}

export function DocumentsTab({
  jobId,
  applicationId,
  automatic,
  openKind,
  openRequest = 0,
  documentCacheVersion = 0,
}: {
  jobId: string;
  applicationId: string;
  automatic?: AutomaticMatch | null;
  openKind?: DocumentKind | null;
  openRequest?: number;
  documentCacheVersion?: number;
}) {
  const [previews, setPreviews] = useState(initialPreviewState);
  const [retryTokens, setRetryTokens] = useState<Record<DocumentKind, number>>({
    cv: 0,
    "cover-letter": 0,
  });
  const [viewer, setViewer] = useState<DocumentKind | null>(null);
  const snapshotVersion = automatic?.cvParse?.snapshotVersion ?? "latest";
  const scoringVersion = snapshotVersion + ":" + documentCacheVersion;
  const cvRetryToken = retryTokens.cv;
  const coverLetterRetryToken = retryTokens["cover-letter"];
  const previousScoringVersion = useRef(scoringVersion);

  useEffect(() => {
    const controller = new AbortController();
    const versionChanged = previousScoringVersion.current !== scoringVersion;
    previousScoringVersion.current = scoringVersion;
    if (versionChanged) setPreviews(initialPreviewState());
    for (const kind of ["cv", "cover-letter"] as const) {
      const key = previewCacheKey(jobId, applicationId, kind, scoringVersion);
      const retryToken = kind === "cv" ? cvRetryToken : coverLetterRetryToken;
      const cached = retryToken === 0 ? readPreviewCache(key) : null;
      const request = cached
        ? Promise.resolve(cached)
        : loadPreview(
            jobId,
            applicationId,
            kind,
            scoringVersion,
            controller.signal,
          );
      void request
        .then((state) => {
          if (controller.signal.aborted) return;
          if (state.status === "ready" || state.status === "missing")
            writePreviewCache(key, state);
          setPreviews((current) => ({ ...current, [kind]: state }));
        })
        .catch(() => undefined);
    }
    return () => controller.abort();
  }, [
    applicationId,
    jobId,
    cvRetryToken,
    coverLetterRetryToken,
    scoringVersion,
  ]);

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
  const isLoading = Object.values(previews).some(
    (state) => state.status === "loading",
  );
  const hasError = Object.values(previews).some(
    (state) => state.status === "error",
  );
  const limitedKinds = (
    Object.entries(previews) as Array<[DocumentKind, PreviewState]>
  )
    .filter(
      ([, state]) =>
        state.status === "ready" && state.document.previewStatus === "LIMITED",
    )
    .map(([kind]) => kind);
  const hasLimitedPreview = limitedKinds.length > 0;
  const failedKinds = (
    Object.entries(previews) as Array<[DocumentKind, PreviewState]>
  )
    .filter(([, state]) => state.status === "error")
    .map(([kind]) => kind);
  const statusLabel = isLoading
    ? "Parsing…"
    : hasError
      ? failedKinds.length === 1
        ? failedKinds[0] === "cv"
          ? "CV parsing failed"
          : "Cover letter parsing failed"
        : "Parsing failed"
      : hasLimitedPreview
        ? limitedKinds.length === 1
          ? limitedKinds[0] === "cv"
            ? "CV preview is limited"
            : "Cover letter preview is limited"
          : "Document previews are limited"
        : "Parsed successfully";
  const parserVersion =
    Object.values(previews).find(
      (state): state is Extract<PreviewState, { status: "ready" }> =>
        state.status === "ready",
    )?.document.parserVersion ?? "Structured preview v1";
  const processingMilliseconds = Math.max(
    0,
    ...Object.values(previews).flatMap((state) =>
      state.status === "ready" ? [state.document.processingMilliseconds] : [],
    ),
  );
  const processingValue = isLoading
    ? "In progress…"
    : (processingMilliseconds / 1000).toFixed(1) +
      "s · CV snapshot " +
      versionSuffix(snapshotVersion) +
      " · JD " +
      versionSuffix(automatic?.jdVersion ?? "—");

  function retry(kind: DocumentKind) {
    setPreviews((current) => ({ ...current, [kind]: { status: "loading" } }));
    setRetryTokens((current) => ({
      ...current,
      [kind]: current[kind] + 1,
    }));
  }

  return (
    <div className="documents-tab">
      <div
        className={
          "document-parser-status" +
          (isLoading ? " is-loading" : "") +
          (hasError
            ? " is-error"
            : isLoading
              ? ""
              : hasLimitedPreview
                ? " is-limited"
                : " is-success")
        }
      >
        <span className="document-parser-status__icon" aria-hidden="true">
          {isLoading ? (
            <LoaderCircle className="is-spinning" />
          ) : hasError ? (
            <AlertTriangle />
          ) : hasLimitedPreview ? (
            <AlertTriangle />
          ) : (
            <CheckCircle2 />
          )}
        </span>
        <div>
          <span>Document parsing status</span>
          <strong>{statusLabel + " · " + parserVersion}</strong>
          {hasLimitedPreview ? (
            <p>
              Original files are still available. Open or download them to
              review content that could not be extracted.
            </p>
          ) : null}
        </div>
        <div className="document-parser-status__time">
          <span>
            <Clock3 aria-hidden="true" /> Processing time
          </span>
          <strong>{processingValue}</strong>
        </div>
      </div>

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
          onRetry={() => retry("cv")}
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
          onRetry={() => retry("cover-letter")}
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

function StructuredDocumentPreviewRenderer({
  document,
  kind,
  keywords,
}: {
  document: StructuredDocumentPreview;
  kind: DocumentKind;
  keywords: string[];
}) {
  return (
    <div className="document-structured-paper">
      {document.previewStatus === "LIMITED" ? (
        <div className="document-preview-limited-note" role="status">
          <AlertTriangle aria-hidden="true" />
          <span>
            A complete text preview was unavailable. Open the original file to
            review it.
          </span>
        </div>
      ) : null}
      {document.content.kind === "cv" ? (
        <StructuredCvPaper content={document.content} />
      ) : (
        <StructuredCoverLetterPaper
          content={document.content}
          keywords={kind === "cover-letter" ? keywords : []}
        />
      )}
      <span className="document-structured-paper__page">
        {document.pageCount ? "1 / " + document.pageCount : "Parsed preview"}
      </span>
    </div>
  );
}

function DocumentPreviewSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="document-structured-section">
      <h4>{title}</h4>
      {children}
    </section>
  );
}

function StructuredCvPaper({
  content,
}: {
  content: Extract<StructuredDocumentPreview["content"], { kind: "cv" }>;
}) {
  const hasSections =
    Boolean(content.summary) ||
    content.experience.length > 0 ||
    content.skills.length > 0 ||
    content.education.length > 0 ||
    content.certifications.length > 0 ||
    content.languages.length > 0;

  return (
    <div className="document-structured-paper__content">
      <header className="document-structured-identity">
        <h3>{content.name ?? "Candidate CV"}</h3>
        {content.title ? <p>{content.title}</p> : null}
        {content.contact.length ? (
          <div className="document-structured-contact">
            {content.contact.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        ) : null}
      </header>

      {content.summary ? (
        <DocumentPreviewSection title="Professional summary">
          <p>{content.summary}</p>
        </DocumentPreviewSection>
      ) : null}

      {content.experience.length ? (
        <DocumentPreviewSection title="Experience">
          <div className="document-experience-list">
            {content.experience.map((entry, index) => (
              <article
                className="document-experience-entry"
                key={entry.role + "-" + (entry.company ?? "") + "-" + index}
              >
                <div className="document-experience-entry__heading">
                  <strong>{entry.role}</strong>
                  {entry.dates ? <span>{entry.dates}</span> : null}
                </div>
                {entry.company ? <p>{entry.company}</p> : null}
                {entry.bullets.length ? (
                  <ul>
                    {entry.bullets.map((bullet, bulletIndex) => (
                      <li key={bullet + "-" + bulletIndex}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        </DocumentPreviewSection>
      ) : null}

      {content.skills.length ? (
        <DocumentPreviewSection title="Skills">
          <div className="document-skill-tags">
            {content.skills.map((skill) => (
              <span key={skill}>{skill}</span>
            ))}
          </div>
        </DocumentPreviewSection>
      ) : null}

      {content.education.length ? (
        <DocumentPreviewSection title="Education">
          <div className="document-structured-list">
            {content.education.map((entry, index) => (
              <div
                className="document-structured-list__item"
                key={entry.institution + "-" + index}
              >
                <strong>{entry.institution}</strong>
                {entry.degree ? <span>{entry.degree}</span> : null}
                {entry.dates ? <small>{entry.dates}</small> : null}
              </div>
            ))}
          </div>
        </DocumentPreviewSection>
      ) : null}

      {content.certifications.length ? (
        <DocumentPreviewSection title="Certifications">
          <ul className="document-plain-list">
            {content.certifications.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </DocumentPreviewSection>
      ) : null}

      {content.languages.length ? (
        <DocumentPreviewSection title="Languages">
          <div className="document-skill-tags">
            {content.languages.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </DocumentPreviewSection>
      ) : null}

      {!hasSections ? (
        <div className="document-structured-empty">
          <FileText aria-hidden="true" />
          <p>Structured CV fields are unavailable.</p>
          <span>Open the original file to verify the remaining content.</span>
        </div>
      ) : null}
    </div>
  );
}

function StructuredCoverLetterPaper({
  content,
  keywords,
}: {
  content: Extract<
    StructuredDocumentPreview["content"],
    { kind: "cover-letter" }
  >;
  keywords: string[];
}) {
  return (
    <div className="document-structured-paper__content document-letter-paper">
      {content.date ? (
        <p className="document-letter-paper__date">{content.date}</p>
      ) : null}
      {content.greeting ? (
        <p className="document-letter-paper__greeting">{content.greeting}</p>
      ) : null}
      <div className="document-letter-paper__body">
        {content.paragraphs.map((paragraph, index) => (
          <p key={paragraph + "-" + index}>{paragraph}</p>
        ))}
      </div>
      {content.closing ? (
        <p className="document-letter-paper__closing">{content.closing}</p>
      ) : null}
      {content.signOff ? (
        <p className="document-letter-paper__signoff">{content.signOff}</p>
      ) : null}
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
      {!content.paragraphs.length && !content.greeting && !content.signOff ? (
        <div className="document-structured-empty">
          <FileText aria-hidden="true" />
          <p>Structured cover letter fields are unavailable.</p>
          <span>Open the original file to verify the remaining content.</span>
        </div>
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
  onRetry,
  onOpenOriginal,
}: {
  id: string;
  title: string;
  fileName: string | null;
  kind: DocumentKind;
  state: PreviewState;
  keywords?: string[];
  onRetry: () => void;
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
          <div
            className="document-preview-skeleton"
            role="status"
            aria-label={"Loading " + title}
          >
            <span className="document-preview-skeleton__title" />
            <span />
            <span />
            <span className="is-short" />
            <span />
            <span className="is-medium" />
          </div>
        ) : state.status === "ready" ? (
          <StructuredDocumentPreviewRenderer
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
            <div className="document-preview-error__actions">
              {state.status === "error" && state.retryable ? (
                <button type="button" onClick={onRetry}>
                  Retry parsing
                </button>
              ) : null}
              <button type="button" onClick={onOpenOriginal}>
                View original
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
