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
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { recruitmentAnalyticsCopy } from "./recruitment-analytics-copy";

function idempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return "analytics-export-" + crypto.randomUUID();
  }
  return "analytics-export-" + Date.now() + "-" + Math.random().toString(36);
}

async function responseError(_response: Response, fallback: string) {
  // API errors are intentionally reduced to a localised UI message. Raw
  // server messages may be in a different language than the active workspace.
  return fallback;
}

export function CandidateExportPanel({
  jobId,
  jobTitle,
}: {
  jobId: string;
  jobTitle: string;
}) {
  const locale = useWorkspaceLocale();
  const copy = recruitmentAnalyticsCopy(locale);
  const exportCopy = copy.export;
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
        setMessage(await responseError(response, exportCopy.startError));
        setStatus(null);
        return;
      }
      const body = await response.json().catch(() => null);
      const parsed = exportStatusSchema.safeParse(body);
      if (!parsed.success) {
        setMessage(exportCopy.responseError);
        setStatus(null);
        return;
      }
      setStatus(parsed.data);
      setMessage(
        parsed.data.status === "SUCCEEDED"
          ? exportCopy.fileReady
          : exportCopy.preparingMessage,
      );
    } catch {
      setMessage(exportCopy.networkExportError);
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
      const exportUrl =
        "/api/recruiter/analytics/jobs/" +
        encodeURIComponent(jobId) +
        "/exports/" +
        encodeURIComponent(status.id);
      let response = await fetch(exportUrl + "/download", {
        cache: "no-store",
      });
      // A long-running Next dev process can retain an older route manifest
      // after a nested route is added. The query form uses the already-loaded
      // status handler and keeps existing exports downloadable until restart.
      if (!response.ok && response.status === 404) {
        response = await fetch(exportUrl + "?download=1", {
          cache: "no-store",
        });
      }
      if (!response.ok) {
        setMessage(await responseError(response, exportCopy.downloadError));
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
      setMessage(exportCopy.downloadStarted);
    } catch {
      setMessage(exportCopy.networkDownloadError);
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
      aria-label={exportCopy.panelFor(jobTitle)}
    >
      <div className="candidate-export-panel__controls">
        <label>
          <span className="sr-only">{exportCopy.format}</span>
          <select
            value={format}
            onChange={(event) => setFormat(event.target.value as ExportFormat)}
            disabled={processing}
            aria-label={exportCopy.formatFor(jobTitle)}
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
          {processing ? exportCopy.preparing : exportCopy.export}
        </button>
        {canDownload ? (
          <button
            type="button"
            className="candidate-export-panel__download"
            onClick={() => void downloadExport()}
            disabled={busy}
          >
            <Download aria-hidden="true" />
            {exportCopy.download}
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
          {exportCopy.status[status.status]}
          {status.rowCount !== null
            ? " · " +
              exportCopy.rows(status.rowCount.toLocaleString(copy.locale))
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
