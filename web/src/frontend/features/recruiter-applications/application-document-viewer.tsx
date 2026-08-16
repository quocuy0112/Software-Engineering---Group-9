"use client";

import { useState } from "react";

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
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const previewUrl = `/api/recruiter/jobs/${encodeURIComponent(jobId)}/applications/${encodeURIComponent(applicationId)}/documents/${kind}`;
  const downloadUrl = `${previewUrl}/download`;

  return (
    <div className="application-document-overlay" role="dialog" aria-modal="true" aria-labelledby="application-document-title">
      <div className="application-document-dialog">
        <button type="button" onClick={onClose} aria-label="Close document viewer">Close</button>
        <h2 id="application-document-title">{fileName ?? (kind === "cv" ? "Original CV" : "Cover letter")}</h2>
        {state === "loading" ? <p role="status">Loading document preview…</p> : null}
        {state === "error" ? <p role="alert">{message} Download the original file instead.</p> : null}
        {state !== "error" ? (
          <iframe title={`${kind === "cv" ? "CV" : "Cover letter"} preview`} src={previewUrl} onLoad={() => setState("ready")} onError={() => { setState("error"); setMessage("The original document could not be previewed."); }} />
        ) : null}
        <a href={downloadUrl} download={fileName ?? undefined}>Download original {kind === "cv" ? "CV" : "cover letter"}</a>
      </div>
    </div>
  );
}
