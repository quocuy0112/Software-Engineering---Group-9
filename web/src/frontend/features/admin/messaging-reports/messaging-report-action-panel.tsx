"use client";

import { useState } from "react";
import { Alert, Box, Button, TextField } from "@mui/material";
import { adminDataProvider } from "../app/data-provider";

export function MessagingReportActionPanel(props: {
  reportId: string;
  version: number;
  state: string;
  onDone: () => void;
}) {
  const [note, setNote] = useState("");
  const [enforcement, setEnforcement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function command(
    action: string,
    body: object = { confirmation: true },
  ) {
    setError(null);
    setBusy(true);
    try {
      await adminDataProvider.command(
        `/api/admin/messaging-reports/${encodeURIComponent(props.reportId)}/${action}`,
        body,
        props.version,
        crypto.randomUUID(),
      );
      if (action === "note") setNote("");
      props.onDone();
    } catch (caught) {
      const code =
        caught && typeof caught === "object" && "code" in caught
          ? String(caught.code)
          : "INTERNAL_FAILURE";
      setError(code);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box component="section" aria-label="Messaging report actions" sx={{ display: "grid", gap: 2 }}>
      {error ? (
        <Alert severity="warning">
          {error === "STALE_CONFLICT"
            ? "This report changed. Refresh before retrying."
            : "The action was not completed. Verify authorization and retry."}
        </Alert>
      ) : null}
      {props.state === "PENDING_REVIEW" ? (
        <>
          <Button disabled={busy} onClick={() => void command("assign")}>
            Assign to me
          </Button>
          <TextField
            label="Private investigation note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            multiline
            inputProps={{ maxLength: 2000 }}
            helperText={`${Array.from(note).length}/2000`}
          />
          <Button
            disabled={busy || !note.trim()}
            onClick={() =>
              void command("note", { confirmation: true, note })
            }
          >
            Add private note
          </Button>
          <Button
            disabled={busy}
            variant="contained"
            onClick={() => void command("resolve")}
          >
            Resolve report
          </Button>
          <Button disabled={busy} onClick={() => void command("dismiss")}>
            Dismiss report
          </Button>
        </>
      ) : null}
      <TextField
        label="Authorized enforcement correlation reference"
        value={enforcement}
        onChange={(event) => setEnforcement(event.target.value)}
        inputProps={{ maxLength: 128 }}
      />
      <Button
        disabled={busy || enforcement.trim().length < 8}
        onClick={() =>
          void command("link-enforcement", {
            confirmation: true,
            enforcementCorrelationId: enforcement.trim(),
          })
        }
      >
        Link separately confirmed enforcement
      </Button>
    </Box>
  );
}
