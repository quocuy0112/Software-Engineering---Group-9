"use client";
import { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";

export function StepUpDialog(props: {
  open: boolean;
  onCancel: () => void;
  onVerified: () => void;
}) {
  const [code, setCode] = useState("");
  const [failed, setFailed] = useState(false);
  async function verify() {
    setFailed(false);
    const response = await fetch("/api/admin/auth/step-up", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, factor: "totp" }),
    });
    if (!response.ok) return setFailed(true);
    setCode("");
    props.onVerified();
  }
  return (
    <Dialog
      open={props.open}
      onClose={props.onCancel}
      aria-labelledby="step-up-title"
    >
      <DialogTitle id="step-up-title">Confirm sensitive action</DialogTitle>
      <DialogContent>
        {failed && (
          <Alert severity="error" sx={{ mb: 2 }}>
            The verification code was not accepted.
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
          autoFocus
          fullWidth
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onCancel}>Cancel</Button>
        <Button
          onClick={verify}
          variant="contained"
          disabled={!/^\d{6}$/u.test(code)}
        >
          Verify
        </Button>
      </DialogActions>
    </Dialog>
  );
}
