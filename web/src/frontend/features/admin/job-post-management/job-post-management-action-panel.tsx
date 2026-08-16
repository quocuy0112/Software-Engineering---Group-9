"use client";
import { useState } from "react";
import { Alert, Box, Button, Divider, Stack, TextField, Typography } from "@mui/material";
import { adminDataProvider } from "../app/data-provider";

export function JobPostManagementActionPanel({ jobId, version, onDone }: { jobId: string; version: number; onDone: () => void }) {
  const [reason, setReason] = useState(""); const [explanation, setExplanation] = useState(""); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  async function run(action: string, body: Record<string, unknown>) { setBusy(true); setError(null); try { await adminDataProvider.command(`/api/admin/job-postings/${encodeURIComponent(jobId)}/${action}`, { confirmation: true, ...body }, version, crypto.randomUUID()); onDone(); } catch (e) { setError(e instanceof Error ? e.message : "ACTION_FAILED"); } finally { setBusy(false); } }
  const normal = (action: string, command: string) => run(action, { command, reason });
  return <Box component="section" sx={{ p: 2, border: 1, borderColor: "divider", borderRadius: 2 }}>
    <Typography variant="h6">Post operations</Typography>{error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
    <TextField fullWidth sx={{ mt: 2 }} label="Operational reason" value={reason} onChange={(e) => setReason(e.target.value)} inputProps={{ maxLength: 1000 }} />
    <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mt: 2 }}>
      <Button disabled={busy || !reason.trim()} onClick={() => normal("hide", "HIDE")}>Hide</Button><Button disabled={busy || !reason.trim()} onClick={() => normal("restore", "RESTORE")}>Restore</Button>
      <Button disabled={busy || !reason.trim()} onClick={() => normal("close-applications", "CLOSE_APPLICATIONS")}>Close applications</Button><Button disabled={busy || !reason.trim()} onClick={() => normal("reopen-applications", "REOPEN_APPLICATIONS")}>Reopen applications</Button>
      <Button disabled={busy || !reason.trim()} onClick={() => normal("archive", "ARCHIVE")}>Archive</Button>
    </Stack><Divider sx={{ my: 2 }} />
    <TextField fullWidth multiline minRows={3} label="Recruiter-visible correction request" value={explanation} onChange={(e) => setExplanation(e.target.value)} inputProps={{ minLength: 20, maxLength: 1000 }} />
    <Button sx={{ mt: 1 }} disabled={busy || explanation.trim().length < 20} onClick={() => run("request-changes", { command: "REQUEST_CHANGES", publicExplanation: explanation, hideImmediately: false })}>Request changes and keep live version</Button>
  </Box>;
}
