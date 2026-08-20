"use client";

import { useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { Show, useRecordContext, useRefresh } from "react-admin";
import { adminDataProvider, membershipCommandPath } from "../app/data-provider";
import {
  SuspendMembershipDialog,
  RestoreMembershipDialog,
  RemoveMembershipDialog,
} from "./membership-action-dialog";
import { StaleConflictPanel } from "../shared/stale-conflict-panel";
import { StepUpDialog } from "../auth/step-up-dialog";
import { createAdminOperationIdController } from "../shared/admin-operation-id";

type Membership = {
  id: string;
  companyId: string;
  company: { legalName: string };
  accountId: string;
  accountDisplayName: string;
  role: string;
  state: string;
  priorApprovedRole: string;
  version: number;
  history: Array<{
    id: string;
    priorStatus: string;
    resultingStatus: string;
    occurredAt: string;
  }>;
};

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

function sentenceCase(value: string) {
  return value
    .replace(/_/gu, " ")
    .toLowerCase()
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ overflowWrap: "anywhere" }}>{value}</Typography>
    </Box>
  );
}

function MembershipStateChip({ state }: { state: string }) {
  const color =
    state === "ACTIVE"
      ? "success"
      : state === "SUSPENDED"
        ? "warning"
        : state === "REMOVED"
          ? "error"
          : "default";
  return <Chip label={sentenceCase(state)} color={color} size="small" />;
}

function Panel() {
  const record = useRecordContext<Membership>();
  const refresh = useRefresh();
  const [action, setAction] = useState<"suspend" | "restore" | "remove">();
  const [conflict, setConflict] = useState(false);
  const [stepUp, setStepUp] = useState(false);
  const [pending, setPending] = useState<{
    reasonCategory: string;
    explanation: string;
    confirmation: true;
  }>();
  const operation = useRef(createAdminOperationIdController());
  if (!record) return null;

  const current = record;
  const target = `${record.accountDisplayName} in ${record.company.legalName} as ${record.role}`;

  async function submit(value: {
    reasonCategory: string;
    explanation: string;
    confirmation: true;
  }) {
    if (!action) return;
    setPending(value);
    try {
      await adminDataProvider.command(
        membershipCommandPath(current.id, action),
        value,
        current.version,
        operation.current.current(),
      );
      operation.current.complete();
      refresh();
      return true;
    } catch (error) {
      if ((error as { status?: number }).status === 409) {
        setConflict(true);
        operation.current.complete();
        return false;
      }
      if (
        (error as { body?: { code?: string } }).body?.code ===
        "STEP_UP_REQUIRED"
      ) {
        setStepUp(true);
        return false;
      }
      throw error;
    }
  }

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 1320, mx: "auto" }}>
      <Stack spacing={2.5}>
        <Paper variant="outlined" sx={{ overflow: "hidden" }}>
          <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: "primary.50" }}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              justifyContent="space-between"
              alignItems={{ md: "flex-start" }}
              spacing={1.5}
            >
              <Box>
                <Typography
                  variant="overline"
                  color="primary.main"
                  fontWeight={700}
                >
                  Company access management
                </Typography>
                <Typography component="h1" variant="h4" fontWeight={750}>
                  {record.accountDisplayName}
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                  {record.company.legalName} · Membership {record.id}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <MembershipStateChip state={record.state} />
                <Chip
                  label={`Version ${record.version}`}
                  size="small"
                  variant="outlined"
                />
              </Stack>
            </Stack>
          </Box>
          <Box
            sx={{
              p: { xs: 2, md: 3 },
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, 1fr)",
                lg: "repeat(4, 1fr)",
              },
              gap: 2,
            }}
          >
            <Detail label="Company reference" value={record.companyId} />
            <Detail label="Account reference" value={record.accountId} />
            <Detail label="Approved role" value={sentenceCase(record.role)} />
            <Detail
              label="Retained role"
              value={sentenceCase(record.priorApprovedRole)}
            />
          </Box>
        </Paper>

        {record.role === "OWNER" && record.state === "ACTIVE" && (
          <Alert severity="warning">
            Owner access is protected. Confirm that this company keeps an active
            owner before suspending or removing this membership.
          </Alert>
        )}
        {conflict && (
          <StaleConflictPanel
            onRefresh={() => {
              setConflict(false);
              refresh();
            }}
          />
        )}

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 360px" },
            gap: 2.5,
            alignItems: "start",
          }}
        >
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
            <Typography component="h2" variant="h6" fontWeight={700}>
              Membership history
            </Typography>
            <Stack spacing={1.5} sx={{ mt: 2 }}>
              {record.history.length ? (
                record.history.map((entry) => (
                  <Box
                    key={entry.id}
                    sx={{
                      borderLeft: 3,
                      borderColor: "primary.light",
                      pl: 1.5,
                    }}
                  >
                    <Typography fontWeight={700}>
                      {sentenceCase(entry.priorStatus)} to{" "}
                      {sentenceCase(entry.resultingStatus)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {dateTime(entry.occurredAt)}
                    </Typography>
                  </Box>
                ))
              ) : (
                <Typography color="text.secondary">
                  No membership lifecycle events are available.
                </Typography>
              )}
            </Stack>
          </Paper>

          <Paper
            component="section"
            aria-labelledby="membership-actions-heading"
            variant="outlined"
            sx={{ p: 2.5, position: { lg: "sticky" }, top: { lg: 20 } }}
          >
            <Typography
              id="membership-actions-heading"
              component="h2"
              variant="h6"
              fontWeight={700}
            >
              Access actions
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.75, mb: 2 }}
            >
              Changes require a reason, confirmation, and may require a fresh
              two-factor proof.
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Stack spacing={1.25}>
              {record.state === "ACTIVE" && (
                <Button
                  variant="contained"
                  onClick={() => {
                    operation.current.begin();
                    setAction("suspend");
                  }}
                >
                  Suspend membership
                </Button>
              )}
              {record.state === "SUSPENDED" && (
                <Button
                  variant="contained"
                  color="success"
                  onClick={() => {
                    operation.current.begin();
                    setAction("restore");
                  }}
                >
                  Restore {sentenceCase(record.priorApprovedRole)} access
                </Button>
              )}
              {record.state !== "REMOVED" && (
                <Button
                  color="error"
                  variant="outlined"
                  onClick={() => {
                    operation.current.begin();
                    setAction("remove");
                  }}
                >
                  Remove membership
                </Button>
              )}
              {record.state === "REMOVED" && (
                <Typography color="text.secondary">
                  This membership has been removed and cannot be changed here.
                </Typography>
              )}
            </Stack>
          </Paper>
        </Box>
      </Stack>

      {action === "suspend" && (
        <SuspendMembershipDialog
          open
          targetLabel={target}
          onClose={() => {
            operation.current.cancel();
            setAction(undefined);
          }}
          onConfirm={submit}
        />
      )}
      {action === "restore" && (
        <RestoreMembershipDialog
          open
          targetLabel={target}
          onClose={() => {
            operation.current.cancel();
            setAction(undefined);
          }}
          onConfirm={submit}
        />
      )}
      {action === "remove" && (
        <RemoveMembershipDialog
          open
          targetLabel={target}
          confirmationText={record.id}
          onClose={() => {
            operation.current.cancel();
            setAction(undefined);
          }}
          onConfirm={submit}
        />
      )}
      <StepUpDialog
        open={stepUp}
        onCancel={() => {
          operation.current.cancel();
          setPending(undefined);
          setAction(undefined);
          setStepUp(false);
        }}
        onVerified={() => {
          setStepUp(false);
          if (pending) void submit(pending);
        }}
      />
    </Box>
  );
}

export function MembershipLifecyclePanel() {
  return (
    <Show>
      <Panel />
    </Show>
  );
}
