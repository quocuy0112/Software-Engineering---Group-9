"use client";

import { useEffect, useState } from "react";
import { Download, FileSpreadsheet, LoaderCircle } from "lucide-react";
import {
  exportStatusSchema,
  type ExportFormat,
  type ExportStatus,
} from "@/shared/contracts/analytics/exports";
import { useCsrfProof } from "@/frontend/features/authentication/client/csrf-proof-context";
import { mutateWithCurrentCsrf } from "@/frontend/features/authentication/client/current-csrf-proof";

function idempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return "analytics-export-" + crypto.randomUUID();
  }
  return "analytics-export-" + Date.now() + "-" + Math.random().toString(36);
}

async function responseError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as {
    message?: unknown;
    code?: unknown;
  } | null;
  return typeof body?.message === "string"
    ? body.message
    : typeof body?.code === "string"
      ? body.code
      : fallback;
}

function statusLabel(status: ExportStatus["status"]) {
  return {
    QUEUED: "Queued",
    PROCESSING: "Preparing file",
    SUCCEEDED: "Ready to download",
    FAILED: "Export failed",
    EXPIRED: "Export expired",
  }[status];
}

export function CandidateExportPanel({
  jobId,
  jobTitle,
}: {
  jobId: string;
  jobTitle: string;
}) {
  const csrfProof = useCsrfProof();
  const [format, setFormat] = useState<ExportFormat>("CSV");
  const [status, setStatus] = useState<ExportStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (
      !status ||
      (status.status !== "QUEUED" && status.status !== "PROCESSING")
    ) {
      return;
    }

    let cancelled = false;
    const poll = async () => {
      const response = await fetch(
        "/api/recruiter/analytics/jobs/" +
          encodeURIComponent(jobId) +
          "/exports/" +
          encodeURIComponent(status.id),
        { cache: "no-store" },
      );
      if (!response.ok) return;
      const body = await response.json().catch(() => null);
      const parsed = exportStatusSchema.safeParse(body);
      if (!cancelled && parsed.success) setStatus(parsed.data);
    };
    const intervalId = window.setInterval(() => void poll(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [jobId, status]);

  async function requestExport() {
    setBusy(true);
    setMessage("");
    try {
      const response = await mutateWithCurrentCsrf(
        "/api/recruiter/analytics/jobs/" +
          encodeURIComponent(jobId) +
          "/exports",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "idempotency-key": idempotencyKey(),
          },
          body: JSON.stringify({ format }),
        },
        csrfProof,
      );
      if (!response.ok) {
        setMessage(
          await responseError(response, "The export could not be started."),
        );
        setStatus(null);
        return;
      }
      const body = await response.json().catch(() => null);
      const parsed = exportStatusSchema.safeParse(body);
      if (!parsed.success) {
        setMessage("The export response was invalid.");
        setStatus(null);
        return;
      }
      setStatus(parsed.data);
      setMessage(
        parsed.data.status === "SUCCEEDED"
          ? "Your file is ready."
          : "Your export is being prepared.",
      );
    } catch {
      setMessage("Network error. Try exporting again.");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  async function downloadExport() {
    if (!status?.downloadAvailable) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        "/api/recruiter/analytics/jobs/" +
          encodeURIComponent(jobId) +
          "/exports/" +
          encodeURIComponent(status.id) +
          "/download",
        { cache: "no-store" },
      );
      if (!response.ok) {
        setMessage(
          await responseError(response, "The download is unavailable."),
        );
        return;
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const disposition = response.headers.get("content-disposition") ?? "";
      const fileName =
        /filename="([^"]+)"/u.exec(disposition)?.[1] ??
        (jobTitle.replace(/[^a-z0-9]+/giu, "-").toLowerCase() || "candidates") +
          "." +
          format.toLowerCase();
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      setMessage("Download started.");
    } catch {
      setMessage("Network error. Try downloading again.");
    } finally {
      setBusy(false);
    }
  }

  const canDownload = status?.downloadAvailable === true;
  const processing =
    busy || status?.status === "QUEUED" || status?.status === "PROCESSING";

  return (
    <div
      className="candidate-export-panel"
      aria-label={"Export candidates for " + jobTitle}
    >
      <div className="candidate-export-panel__controls">
        <label>
          <span className="sr-only">Export format</span>
          <select
            value={format}
            onChange={(event) => setFormat(event.target.value as ExportFormat)}
            disabled={processing}
            aria-label={"Export format for " + jobTitle}
          >
            <option value="CSV">CSV</option>
            <option value="XLSX">Excel</option>
          </select>
        </label>
        <button
          type="button"
          className="candidate-export-panel__button"
          onClick={() => void requestExport()}
          disabled={processing}
          aria-busy={processing}
        >
          {processing ? (
            <LoaderCircle className="is-spinning" aria-hidden="true" />
          ) : (
            <FileSpreadsheet aria-hidden="true" />
          )}
          {processing ? "Preparing…" : "Export"}
        </button>
        {canDownload ? (
          <button
            type="button"
            className="candidate-export-panel__download"
            onClick={() => void downloadExport()}
            disabled={busy}
          >
            <Download aria-hidden="true" />
            Download
          </button>
        ) : null}
      </div>
      {status ? (
        <p
          className="candidate-export-panel__status"
          data-tone={
            status.status === "FAILED" || status.status === "EXPIRED"
              ? "error"
              : status.status === "SUCCEEDED"
                ? "success"
                : "info"
          }
          role="status"
          aria-live="polite"
        >
          {statusLabel(status.status)}
          {status.rowCount !== null
            ? " · " + status.rowCount.toLocaleString("en-US") + " rows"
            : ""}
        </p>
      ) : null}
      {message ? (
        <p
          className="candidate-export-panel__message"
          role={
            message.includes("error") || message.includes("unavailable")
              ? "alert"
              : "status"
          }
          aria-live="polite"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
