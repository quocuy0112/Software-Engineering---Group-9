"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Download, LoaderCircle, X } from "lucide-react";

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
        Accept: "application/pdf, application/octet-stream, text/plain",
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            message?: unknown;
          } | null;
          throw new Error(
            typeof payload?.message === "string"
              ? payload.message
              : "Couldn't load document — try downloading the original.",
          );
        }
        const blob = await response.blob();
        if (!blob.size) throw new Error("The document is empty.");
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
          error instanceof Error
            ? error.message
            : "Couldn't load document — try downloading the original.",
        );
        setState("error");
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [previewUrl]);

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
            <span>Original document</span>
            <h2 id="application-document-title">
              {fileName ?? (kind === "cv" ? "Original CV" : "Cover letter")}
            </h2>
          </div>
          <button
            type="button"
            className="ranking-icon-button"
            onClick={onClose}
            aria-label="Close document viewer"
          >
            <X aria-hidden="true" />
          </button>
        </header>
        <div className="application-document-dialog__body">
          {state === "loading" ? (
            <div className="application-document-dialog__state" role="status">
              <LoaderCircle aria-hidden="true" className="is-spinning" />
              <strong>Loading document preview</strong>
            </div>
          ) : null}
          {state === "error" ? (
            <div
              className="application-document-dialog__state is-error"
              role="alert"
            >
              <AlertTriangle aria-hidden="true" />
              <strong>Couldn&apos;t load document</strong>
              <p>{message}</p>
              <a href={downloadUrl} download={fileName ?? undefined}>
                Download original file
              </a>
            </div>
          ) : null}
          {state === "download-only" ? (
            <div className="application-document-dialog__state" role="status">
              <Download aria-hidden="true" />
              <strong>Original file is ready</strong>
              <p>
                This Word document cannot be reliably previewed in the browser.
                Download it to view the full CV or cover letter.
              </p>
              <a href={downloadUrl} download={fileName ?? undefined}>
                Download original file
              </a>
            </div>
          ) : null}
          {state === "ready" ? (
            <iframe
              title={`${kind === "cv" ? "CV" : "Cover letter"} preview`}
              src={documentUrl ?? undefined}
              onLoad={() => setState("ready")}
              onError={() => {
                setState("error");
                setMessage(
                  "Couldn't load document — try downloading the original.",
                );
              }}
            />
          ) : null}
        </div>
        <footer className="application-document-dialog__footer">
          <a href={downloadUrl} download={fileName ?? undefined}>
            <Download aria-hidden="true" /> Download original{" "}
            {kind === "cv" ? "CV" : "cover letter"}
          </a>
        </footer>
      </div>
    </div>
  );
}
