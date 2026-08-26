"use client";
import { useState } from "react";
import { currentAdminCsrfToken } from "../app/auth-provider";
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from "@mui/material";

export function StepUpDialog(props: {
  open: boolean;
  onCancel: () => void;
  onVerified: () => void;
  id?: string;
}) {
  const [code, setCode] = useState("");
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function cancel() {
    setCode("");
    setFailureMessage(null);
    setSubmitting(false);
    props.onCancel();
  }

  async function verify() {
    setFailureMessage(null);
    const csrfToken = currentAdminCsrfToken();
    if (!csrfToken) {
      setFailureMessage(
        "Your admin session needs to be refreshed. Close this dialog and sign in again.",
      );
      return;
    }
    setSubmitting(true);
    const headers = new Headers({
      "content-type": "application/json",
      "x-csrf-token": csrfToken,
    });
    try {
      const response = await fetch("/api/admin/auth/step-up", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers,
        body: JSON.stringify({ code: code.trim(), factor: "totp" }),
      });
      if (!response.ok) {
        setFailureMessage(
          response.status === 429
            ? "Too many attempts. Wait before trying another authenticator code."
            : "The authenticator code was not accepted. Check that it is current and try again.",
        );
        return;
      }
      setCode("");
      props.onVerified();
    } catch {
      setFailureMessage(
        "Verification could not be completed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <Dialog
      open={props.open}
      onClose={cancel}
      aria-labelledby={`step-up-title-${props.id ?? "default"}`}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle id={`step-up-title-${props.id ?? "default"}`}>
        Verify sensitive action
      </DialogTitle>
      <DialogContent dividers>
        <DialogContentText sx={{ mb: 2 }}>
          Enter the current six-digit code from your authenticator app. The
          verification remains valid for 15 minutes.
        </DialogContentText>
        {failureMessage && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {failureMessage}
          </Alert>
        )}
        <TextField
          value={code}
          onChange={(event) => setCode(event.target.value)}
          label="Six-digit authenticator code"
          inputProps={{
            inputMode: "numeric",
            pattern: "[0-9]{6}",
            maxLength: 6,
          }}
          autoComplete="one-time-code"
          autoFocus
          fullWidth
          margin="none"
          disabled={submitting}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={cancel} disabled={submitting}>
          Cancel
        </Button>
        <Button
          onClick={verify}
          variant="contained"
          disabled={!/^\d{6}$/u.test(code) || submitting}
          startIcon={
            submitting ? <CircularProgress color="inherit" size={16} /> : null
          }
        >
          {submitting ? "Verifying…" : "Verify"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
