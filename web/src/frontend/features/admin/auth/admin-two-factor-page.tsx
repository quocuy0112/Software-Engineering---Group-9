"use client";
import { useState, type FormEvent } from "react";
import { Alert, Box, Button, TextField, Typography } from "@mui/material";

export function AdminTwoFactorPage(props: { onComplete: () => void }) {
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(false);
    setPending(true);
    const code = String(new FormData(event.currentTarget).get("code") ?? "");
    try {
      const response = await fetch("/api/admin/auth/two-factor", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, factor: "totp" }),
      });
      if (!response.ok) return setError(true);
      props.onComplete();
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }
  return (
    <Box
      component="form"
      onSubmit={submit}
      sx={{ display: "grid", gap: 2, maxWidth: 420, m: "10vh auto", p: 3 }}
    >
      <Typography component="h1" variant="h5">
        Two-factor verification
      </Typography>
      {error && (
        <Alert severity="error">The verification code was not accepted.</Alert>
      )}
      <TextField
        name="code"
        label="Six-digit authenticator code"
        inputProps={{ inputMode: "numeric", pattern: "[0-9]{6}", maxLength: 6 }}
        required
        autoFocus
      />
      <Button type="submit" variant="contained" disabled={pending}>
        {pending ? "Verifying…" : "Verify and designate this session"}
      </Button>
    </Box>
  );
}
