"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import { Show, useRecordContext, useRefresh } from "react-admin";
import type { AdminProposal } from "@/shared/contracts/connections";
import { adminDataProvider } from "../app/data-provider";

function ProposalReview() {
  const record = useRecordContext<AdminProposal>();
  const refresh = useRefresh();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audit, setAudit] = useState<unknown>(null);
  if (!record) return null;
  const currentRecord = record;
  const active = ["PENDING_BOTH", "PARTIALLY_ACCEPTED"].includes(
    currentRecord.state,
  );
  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      await adminDataProvider.command(
        `/api/admin/professional-connection-proposals/${encodeURIComponent(currentRecord.id)}/cancel`,
        { confirmation: true },
        currentRecord.version,
        crypto.randomUUID(),
      );
      setConfirm(false);
      refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Cancellation failed.",
      );
      refresh();
    } finally {
      setBusy(false);
    }
  }
  async function loadAudit() {
    setError(null);
    const response = await fetch(
      `/api/admin/professional-connection-proposals/${encodeURIComponent(currentRecord.id)}/protected-audit`,
      { cache: "no-store", credentials: "same-origin" },
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(
        body.code === "STEP_UP_REQUIRED"
          ? "Fresh two-factor proof is required to view protected audit detail."
          : (body.code ?? "Protected detail unavailable."),
      );
      return;
    }
    setAudit(body.data);
  }
  return (
    <Box sx={{ p: 3, display: "grid", gap: 2, maxWidth: 1100 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
        <Box>
          <Typography variant="overline" color="primary">
            Professional connection proposal
          </Typography>
          <Typography component="h1" variant="h4">
            {record.participantLow?.displayName ?? "Deleted participant"} ↔{" "}
            {record.participantHigh?.displayName ?? "Deleted participant"}
          </Typography>
          <Typography color="text.secondary">{record.id}</Typography>
        </Box>
        <Typography
          sx={{
            px: 1.5,
            py: 0.75,
            borderRadius: 99,
            bgcolor: "grey.100",
            fontWeight: 800,
            height: "fit-content",
          }}
        >
          {record.state.replaceAll("_", " ")}
        </Typography>
      </Box>
      <Alert severity="info">
        Both participants decide independently. Platform Administrators cannot
        create an accepted connection directly and cannot read private chat.
      </Alert>
      {error ? <Alert severity="warning">{error}</Alert> : null}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 2,
        }}
      >
        <Info
          title="Participant A"
          lines={[
            record.participantLow?.displayName ?? "Deleted",
            record.participantLow?.id ?? "Reference deleted",
          ]}
        />
        <Info
          title="Participant B"
          lines={[
            record.participantHigh?.displayName ?? "Deleted",
            record.participantHigh?.id ?? "Reference deleted",
          ]}
        />
        <Info
          title="Lifecycle"
          lines={[
            `Version ${record.version}`,
            `Created ${new Date(record.createdAt).toLocaleString()}`,
            `Expires ${new Date(record.expiresAt).toLocaleString()}`,
            record.terminalAt
              ? `Closed ${new Date(record.terminalAt).toLocaleString()}`
              : "Active",
          ]}
        />
        <Info
          title="Origin"
          lines={[
            `Created by ${record.creatorAdminUserId ?? "Deleted"}`,
            record.sourceSupportConversationId
              ? `Support case ${record.sourceSupportConversationId}`
              : "No Support case link",
          ]}
        />
      </Box>
      <Box
        sx={{
          p: 2,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
        }}
      >
        <Typography variant="h6">Reason visible to participants</Typography>
        <Typography sx={{ whiteSpace: "pre-wrap" }}>
          {record.reason ??
            "Reason is no longer available under the retention policy."}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {active ? (
          <Button
            color="error"
            variant="outlined"
            onClick={() => setConfirm(true)}
          >
            Cancel proposal
          </Button>
        ) : null}
        <Button variant="outlined" onClick={() => void loadAudit()}>
          View protected audit detail
        </Button>
      </Box>
      {audit ? (
        <Box
          component="pre"
          sx={{
            p: 2,
            bgcolor: "grey.100",
            borderRadius: 2,
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            fontSize: 12,
          }}
        >
          {JSON.stringify(audit, null, 2)}
        </Box>
      ) : null}
      <Dialog open={confirm} onClose={() => setConfirm(false)}>
        <DialogTitle>Cancel this proposal?</DialogTitle>
        <DialogContent>
          <Typography>
            Both participants will receive the same neutral closure update. A
            cooldown applies before re-proposing this pair.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(false)}>Keep active</Button>
          <Button color="error" disabled={busy} onClick={() => void cancel()}>
            Confirm cancellation
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function Info({ title, lines }: { title: string; lines: string[] }) {
  return (
    <Box
      sx={{
        p: 2,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
      }}
    >
      <Typography variant="h6">{title}</Typography>
      {lines.map((line) => (
        <Typography
          key={line}
          color="text.secondary"
          sx={{ overflowWrap: "anywhere" }}
        >
          {line}
        </Typography>
      ))}
    </Box>
  );
}
export function ProfessionalConnectionProposalShow() {
  return (
    <Show>
      <ProposalReview />
    </Show>
  );
}
