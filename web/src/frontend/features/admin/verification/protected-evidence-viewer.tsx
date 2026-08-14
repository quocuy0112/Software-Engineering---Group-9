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

function formatBytes(byteSize: number) {
  if (byteSize < 1_000) return `${byteSize} B`;
  if (byteSize < 1_000_000) return `${(byteSize / 1_000).toFixed(1)} KB`;
  return `${(byteSize / 1_000_000).toFixed(1)} MB`;
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const headingId = `business-license-evidence-${props.evidenceId}`;

  const evidenceUrl = `/api/admin/verification-requests/${encodeURIComponent(props.requestId)}/evidence/${encodeURIComponent(props.evidenceId)}`;

  async function load() {
    setLoading(true);
    setFailed(false);
    setFailureMessage("");
    setImageUrl(undefined);
    setPdf(undefined);
    setPdfPage(1);
    try {
      if (props.mediaType === "application/pdf") {
        const response = await fetch(
          `${evidenceUrl}/download?disposition=inline`,
          {
            cache: "no-store",
            credentials: "same-origin",
          },
        );
        if (!response.ok)
          throw new Error(
            response.status === 410
              ? "Evidence was deleted or is no longer available."
              : "Protected PDF is unavailable.",
          );
        const document = (await loadProtectedPdf(
          await response.arrayBuffer(),
        )) as PdfDocument;
        setPdf(document);
      } else if (
        props.mediaType === "image/png" ||
        props.mediaType === "image/jpeg"
      ) {
        const response = await fetch(`${evidenceUrl}/preview`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok)
          throw new Error(
            response.status === 410
              ? "Evidence was deleted or is no longer available."
              : "Protected image is unavailable.",
          );
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

  useEffect(
    () => () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    },
    [imageUrl],
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
      <Typography color="text.secondary" variant="body2">
        Submission {props.submissionVersion}; uploaded{" "}
        {new Date(props.createdAt).toLocaleString()}; size{" "}
        {formatBytes(props.byteSize)}.
      </Typography>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        <Chip label={`Malware scan: ${props.malwareStatus}`} size="small" />
        <Chip label={`File type: ${props.typeStatus}`} size="small" />
        <Chip label={`Structure: ${props.structureStatus}`} size="small" />
        <Chip label={`Preview: ${props.previewStatus}`} size="small" />
      </Box>
      {!props.accessible && (
        <Alert severity="warning">
          This evidence is not qualified, has expired, or is inaccessible.
          {!props.readOnly && " Decisions are disabled."}
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
          >
            Open full document
          </Button>
          <Button component="a" href={`${evidenceUrl}/download`}>
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
    </Paper>
  );
}
