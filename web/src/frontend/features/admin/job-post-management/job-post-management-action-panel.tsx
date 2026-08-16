"use client";
import { useState } from "react";
import { Alert, Box, Button, Divider, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { adminDataProvider } from "../app/data-provider";

export function JobPostManagementActionPanel({ jobId, version, onDone }: { jobId: string; version: number; onDone: () => void }) {
  const [reason, setReason] = useState(""); const [explanation, setExplanation] = useState(""); const [placement, setPlacement] = useState("HOME_FEATURED"); const [startsAt, setStartsAt] = useState(""); const [endsAt, setEndsAt] = useState(""); const [priority, setPriority] = useState("1"); const [reportIds, setReportIds] = useState(""); const [enforcementType, setEnforcementType] = useState("HIDE_JOB"); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
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
    <Divider sx={{ my: 2 }} /><Typography variant="subtitle1">Featured placement</Typography>
    <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mt: 1 }}>
      <TextField select label="Placement" value={placement} onChange={(e) => setPlacement(e.target.value)}><MenuItem value="HOME_FEATURED">Home featured</MenuItem><MenuItem value="SEARCH_FEATURED">Search featured</MenuItem></TextField>
      <TextField type="datetime-local" label="Starts" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} InputLabelProps={{ shrink: true }} />
      <TextField type="datetime-local" label="Ends" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} InputLabelProps={{ shrink: true }} />
      <TextField type="number" label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)} inputProps={{ min: 1, max: 100 }} />
    </Stack><Button sx={{ mt: 1 }} disabled={busy || !reason.trim() || !startsAt || !endsAt} onClick={() => run("feature", { command: "FEATURE", placement, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(), priority: Number(priority), reason })}>Schedule feature</Button>
    <Divider sx={{ my: 2 }} /><Typography variant="subtitle1">Enforcement from reports</Typography>
    <TextField fullWidth sx={{ mt: 1 }} label="Report IDs (comma-separated)" value={reportIds} onChange={(e) => setReportIds(e.target.value)} />
    <TextField select sx={{ mt: 1, minWidth: 240 }} label="Enforcement" value={enforcementType} onChange={(e) => setEnforcementType(e.target.value)}><MenuItem value="HIDE_JOB">Hide job</MenuItem><MenuItem value="CLOSE_APPLICATIONS">Close applications</MenuItem><MenuItem value="REQUEST_CHANGES">Request changes and hide</MenuItem><MenuItem value="SOFT_DELETE_JOB">Soft delete job</MenuItem></TextField>
    <Button sx={{ mt: 1, ml: { md: 1 } }} color="warning" disabled={busy || !reason.trim() || !reportIds.trim() || (enforcementType === "REQUEST_CHANGES" && explanation.trim().length < 20)} onClick={() => run("enforce", { command: "ENFORCE", type: enforcementType, reportIds: reportIds.split(",").map((id) => id.trim()).filter(Boolean), reason, publicExplanation: explanation || undefined })}>Apply enforcement</Button>
  </Box>;
}
