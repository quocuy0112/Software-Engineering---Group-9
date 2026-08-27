"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
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
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { ApplicationDocumentViewer } from "./application-document-viewer";
import {
  applicationDetailCopy,
  type ApplicationDetailCopy,
} from "./application-detail-copy";

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
  if (cached.state.status === "missing") {
    previewCache.delete(key);
    return null;
  }
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
) {
  return [jobId, applicationId, kind].join(":");
}

function documentSourceLabel(
  document: StructuredDocumentPreview,
  kind: DocumentKind,
  copy: ApplicationDetailCopy["documents"],
) {
  if (kind === "cover-letter" && document.mediaType === "text/plain") {
    return copy.writtenText;
  }
  if (document.mediaType === "application/pdf") return copy.pdfAttachment;
  if (
    document.mediaType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return copy.docxAttachment;
  }
  if (document.mediaType === "application/msword") return copy.docAttachment;
  return document.previewStatus === "LIMITED"
    ? copy.limitedPreview
    : copy.parsedPreview;
}

async function loadPreview(
  jobId: string,
  applicationId: string,
  kind: DocumentKind,
  signal: AbortSignal,
  copy: ApplicationDetailCopy["documents"],
  retryToken = 0,
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
    const retryQuery =
      retryToken > 0
        ? `?cacheVersion=${encodeURIComponent(`retry-${retryToken}`)}`
        : "";
    const response = await fetch(
      `/api/recruiter/jobs/${encodeURIComponent(jobId)}/applications/${encodeURIComponent(applicationId)}/documents/${kind}/text${retryQuery}`,
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
        message: copy.documentLoadFailed,
        retryable: true,
      };
    }
    const parsed = structuredDocumentPreviewSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        status: "error",
        message: copy.documentLoadFailed,
        retryable: true,
      };
    }
    return { status: "ready", document: parsed.data };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      if (timedOut) {
        return {
          status: "error",
          message: copy.parseTimeout,
          retryable: true,
        };
      }
      throw error;
    }
    return {
      status: "error",
      message: copy.documentLoadFailed,
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
}: {
  jobId: string;
  applicationId: string;
  automatic?: AutomaticMatch | null;
  openKind?: DocumentKind | null;
  openRequest?: number;
}) {
  const locale = useWorkspaceLocale();
  const copy = useMemo(() => applicationDetailCopy(locale).documents, [locale]);
  const [previews, setPreviews] = useState(initialPreviewState);
  const [retryTokens, setRetryTokens] = useState<Record<DocumentKind, number>>({
    cv: 0,
    "cover-letter": 0,
  });
  const [viewer, setViewer] = useState<DocumentKind | null>(null);
  const cvRetryToken = retryTokens.cv;
  const coverLetterRetryToken = retryTokens["cover-letter"];

  useEffect(() => {
    const controller = new AbortController();
    for (const kind of ["cv", "cover-letter"] as const) {
      const key = previewCacheKey(jobId, applicationId, kind);
      const retryToken = kind === "cv" ? cvRetryToken : coverLetterRetryToken;
      const cached = retryToken === 0 ? readPreviewCache(key) : null;
      const request = cached
        ? Promise.resolve(cached)
        : loadPreview(
            jobId,
            applicationId,
            kind,
            controller.signal,
            copy,
            retryToken,
          );
      void request
        .then((state) => {
          if (controller.signal.aborted) return;
          // A missing document can become available after the candidate
          // finishes or replaces an application. Cache successful previews
          // only so a long-lived recruiter drawer never preserves an old
          // "Cover letter not provided" result.
          if (state.status === "ready") writePreviewCache(key, state);
          setPreviews((current) => ({ ...current, [kind]: state }));
        })
        .catch(() => undefined);
    }
    return () => controller.abort();
  }, [applicationId, copy, cvRetryToken, coverLetterRetryToken, jobId, locale]);

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
  const snapshotVersion = automatic?.cvParse?.snapshotVersion ?? "latest";
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
        state.status === "ready" &&
        state.document.previewStatus === "LIMITED" &&
        state.document.mediaType !== "application/pdf",
    )
    .map(([kind]) => kind);
  const hasLimitedPreview = limitedKinds.length > 0;
  const originalPdfKinds = (
    Object.entries(previews) as Array<[DocumentKind, PreviewState]>
  )
    .filter(
      ([, state]) =>
        state.status === "ready" &&
        state.document.mediaType === "application/pdf",
    )
    .map(([kind]) => kind);
  const hasOriginalPdfPreview = originalPdfKinds.length > 0;
  const failedKinds = (
    Object.entries(previews) as Array<[DocumentKind, PreviewState]>
  )
    .filter(([, state]) => state.status === "error")
    .map(([kind]) => kind);
  const statusLabel = isLoading
    ? copy.loadingPreviews
    : hasError
      ? failedKinds.length === 1
        ? failedKinds[0] === "cv"
          ? copy.cvPreviewFailed
          : copy.coverPreviewFailed
        : copy.previewFailed
      : hasOriginalPdfPreview
        ? originalPdfKinds.length === 1
          ? originalPdfKinds[0] === "cv"
            ? copy.cvPdfReady
            : copy.coverPdfReady
          : copy.pdfReady
        : hasLimitedPreview
          ? limitedKinds.length === 1
            ? limitedKinds[0] === "cv"
              ? copy.cvLimited
              : copy.coverLimited
            : copy.limited
          : copy.parsedSuccessfully;
  const parserVersion =
    Object.values(previews).find(
      (state): state is Extract<PreviewState, { status: "ready" }> =>
        state.status === "ready",
    )?.document.parserVersion ?? copy.parserVersion;
  const processingMilliseconds = Math.max(
    0,
    ...Object.values(previews).flatMap((state) =>
      state.status === "ready" ? [state.document.processingMilliseconds] : [],
    ),
  );
  const processingValue = isLoading
    ? copy.inProgress
    : copy.processing(
        (processingMilliseconds / 1000).toFixed(1),
        versionSuffix(snapshotVersion),
        versionSuffix(automatic?.jdVersion ?? "—"),
      );

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
          <span>{copy.status}</span>
          <strong>{statusLabel + " · " + parserVersion}</strong>
          {hasLimitedPreview ? <p>{copy.originalStillAvailable}</p> : null}
        </div>
        <div className="document-parser-status__time">
          <span>
            <Clock3 aria-hidden="true" /> {copy.processingTime}
          </span>
          <strong>{processingValue}</strong>
        </div>
      </div>

      <div className="document-preview-grid">
        <DocumentCard
          id="document-preview-cv"
          jobId={jobId}
          applicationId={applicationId}
          title={copy.originalCv}
          fileName={
            previews.cv.status === "ready"
              ? previews.cv.document.fileName
              : copy.candidateCv
          }
          kind="cv"
          state={previews.cv}
          onRetry={() => retry("cv")}
          onOpenOriginal={() => setViewer("cv")}
        />
        <DocumentCard
          id="document-preview-cover-letter"
          jobId={jobId}
          applicationId={applicationId}
          title={copy.coverLetter}
          fileName={
            previews["cover-letter"].status === "ready"
              ? previews["cover-letter"].document.fileName
              : copy.coverLetter
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
        <span>{copy.verification}</span>
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
  originalUrl,
  onOpenOriginal,
}: {
  document: StructuredDocumentPreview;
  kind: DocumentKind;
  keywords: string[];
  originalUrl: string;
  onOpenOriginal: () => void;
}) {
  const copy = applicationDetailCopy(useWorkspaceLocale()).documents;
  const hasContent =
    document.content.kind === "cv"
      ? Boolean(
          document.content.name ||
          document.content.title ||
          document.content.summary ||
          document.content.contact.length ||
          document.content.experience.length ||
          document.content.education.length ||
          document.content.skills.length ||
          document.content.certifications.length ||
          document.content.languages.length,
        )
      : Boolean(
          document.content.date ||
          document.content.greeting ||
          document.content.paragraphs.length ||
          document.content.closing ||
          document.content.signOff,
        );

  if (document.mediaType === "application/pdf") {
    return (
      <div className="document-structured-paper document-structured-paper--pdf">
        <InlinePdfDocumentPreview
          title={copy.pdfPreview(
            kind === "cv" ? copy.originalCv : copy.coverLetter,
          )}
          originalUrl={originalUrl}
          onOpenOriginal={onOpenOriginal}
        />
        <span className="document-structured-paper__page">
          {document.pageCount ? copy.pages(document.pageCount) : copy.pdfScroll}
        </span>
      </div>
    );
  }

  return (
    <div className="document-structured-paper">
      {document.previewStatus === "LIMITED" && !hasContent ? (
        <div className="document-preview-limited-empty" role="status">
          <FileText aria-hidden="true" />
          <strong>
            {kind === "cover-letter" ? copy.coverAttached : copy.cvAttached}
          </strong>
          <p>{copy.textUnavailable}</p>
          <button type="button" onClick={onOpenOriginal}>
            {copy.viewOriginalFile}
          </button>
        </div>
      ) : null}
      {document.previewStatus === "LIMITED" && hasContent ? (
        <div className="document-preview-limited-note" role="status">
          <AlertTriangle aria-hidden="true" />
          <span>{copy.completeUnavailable}</span>
        </div>
      ) : null}
      {document.content.kind === "cv" && hasContent ? (
        <StructuredCvPaper content={document.content} />
      ) : document.content.kind === "cover-letter" && hasContent ? (
        <StructuredCoverLetterPaper
          content={document.content}
          keywords={kind === "cover-letter" ? keywords : []}
        />
      ) : null}
      <span className="document-structured-paper__page">
        {document.pageCount
          ? copy.pageIndicator(document.pageCount)
          : copy.parsedPreview}
      </span>
    </div>
  );
}

function InlinePdfDocumentPreview({
  title,
  originalUrl,
  onOpenOriginal,
}: {
  title: string;
  originalUrl: string;
  onOpenOriginal: () => void;
}) {
  const copy = applicationDetailCopy(useWorkspaceLocale()).documents;
  const [documentResource, setDocumentResource] = useState<{
    sourceUrl: string;
    documentUrl: string;
  } | null>(null);
  const [failure, setFailure] = useState<{
    sourceUrl: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let objectUrl: string | null = null;

    void fetch(originalUrl, {
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/pdf" },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(copy.documentLoadFailed);
        }
        const blob = await response.blob();
        if (!blob.size) throw new Error(copy.originalUnavailable);
        return blob;
      })
      .then((blob) => {
        if (!active) return;
        setFailure(null);

        // Keep a direct-route fallback for test environments and older
        // browsers without object URLs. Modern browsers use an authenticated
        // in-memory URL so the PDF plugin never has to navigate the protected
        // response directly.
        if (typeof URL.createObjectURL !== "function") {
          setDocumentResource({
            sourceUrl: originalUrl,
            documentUrl: originalUrl,
          });
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setDocumentResource({ sourceUrl: originalUrl, documentUrl: objectUrl });
      })
      .catch((reason: unknown) => {
        if (
          !active ||
          (reason instanceof Error && reason.name === "AbortError")
        )
          return;
        setFailure({
          sourceUrl: originalUrl,
          message: copy.documentLoadFailed,
        });
      });

    return () => {
      active = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [copy.documentLoadFailed, copy.originalUnavailable, originalUrl]);

  const documentUrl =
    documentResource?.sourceUrl === originalUrl
      ? documentResource.documentUrl
      : null;
  const error = failure?.sourceUrl === originalUrl ? failure.message : null;

  return (
    <div className="document-pdf-preview">
      {error ? (
        <div className="document-pdf-preview__state" role="alert">
          <FileText aria-hidden="true" />
          <strong>{copy.documentUnavailable}</strong>
          <p>{error}</p>
          <button type="button" onClick={onOpenOriginal}>
            {copy.viewOriginalFile}
          </button>
        </div>
      ) : documentUrl ? (
        <iframe
          title={title}
          src={`${documentUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
        />
      ) : (
        <div className="document-pdf-preview__state" role="status">
          <LoaderCircle className="is-spinning" aria-hidden="true" />
          <span>{copy.loadingOriginalPdf}</span>
        </div>
      )}
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
  const copy = applicationDetailCopy(useWorkspaceLocale()).documents;
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
        <h3>{content.name ?? copy.candidateName}</h3>
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
        <DocumentPreviewSection title={copy.professionalSummary}>
          <p>{content.summary}</p>
        </DocumentPreviewSection>
      ) : null}

      {content.experience.length ? (
        <DocumentPreviewSection title={copy.experience}>
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
        <DocumentPreviewSection title={copy.skills}>
          <div className="document-skill-tags">
            {content.skills.map((skill) => (
              <span key={skill}>{skill}</span>
            ))}
          </div>
        </DocumentPreviewSection>
      ) : null}

      {content.education.length ? (
        <DocumentPreviewSection title={copy.education}>
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
        <DocumentPreviewSection title={copy.certifications}>
          <ul className="document-plain-list">
            {content.certifications.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </DocumentPreviewSection>
      ) : null}

      {content.languages.length ? (
        <DocumentPreviewSection title={copy.languages}>
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
          <p>{copy.fieldsUnavailable}</p>
          <span>{copy.openOriginalToVerify}</span>
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
  const copy = applicationDetailCopy(useWorkspaceLocale()).documents;
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
            <Tag aria-hidden="true" /> {copy.detectedKeywords}
          </strong>
          <div>
            {keywords.map((keyword) => (
              <span key={keyword}>{keyword}</span>
            ))}
          </div>
        </div>
      ) : null}
      {!content.date &&
      !content.paragraphs.length &&
      !content.greeting &&
      !content.closing &&
      !content.signOff ? (
        <div className="document-structured-empty">
          <FileText aria-hidden="true" />
          <p>{copy.coverFieldsUnavailable}</p>
          <span>{copy.openOriginalToVerify}</span>
        </div>
      ) : null}
    </div>
  );
}

function DocumentCard({
  id,
  jobId,
  applicationId,
  title,
  fileName,
  kind,
  state,
  keywords = [],
  onRetry,
  onOpenOriginal,
}: {
  id: string;
  jobId: string;
  applicationId: string;
  title: string;
  fileName: string | null;
  kind: DocumentKind;
  state: PreviewState;
  keywords?: string[];
  onRetry: () => void;
  onOpenOriginal: () => void;
}) {
  const copy = applicationDetailCopy(useWorkspaceLocale()).documents;
  const label =
    fileName ?? (kind === "cv" ? copy.candidateCv : copy.coverLetter);
  return (
    <article className="document-preview-card" id={id}>
      <header>
        <div>
          <span className="document-preview-card__title">
            <FileText aria-hidden="true" /> {title}
          </span>
          <small>{label}</small>
          {state.status === "ready" ? (
            <small className="document-preview-card__source">
              {documentSourceLabel(state.document, kind, copy)}
            </small>
          ) : null}
        </div>
        <button
          type="button"
          aria-label={copy.openOriginal(title)}
          onClick={onOpenOriginal}
          title={copy.openOriginal(title)}
        >
          <Ellipsis aria-hidden="true" />
        </button>
      </header>
      <div className="document-preview-surface">
        {state.status === "loading" ? (
          <div
            className="document-preview-skeleton"
            role="status"
            aria-label={copy.loading(title)}
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
            originalUrl={`/api/recruiter/jobs/${encodeURIComponent(jobId)}/applications/${encodeURIComponent(applicationId)}/documents/${kind}`}
            onOpenOriginal={onOpenOriginal}
          />
        ) : state.status === "missing" && kind === "cover-letter" ? (
          <div className="document-missing-card">
            <FileText aria-hidden="true" />
            <strong>{copy.coverNotProvided}</strong>
            <p>{copy.coverNotProvidedDescription}</p>
          </div>
        ) : (
          <div className="document-preview-error" role="alert">
            <AlertTriangle aria-hidden="true" />
            <strong>
              {state.status === "missing"
                ? copy.documentLoadFailed
                : copy.documentUnavailable}
            </strong>
            <p>
              {state.status === "missing"
                ? copy.originalUnavailable
                : state.message}
            </p>
            <div className="document-preview-error__actions">
              {state.status === "error" && state.retryable ? (
                <button type="button" onClick={onRetry}>
                  {copy.retryPreview}
                </button>
              ) : null}
              <button type="button" onClick={onOpenOriginal}>
                {copy.viewOriginalFile}
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
