"use client";
import { useRef, useState } from "react";
import { Box, Button, Chip, Typography } from "@mui/material";
import { Show, useRecordContext, useRefresh } from "react-admin";
import { accountCommandPath, adminDataProvider } from "../app/data-provider";
import { SafeSessionTable, type SafeSession } from "./safe-session-table";
import { SessionRevocationDialog } from "./session-revocation-dialog";
import { AccountStateDialog } from "./account-state-dialog";
import { NotificationDeliveryStatus } from "./notification-delivery-status";
import { StaleConflictPanel } from "../shared/stale-conflict-panel";
import { StepUpDialog } from "../auth/step-up-dialog";
import { PrivilegedRationaleDetail } from "./privileged-rationale-detail";
import { createAdminOperationIdController } from "../shared/admin-operation-id";

type RecordShape = {
  id: string;
  displayName: string;
  maskedEmail: string;
  state: string;
  version: number;
  stateChangedAt: string;
  createdAt: string;
  memberships: Array<{
    id: string;
    company: { id: string; legalName: string };
    role: string;
    state: string;
  }>;
  sessions: SafeSession[];
  notifications: Array<{
    id: string;
    status: string;
    kind: string;
    lastAttemptAt: string | null;
    nextAttemptAt: string | null;
    failureCategory: string | null;
  }>;
  auditEvents: Array<{
    occurredAt: string;
    action: string;
    result: string;
    correlationId: string;
    context: Record<string, unknown>;
  }>;
};
function Content() {
  const record = useRecordContext<RecordShape>();
  const [action, setAction] = useState<{
    kind: "suspend" | "restore" | "revoke-all" | "revoke-one";
    session?: SafeSession;
  }>();
  const [conflict, setConflict] = useState(false);
  const [stepUp, setStepUp] = useState(false);
  const [pending, setPending] = useState<{
    reasonCategory: string;
    explanation: string;
    confirmation: true;
  }>();
  const operation = useRef(createAdminOperationIdController());
  const refresh = useRefresh();
  if (!record) return null;
  const current = record;
  async function execute(value: {
    reasonCategory: string;
    explanation: string;
    confirmation: true;
  }) {
    if (!action) return;
    setPending(value);
    const path = accountCommandPath(
      current.id,
      action.kind,
      action.session?.reference,
    );
    try {
      await adminDataProvider.command(
        path,
        action.kind === "suspend" || action.kind === "restore"
          ? {
              confirmation: true,
              category: value.reasonCategory,
              reason: value.explanation,
            }
          : value,
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
      } else if (
        (error as { body?: { code?: string } }).body?.code ===
        "STEP_UP_REQUIRED"
      ) {
        setStepUp(true);
        return false;
      } else throw error;
    }
  }
  return (
    <Box sx={{ p: 2, display: "grid", gap: 2 }}>
      <Typography component="h1" variant="h5">
        {record.displayName}
      </Typography>
      <Typography>Account reference: {record.id}</Typography>
      <Typography>Email: {record.maskedEmail}</Typography>
      <Chip
        label={record.state}
        color={record.state === "ACTIVE" ? "success" : "warning"}
        sx={{ width: "fit-content" }}
      />
      <Typography>
        State changed: {new Date(record.stateChangedAt).toLocaleString()}
      </Typography>
      {conflict && (
        <StaleConflictPanel
          onRefresh={() => {
            setConflict(false);
            refresh();
          }}
        />
      )}
      <Box sx={{ display: "flex", gap: 1 }}>
        <Button
          color="error"
          variant="contained"
          onClick={() => {
            operation.current.begin();
            setAction({
              kind: record.state === "ACTIVE" ? "suspend" : "restore",
            });
          }}
        >
          {record.state === "ACTIVE" ? "Suspend account" : "Restore account"}
        </Button>
        <Button
          color="error"
          onClick={() => {
            operation.current.begin();
            setAction({ kind: "revoke-all" });
          }}
        >
          Revoke all sessions
        </Button>
      </Box>
      <Typography component="h2" variant="h6">
        Company memberships
      </Typography>
      {record.memberships.map((m) => (
        <Typography key={m.id}>
          {m.company.legalName} — {m.role} — {m.state}
        </Typography>
      ))}
      <Typography component="h2" variant="h6">
        Active sessions
      </Typography>
      <SafeSessionTable
        sessions={record.sessions}
        onRevoke={(session) => {
          operation.current.begin();
          setAction({ kind: "revoke-one", session });
        }}
      />
      <Typography component="h2" variant="h6">
        Security notifications
      </Typography>
      <NotificationDeliveryStatus notifications={record.notifications} />
      <Typography component="h2" variant="h6">
        Recent privileged activity
      </Typography>
      {record.auditEvents.length ? (
        record.auditEvents.map((event) => (
          <Box
            key={event.correlationId}
            sx={{ borderTop: 1, borderColor: "divider", pt: 1 }}
          >
            <Typography>
              {event.action} — {event.result} —{" "}
              {new Date(event.occurredAt).toLocaleString()}
            </Typography>
            <Typography variant="caption">
              Correlation reference: {event.correlationId}
            </Typography>
            <PrivilegedRationaleDetail correlationId={event.correlationId} />
          </Box>
        ))
      ) : (
        <Typography>No privileged account activity recorded.</Typography>
      )}
      {action?.kind === "revoke-one" ? (
        <SessionRevocationDialog
          open
          targetLabel={`${action.session?.deviceDescription} for ${record.displayName}`}
          onClose={() => {
            operation.current.cancel();
            setAction(undefined);
          }}
          onConfirm={execute}
        />
      ) : action ? (
        <AccountStateDialog
          open
          title={
            action?.kind === "suspend"
              ? "Suspend account"
              : action?.kind === "restore"
                ? "Restore account"
                : "Revoke all sessions"
          }
          actionLabel={
            action?.kind === "suspend"
              ? "Suspend"
              : action?.kind === "restore"
                ? "Restore"
                : "Revoke all"
          }
          targetLabel={`${record.displayName} (${record.id})`}
          onClose={() => {
            operation.current.cancel();
            setAction(undefined);
          }}
          onConfirm={execute}
        />
      ) : null}
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
          if (pending) void execute(pending);
        }}
      />
    </Box>
  );
}
export function AccountSecurityShow() {
  return (
    <Show>
      <Content />
    </Show>
  );
}
