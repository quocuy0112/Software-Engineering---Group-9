"use client";
import { useState } from "react";
import { Alert, Box, Button, TextField } from "@mui/material";
import { adminDataProvider } from "../app/data-provider";
export function ReportActionPanel(props: {
  reportId: string;
  version: number;
  state: string;
  onDone: () => void;
}) {
  const [note, setNote] = useState("");
  const [enforcement, setEnforcement] = useState("");
  const [error, setError] = useState(false);
  async function command(
    action: string,
    body: object = { confirmation: true },
  ) {
    setError(false);
    try {
      await adminDataProvider.command(
        `/api/admin/moderation-reports/${encodeURIComponent(props.reportId)}/${action}`,
        body,
        props.version,
        crypto.randomUUID(),
      );
      props.onDone();
    } catch {
      setError(true);
    }
  }
  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      {error && (
        <Alert severity="warning">
          The report changed or the action was not authorized. Refresh before
          retrying.
        </Alert>
      )}
      {props.state === "PENDING_REVIEW" && (
        <>
          <Button onClick={() => command("assign")}>Assign to me</Button>
          <TextField
            label="Private investigation note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
            inputProps={{ maxLength: 2000 }}
          />
          <Button
            disabled={!note.trim()}
            onClick={() => command("note", { confirmation: true, note })}
          >
            Add private note
          </Button>
          <Button variant="contained" onClick={() => command("resolve")}>
            Resolve report
          </Button>
          <Button onClick={() => command("dismiss")}>Dismiss report</Button>
        </>
      )}
      <TextField
        label="Authorized enforcement correlation reference"
        value={enforcement}
        onChange={(e) => setEnforcement(e.target.value)}
      />
      <Button
        disabled={enforcement.length < 8}
        onClick={() =>
          command("link-enforcement", {
            confirmation: true,
            enforcementCorrelationId: enforcement,
          })
        }
      >
        Link separately confirmed enforcement
      </Button>
    </Box>
  );
}
