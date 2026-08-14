"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Typography,
} from "@mui/material";

function formatBytes(byteSize: number) {
  if (byteSize < 1_000) return `${byteSize} B`;
  if (byteSize < 1_000_000) return `${(byteSize / 1_000).toFixed(1)} KB`;
  return `${(byteSize / 1_000_000).toFixed(1)} MB`;
}

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
}) {
  const [imageUrl, setImageUrl] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function load() {
    setLoading(true);
    setFailed(false);
    try {
      const response = await fetch(
        `/api/admin/verification-requests/${encodeURIComponent(props.requestId)}/evidence/${encodeURIComponent(props.evidenceId)}/preview`,
        { cache: "no-store", credentials: "same-origin" },
      );
      if (!response.ok) throw new Error("PROTECTED_EVIDENCE_UNAVAILABLE");
      const blob = await response.blob();
      if (blob.type !== "image/png") throw new Error("PREVIEW_TYPE_INVALID");
      setImageUrl(URL.createObjectURL(blob));
    } catch {
      setFailed(true);
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

  const evidenceUrl = `/api/admin/verification-requests/${encodeURIComponent(props.requestId)}/evidence/${encodeURIComponent(props.evidenceId)}`;

  return (
    <Paper
      component="section"
      aria-labelledby="business-license-evidence"
      variant="outlined"
      sx={{ p: 2, display: "grid", gap: 1.5 }}
    >
      <Box
        sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}
      >
        <Typography
          id="business-license-evidence"
          component="h2"
          variant="h6"
          sx={{ mr: "auto" }}
        >
          Business license evidence
        </Typography>
        <Chip
          label={
            props.accessible
              ? "Ready for admin review"
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
          This evidence is not qualified or is inaccessible. Decisions are
          disabled.
        </Alert>
      )}
      {failed && (
        <Alert severity="error">
          Protected evidence is unavailable; decisions remain disabled.
        </Alert>
      )}
      {props.accessible && (
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Button onClick={() => void load()} disabled={loading}>
            {loading
              ? "Opening protected evidence"
              : props.mediaType === "application/pdf"
                ? "Preview first PDF page"
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
      {imageUrl && (
        // The URL is an in-memory blob produced only from authenticated,
        // server-normalized preview bytes.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt="Protected business license preview"
          style={{ maxWidth: "100%" }}
        />
      )}
    </Paper>
  );
}
