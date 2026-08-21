"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { currentAdminCsrfToken } from "../app/auth-provider";

type Settings = {
  enabled: boolean;
  intervalSeconds: number;
  updatedAt?: string | null;
};
type Run = {
  id: string;
  trigger: "MANUAL" | "SCHEDULED";
  status: "QUEUED" | "LEASED" | "SUCCEEDED" | "FAILED";
  requestedAt: string;
  completedAt?: string | null;
  byteCount?: number | null;
  checksum?: string | null;
  failureCode?: string | null;
};

async function backupApi(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const csrf = currentAdminCsrfToken();
  headers.set("content-type", "application/json");
  if (init.method && init.method !== "GET" && csrf)
    headers.set("x-csrf-token", csrf);
  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.code ?? "BACKUP_REQUEST_FAILED");
  return data;
}

function backupErrorMessage(error: unknown, fallback: string) {
  const code = error instanceof Error ? error.message : fallback;
  if (code === "STEP_UP_REQUIRED")
    return "Your two-factor verification has expired. Sign out, sign in again, and verify your authenticator code to access Backup Settings.";
  return code;
}

export function BackupSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [interval, setIntervalValue] = useState("60");
  const [message, setMessage] = useState("");
  const [stepUpRequired, setStepUpRequired] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const [nextSettings, nextRuns] = await Promise.all([
      backupApi("/api/admin/backup"),
      backupApi("/api/admin/backup/runs"),
    ]);
    setSettings(nextSettings);
    setIntervalValue(String(nextSettings.intervalSeconds));
    setRuns(nextRuns);
  }, []);
  useEffect(() => {
    void load().catch((error: unknown) => {
      setStepUpRequired(
        error instanceof Error && error.message === "STEP_UP_REQUIRED",
      );
      setMessage(backupErrorMessage(error, "BACKUP_LOAD_FAILED"));
    });
  }, [load]);
  useEffect(() => {
    if (!runs.some((run) => run.status === "QUEUED" || run.status === "LEASED"))
      return;
    const timer = window.setInterval(
      () => void load().catch(() => undefined),
      2_000,
    );
    return () => window.clearInterval(timer);
  }, [load, runs]);
  const save = async () => {
    if (!settings) return;
    setBusy(true);
    setMessage("");
    try {
      const saved = await backupApi("/api/admin/backup", {
        method: "PUT",
        body: JSON.stringify({
          enabled: settings.enabled,
          intervalSeconds: Number(interval),
        }),
      });
      setSettings(saved);
      setMessage("Backup settings saved.");
    } catch (error) {
      setStepUpRequired(
        error instanceof Error && error.message === "STEP_UP_REQUIRED",
      );
      setMessage(backupErrorMessage(error, "BACKUP_SAVE_FAILED"));
    } finally {
      setBusy(false);
    }
  };
  const runNow = async () => {
    setBusy(true);
    setMessage("");
    try {
      await backupApi("/api/admin/backup/runs", {
        method: "POST",
        headers: { "idempotency-key": crypto.randomUUID() },
        body: "{}",
      });
      await load();
      setMessage("Backup queued. Its status is being updated automatically.");
    } catch (error) {
      setStepUpRequired(
        error instanceof Error && error.message === "STEP_UP_REQUIRED",
      );
      setMessage(backupErrorMessage(error, "BACKUP_QUEUE_FAILED"));
    } finally {
      setBusy(false);
    }
  };
  const signOutForStepUp = async () => {
    const csrf = currentAdminCsrfToken();
    await fetch("/api/admin/auth/logout", {
      method: "POST",
      credentials: "same-origin",
      headers: csrf ? { "x-csrf-token": csrf } : undefined,
    }).catch(() => undefined);
    window.location.assign("/#/login");
  };
  if (!settings)
    return (
      <Box sx={{ p: 3, maxWidth: 720 }}>
        <Typography component="h1" variant="h4" gutterBottom>
          Backup settings
        </Typography>
        {message ? (
          <Stack spacing={2}>
            <Alert severity="warning">{message}</Alert>
            {stepUpRequired ? (
              <Button
                variant="contained"
                sx={{ alignSelf: "flex-start" }}
                onClick={() => void signOutForStepUp()}
              >
                Sign out and verify again
              </Button>
            ) : (
              <Button
                variant="outlined"
                sx={{ alignSelf: "flex-start" }}
                onClick={() =>
                  void load().catch((error: unknown) =>
                    setMessage(backupErrorMessage(error, "BACKUP_LOAD_FAILED")),
                  )
                }
              >
                Retry
              </Button>
            )}
          </Stack>
        ) : (
          <CircularProgress aria-label="Loading backup settings" />
        )}
      </Box>
    );
  const latest = runs.find((run) => run.status === "SUCCEEDED");
  const stateLabel: Record<Run["status"], string> = {
    QUEUED: "Queued — waiting for worker",
    LEASED: "Backing up and uploading",
    SUCCEEDED: "Uploaded securely",
    FAILED: "Failed",
  };
  return (
    <Box sx={{ p: 3, maxWidth: 960 }}>
      <Typography component="h1" variant="h4" gutterBottom>
        Backup settings
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Encrypted PostgreSQL backups are uploaded by the server worker to the
        configured private Google Drive folder.
      </Typography>
      {message ? (
        <Alert
          severity={
            message.includes("saved") || message.includes("queued")
              ? "success"
              : "error"
          }
          sx={{ mb: 2 }}
        >
          {message}
        </Alert>
      ) : null}
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
            >
              <Box>
                <Typography fontWeight={700}>Automatic backups</Typography>
                <Typography variant="body2" color="text.secondary">
                  Seconds are intended for local demonstration. Production
                  should use a longer interval.
                </Typography>
              </Box>
              <Switch
                checked={settings.enabled}
                onChange={(_, enabled) => setSettings({ ...settings, enabled })}
                inputProps={{ "aria-label": "Enable automatic backups" }}
              />
            </Stack>
            <TextField
              label="Backup interval (seconds)"
              type="number"
              value={interval}
              onChange={(event) => setIntervalValue(event.target.value)}
              inputProps={{ min: 10, max: 86400 }}
              helperText="Minimum 10 seconds, maximum 86,400 seconds."
            />
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                disabled={busy}
                onClick={() => void save()}
              >
                Save settings
              </Button>
              <Button
                variant="outlined"
                disabled={busy}
                onClick={() => void runNow()}
              >
                Run backup now
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
      <Card variant="outlined" sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6">Latest successful backup</Typography>
          <Typography>
            {latest
              ? `${new Date(latest.completedAt ?? latest.requestedAt).toLocaleString()} · ${latest.byteCount ?? 0} bytes · ${latest.checksum?.slice(0, 12) ?? ""}`
              : "No successful backup yet."}
          </Typography>
        </CardContent>
      </Card>
      <Card variant="outlined" sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Backup history
          </Typography>
          <Stack spacing={1}>
            {runs.length ? (
              runs.map((run) => (
                <Box
                  key={run.id}
                  sx={{
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    pb: 1,
                  }}
                >
                  <Typography fontWeight={600}>
                    {stateLabel[run.status]} · {run.trigger}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {new Date(run.requestedAt).toLocaleString()}
                    {run.failureCode ? ` · ${run.failureCode}` : ""}
                  </Typography>
                </Box>
              ))
            ) : (
              <Typography color="text.secondary">
                No backup requests yet.
              </Typography>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
