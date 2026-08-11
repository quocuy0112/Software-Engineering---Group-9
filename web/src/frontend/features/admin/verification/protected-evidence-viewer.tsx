"use client";

import { useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress } from "@mui/material";

export function ProtectedEvidenceViewer(props: {
  requestId: string;
  evidenceId: string;
  mediaType: string;
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

  if (!props.accessible)
    return (
      <Alert severity="warning">
        This evidence is not qualified or is inaccessible. Decisions are
        disabled.
      </Alert>
    );

  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      {failed && (
        <Alert severity="error">
          Protected evidence is unavailable; decisions remain disabled.
        </Alert>
      )}
      <Button onClick={() => void load()} disabled={loading}>
        {loading ? "Opening protected evidence" : "Open protected evidence"}
      </Button>
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
      <Button
        component="a"
        href={`/api/admin/verification-requests/${encodeURIComponent(props.requestId)}/evidence/${encodeURIComponent(props.evidenceId)}/download`}
      >
        Download authenticated copy
      </Button>
    </Box>
  );
}
