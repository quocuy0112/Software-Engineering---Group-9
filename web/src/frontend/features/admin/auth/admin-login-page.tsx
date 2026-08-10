"use client";
import { useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
} from "@mui/material";
import { AdminTwoFactorPage } from "./admin-two-factor-page";

export function AdminLoginPage() {
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const [needsFactor, setNeedsFactor] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(false);
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: String(data.get("email") ?? ""),
          password: String(data.get("password") ?? ""),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.requiresTwoFactor !== true)
        throw new Error("UNAUTHORIZED");
      setNeedsFactor(true);
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }
  if (needsFactor)
    return (
      <AdminTwoFactorPage onComplete={() => window.location.assign("/")} />
    );
  return (
    <Box
      component="main"
      sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 2 }}
    >
      <Card sx={{ width: "min(100%, 420px)" }}>
        <CardContent>
          <Typography component="h1" variant="h5">
            Platform administrator sign in
          </Typography>
          {error && (
            <Alert severity="error" sx={{ my: 2 }}>
              Sign-in could not be completed.
            </Alert>
          )}
          <Box
            component="form"
            onSubmit={submit}
            sx={{ display: "grid", gap: 2, mt: 2 }}
          >
            <TextField
              name="email"
              label="Email"
              type="email"
              required
              autoComplete="username"
              autoFocus
            />
            <TextField
              name="password"
              label="Password"
              type="password"
              required
              autoComplete="current-password"
            />
            <Button type="submit" variant="contained" disabled={pending}>
              {pending ? "Signing in…" : "Continue"}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
