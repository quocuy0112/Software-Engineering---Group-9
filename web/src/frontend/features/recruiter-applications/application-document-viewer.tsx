"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, LoaderCircle, X } from "lucide-react";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { applicationDetailCopy } from "./application-detail-copy";

export function ApplicationDocumentViewer({
  jobId,
  applicationId,
  kind,
  fileName,
  onClose,
}: {
  jobId: string;
  applicationId: string;
  kind: "cv" | "cover-letter";
  fileName?: string | null;
  onClose: () => void;
}) {
  const locale = useWorkspaceLocale();
  const copy = useMemo(() => applicationDetailCopy(locale).viewer, [locale]);
  const kindLabel = kind === "cv" ? copy.originalCv : copy.coverLetter;
  const [state, setState] = useState<
    "loading" | "ready" | "download-only" | "error"
  >("loading");
  const [message, setMessage] = useState("");
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const previewUrl = `/api/recruiter/jobs/${encodeURIComponent(jobId)}/applications/${encodeURIComponent(applicationId)}/documents/${kind}`;
  const downloadUrl = `${previewUrl}/download`;

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    void fetch(previewUrl, {
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        Accept:
          "application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/octet-stream, text/plain",
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(copy.tryDownload);
        }
        const blob = await response.blob();
        if (!blob.size) throw new Error(copy.empty);
        const canPreviewInline =
          blob.type === "application/pdf" || blob.type.startsWith("text/");
        if (!canPreviewInline) {
          if (!active) return;
          setState("download-only");
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        if (!active) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
          return;
        }
        setDocumentUrl(objectUrl);
        setState("ready");
      })
      .catch((error) => {
        if (!active) return;
        setMessage(
          locale === "en" && error instanceof Error
            ? error.message
            : copy.tryDownload,
        );
        setState("error");
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [copy.empty, copy.tryDownload, locale, previewUrl]);

  return (
    <div
      className="application-document-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="application-document-title"
    >
      <div className="application-document-dialog">
        <header className="application-document-dialog__header">
          <div>
            <span>{copy.originalDocument}</span>
            <h2 id="application-document-title">{fileName ?? kindLabel}</h2>
          </div>
          <button
            type="button"
            className="ranking-icon-button"
            onClick={onClose}
            aria-label={copy.close}
          >
            <X aria-hidden="true" />
          </button>
        </header>
        <div className="application-document-dialog__body">
          {state === "loading" ? (
            <div className="application-document-dialog__state" role="status">
              <LoaderCircle aria-hidden="true" className="is-spinning" />
              <strong>{copy.loading}</strong>
            </div>
          ) : null}
          {state === "error" ? (
            <div
              className="application-document-dialog__state is-error"
              role="alert"
            >
              <AlertTriangle aria-hidden="true" />
              <strong>{copy.loadFailed}</strong>
              <p>{message}</p>
              <a href={downloadUrl} download={fileName ?? undefined}>
                {copy.downloadOriginal}
              </a>
            </div>
          ) : null}
          {state === "download-only" ? (
            <div className="application-document-dialog__state" role="status">
              <Download aria-hidden="true" />
              <strong>{copy.downloadOnlyTitle}</strong>
              <p>{copy.downloadOnlyDescription}</p>
              <a href={downloadUrl} download={fileName ?? undefined}>
                {copy.downloadOriginal}
              </a>
            </div>
          ) : null}
          {state === "ready" ? (
            <iframe
              title={copy.preview(kindLabel)}
              src={documentUrl ?? undefined}
              onLoad={() => setState("ready")}
              onError={() => {
                setState("error");
                setMessage(copy.tryDownload);
              }}
            />
          ) : null}
        </div>
        <footer className="application-document-dialog__footer">
          <a href={downloadUrl} download={fileName ?? undefined}>
            <Download aria-hidden="true" />{" "}
            {copy.downloadOriginalKind(kindLabel)}
          </a>
        </footer>
      </div>
    </div>
  );
}
