"use client";
import { useState } from "react";
import { Alert, Button, Typography } from "@mui/material";
export function PrivilegedRationaleDetail({
  correlationId,
}: {
  correlationId: string;
}) {
  const [text, setText] = useState<string>();
  const [failed, setFailed] = useState(false);
  async function load() {
    const response = await fetch(
      `/api/admin/actions/${encodeURIComponent(correlationId)}/rationale`,
      { cache: "no-store", credentials: "same-origin" },
    );
    if (!response.ok) return setFailed(true);
    setText((await response.json()).rationale);
  }
  return (
    <div>
      {failed && (
        <Alert severity="warning">
          Rationale is unavailable or fresh two-factor proof is required.
        </Alert>
      )}
      {text ? (
        <Typography sx={{ whiteSpace: "pre-wrap" }}>{text}</Typography>
      ) : (
        <Button onClick={load}>View private rationale</Button>
      )}
    </div>
  );
}
