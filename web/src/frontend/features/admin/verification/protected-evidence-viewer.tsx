"use client";

import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Typography,
} from "@mui/material";
import { loadProtectedPdf } from "@/client-vendors/protected-pdf-viewer";
import { StepUpDialog } from "../auth/step-up-dialog";

function formatBytes(byteSize: number) {
  if (byteSize < 1_000) return `${byteSize} B`;
  if (byteSize < 1_000_000) return `${(byteSize / 1_000).toFixed(1)} KB`;
  return `${(byteSize / 1_000_000).toFixed(1)} MB`;
}

function CheckChip({ label, status }: { label: string; status: string }) {
  const normalized = status.toUpperCase();
  const color =
    normalized === "PASS"
      ? "success"
      : normalized === "PENDING"
        ? "warning"
        : "error";
  return (
    <Chip
      label={`${label}: ${status}`}
      size="small"
      color={color}
      variant={normalized === "PASS" ? "filled" : "outlined"}
    />
  );
}

type PdfDocument = {
  numPages: number;
  getPage(page: number): Promise<{
    getViewport(input: { scale: number }): { width: number; height: number };
    render(input: {
      canvasContext: CanvasRenderingContext2D;
      viewport: { width: number; height: number };
    }): { promise: Promise<void> };
  }>;
};

export function ProtectedEvidenceViewer(props: {
  requestId: string;
  evidenceId: string;
  mediaType: string;
  byteSize: number;
  malwareStatus: string;
  typeStatus: string;
  structureStatus: string;
  previewStatus: string;
  createdAt: string;
  submissionVersion: number;
  accessible: boolean;
  unavailabilityReason?:
    | "DELETED"
    | "CONTENT_RESTRICTED"
    | "SUPERSEDED"
    | "NOT_CURRENT_SUBMISSION"
    | "SAFETY_CHECK_INCOMPLETE"
    | "TARGET_COMPANY_INACTIVE"
    | null;
  readOnly?: boolean;
}) {
  const [imageUrl, setImageUrl] = useState<string>();
  const [pdf, setPdf] = useState<PdfDocument>();
  const [pdfPage, setPdfPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [failureMessage, setFailureMessage] = useState("");
  const [stepUpRequired, setStepUpRequired] = useState(false);
  const [retryAction, setRetryAction] = useState<
    "load" | "inline" | "attachment"
  >();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const popupRef = useRef<Window | null>(null);
  const headingId = `business-license-evidence-${props.evidenceId}`;
  const unavailableExplanation = {
    DELETED: "This file was deleted and cannot be retrieved for review.",
    CONTENT_RESTRICTED:
      "The stored file is no longer accessible to administrators.",
    SUPERSEDED: "A newer submission has replaced this file.",
    NOT_CURRENT_SUBMISSION:
      "This file is not the current submission for this request.",
    SAFETY_CHECK_INCOMPLETE:
      "At least one file safety or validation check is not complete or did not pass.",
    TARGET_COMPANY_INACTIVE:
      "The linked company is not currently active, so this evidence cannot be reviewed.",
  } as const;
  const unavailableMessage = props.unavailabilityReason
    ? unavailableExplanation[props.unavailabilityReason]
    : "This evidence is not currently available for review.";

  const evidenceUrl = `/api/admin/verification-requests/${encodeURIComponent(props.requestId)}/evidence/${encodeURIComponent(props.evidenceId)}`;

  async function readProtected(path: string) {
    const response = await fetch(path, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (response.ok) return response;
    const body = (await response.json().catch(() => ({}))) as {
      code?: string;
    };
    if (body.code === "STEP_UP_REQUIRED") {
      setStepUpRequired(true);
      throw new Error(
        "Fresh two-factor proof is required to view this evidence.",
      );
    }
    if (body.code === "EVIDENCE_UNAVAILABLE") {
      throw new Error("This evidence is no longer available for review.");
    }
    if (response.status === 410) {
      throw new Error("Evidence was deleted or is no longer available.");
    }
    throw new Error(
      props.mediaType === "application/pdf"
        ? "Protected PDF is unavailable."
        : "Protected image is unavailable.",
    );
  }

  async function load() {
    setRetryAction("load");
    setLoading(true);
    setFailed(false);
    setFailureMessage("");
    setImageUrl(undefined);
    setPdf(undefined);
    setPdfPage(1);
    try {
      if (props.mediaType === "application/pdf") {
        const response = await readProtected(
          `${evidenceUrl}/download?disposition=inline`,
        );
        const document = (await loadProtectedPdf(
          await response.arrayBuffer(),
        )) as PdfDocument;
        setPdf(document);
      } else if (
        props.mediaType === "image/png" ||
        props.mediaType === "image/jpeg"
      ) {
        const response = await readProtected(`${evidenceUrl}/preview`);
        const blob = await response.blob();
        if (blob.type !== "image/png")
          throw new Error("The protected preview format is unavailable.");
        setImageUrl(URL.createObjectURL(blob));
      } else {
        throw new Error(
          "This evidence type is unsupported for protected preview.",
        );
      }
    } catch (error) {
      setFailed(true);
      setFailureMessage(
        error instanceof Error
          ? error.message
          : "Protected evidence is unavailable.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function downloadEvidence(disposition: "inline" | "attachment") {
    setRetryAction(disposition);
    setLoading(true);
    setFailed(false);
    setFailureMessage("");
    let popup: Window | null = null;
    try {
      if (disposition === "inline") {
        popup =
          popupRef.current && !popupRef.current.closed
            ? popupRef.current
            : window.open("about:blank", "_blank");
        if (!popup) {
          throw new Error("Allow pop-ups to open the protected document.");
        }
        popupRef.current = popup;
        popup.opener = null;
      }
      const response = await readProtected(
        `${evidenceUrl}/download${disposition === "inline" ? "?disposition=inline" : ""}`,
      );
      const url = URL.createObjectURL(await response.blob());
      if (disposition === "inline") {
        popup!.location.href = url;
        popupRef.current = null;
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        const link = document.createElement("a");
        link.href = url;
        link.download = `business-license-${props.submissionVersion}.${props.mediaType === "application/pdf" ? "pdf" : props.mediaType === "image/png" ? "png" : "jpg"}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
      }
    } catch (error) {
      const awaitingStepUp =
        error instanceof Error &&
        error.message ===
          "Fresh two-factor proof is required to view this evidence.";
      if (!awaitingStepUp) {
        popup?.close();
        if (popupRef.current === popup) popupRef.current = null;
      }
      setFailed(true);
      setFailureMessage(
        error instanceof Error
          ? error.message
          : "Protected evidence is unavailable.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(
    () => () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    },
    [imageUrl],
  );

  useEffect(
    () => () => {
      popupRef.current?.close();
      popupRef.current = null;
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    async function renderPage() {
      if (!pdf || !canvasRef.current) return;
      const page = await pdf.getPage(pdfPage);
      if (cancelled || !canvasRef.current) return;
      const viewport = page.getViewport({ scale: zoom });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({
        canvasContext: canvas.getContext("2d")!,
        viewport,
      }).promise;
    }
    void renderPage().catch(() => {
      if (!cancelled) {
        setFailed(true);
        setFailureMessage("The protected PDF page could not be rendered.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pdf, pdfPage, zoom]);

  function resetView() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  function panBy(x: number, y: number) {
    setPan((current) => ({ x: current.x + x, y: current.y + y }));
  }

  return (
    <Paper
      component="section"
      aria-labelledby={headingId}
      variant="outlined"
      sx={{ p: 2, display: "grid", gap: 1.5 }}
    >
      <Box
        sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}
      >
        <Typography
          id={headingId}
          component="h2"
          variant="h6"
          sx={{ mr: "auto" }}
        >
          Business license evidence
        </Typography>
        <Chip
          label={
            props.accessible
              ? props.readOnly
                ? "Available"
                : "Ready for admin review"
              : "Unavailable for review"
          }
          color={props.accessible ? "success" : "warning"}
        />
        <Chip label={props.mediaType} variant="outlined" />
      </Box>
      <Box
        aria-label="Evidence file details"
        sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}
      >
        <Chip
          label={`Submission ${props.submissionVersion}`}
          size="small"
          variant="outlined"
        />
        <Chip
          label={`Uploaded ${new Date(props.createdAt).toLocaleString()}`}
          size="small"
          variant="outlined"
        />
        <Chip
          label={formatBytes(props.byteSize)}
          size="small"
          variant="outlined"
        />
      </Box>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        <CheckChip label="Malware scan" status={props.malwareStatus} />
        <CheckChip label="File type" status={props.typeStatus} />
        <CheckChip label="Structure" status={props.structureStatus} />
        <CheckChip label="Preview" status={props.previewStatus} />
      </Box>
      {!props.accessible && (
        <Alert severity="warning">
          <strong>Evidence unavailable for review.</strong> {unavailableMessage}
        </Alert>
      )}
      {failed && (
        <Alert severity="error">
          {failureMessage ||
            `Protected evidence is unavailable${props.readOnly ? "." : "; decisions remain disabled."}`}
        </Alert>
      )}
      {props.accessible && (
        <Box
          sx={{
            display: "flex",
            gap: 1,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <Button onClick={() => void load()} disabled={loading}>
            {loading
              ? "Opening protected evidence"
              : props.mediaType === "application/pdf"
                ? "Open PDF.js viewer"
                : "Preview document"}
          </Button>
          <Button
            component="a"
            href={`${evidenceUrl}/download?disposition=inline`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => {
              event.preventDefault();
              void downloadEvidence("inline");
            }}
            disabled={loading}
          >
            Open full document
          </Button>
          <Button
            component="a"
            href={`${evidenceUrl}/download`}
            onClick={(event) => {
              event.preventDefault();
              void downloadEvidence("attachment");
            }}
            disabled={loading}
          >
            Download authenticated copy
          </Button>
        </Box>
      )}
      {loading && <CircularProgress aria-label="Loading protected evidence" />}
      {(imageUrl || pdf) && (
        <Box
          component="section"
          aria-label="Protected evidence controls"
          sx={{ display: "grid", gap: 1 }}
        >
          <Box
            sx={{
              display: "flex",
              gap: 0.5,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <Button
              onClick={() => setZoom((value) => Math.min(4, value + 0.25))}
              aria-label="Zoom in"
            >
              Zoom in
            </Button>
            <Button
              onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))}
              aria-label="Zoom out"
            >
              Zoom out
            </Button>
            <Button onClick={resetView} aria-label="Reset evidence view">
              Reset
            </Button>
            <IconButton
              onClick={() => panBy(0, -40)}
              aria-label="Pan evidence up"
            >
              ↑
            </IconButton>
            <IconButton
              onClick={() => panBy(-40, 0)}
              aria-label="Pan evidence left"
            >
              ←
            </IconButton>
            <IconButton
              onClick={() => panBy(40, 0)}
              aria-label="Pan evidence right"
            >
              →
            </IconButton>
            <IconButton
              onClick={() => panBy(0, 40)}
              aria-label="Pan evidence down"
            >
              ↓
            </IconButton>
            {pdf && (
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 1, ml: 1 }}
              >
                <Button
                  disabled={pdfPage <= 1}
                  onClick={() => setPdfPage((value) => value - 1)}
                >
                  Previous page
                </Button>
                <Typography aria-live="polite">
                  Page {pdfPage} of {pdf.numPages}
                </Typography>
                <Button
                  disabled={pdfPage >= pdf.numPages}
                  onClick={() => setPdfPage((value) => value + 1)}
                >
                  Next page
                </Button>
              </Box>
            )}
          </Box>
          <Box
            tabIndex={0}
            aria-label="Evidence viewer; use arrow controls to pan"
            onKeyDown={(event) => {
              if (event.key === "ArrowUp") panBy(0, -40);
              if (event.key === "ArrowDown") panBy(0, 40);
              if (event.key === "ArrowLeft") panBy(-40, 0);
              if (event.key === "ArrowRight") panBy(40, 0);
            }}
            sx={{
              overflow: "auto",
              maxHeight: "60vh",
              border: 1,
              borderColor: "divider",
              p: 1,
            }}
          >
            {imageUrl && (
              // The URL is an in-memory blob produced only from authenticated,
              // server-normalized preview bytes.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt="Protected business license preview"
                style={{
                  maxWidth: "100%",
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: "top left",
                }}
              />
            )}
            {pdf && (
              <canvas
                ref={canvasRef}
                aria-label={`Protected PDF page ${pdfPage}`}
                style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
              />
            )}
          </Box>
        </Box>
      )}
      <StepUpDialog
        open={stepUpRequired}
        id={`evidence-${props.evidenceId}`}
        onCancel={() => {
          popupRef.current?.close();
          popupRef.current = null;
          setStepUpRequired(false);
          setRetryAction(undefined);
        }}
        onVerified={() => {
          const action = retryAction;
          setStepUpRequired(false);
          setRetryAction(undefined);
          if (action === "inline" || action === "attachment")
            void downloadEvidence(action);
          else void load();
        }}
      />
    </Paper>
  );
}
