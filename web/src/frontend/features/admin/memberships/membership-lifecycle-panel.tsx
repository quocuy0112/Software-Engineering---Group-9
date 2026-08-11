"use client";
import { useState } from "react";
import { Alert, Box, Button, Chip, Typography } from "@mui/material";
import { Show, useRecordContext, useRefresh } from "react-admin";
import { adminDataProvider, membershipCommandPath } from "../app/data-provider";
import {
  SuspendMembershipDialog,
  RestoreMembershipDialog,
  RemoveMembershipDialog,
} from "./membership-action-dialog";
import { StaleConflictPanel } from "../shared/stale-conflict-panel";
import { StepUpDialog } from "../auth/step-up-dialog";
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
        crypto.randomUUID(),
      );
      refresh();
    } catch (error) {
      if ((error as { status?: number }).status === 409) setConflict(true);
      else if (
        (error as { body?: { code?: string } }).body?.code ===
        "STEP_UP_REQUIRED"
      )
        setStepUp(true);
      else throw error;
    }
  }
  return (
    <Box sx={{ p: 2, display: "grid", gap: 2 }}>
      <Typography component="h1" variant="h5">
        Company membership
      </Typography>
      <Typography>Membership: {record.id}</Typography>
      <Typography>
        Company: {record.company.legalName} ({record.companyId})
      </Typography>
      <Typography>
        Account: {record.accountDisplayName} ({record.accountId})
      </Typography>
      <Typography>
        Approved role: {record.role}; retained role: {record.priorApprovedRole}
      </Typography>
      <Chip label={record.state} sx={{ width: "fit-content" }} />
      {record.role === "OWNER" && record.state === "ACTIVE" && (
        <Alert severity="warning">
          The last active owner cannot be suspended or removed.
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
      <Box sx={{ display: "flex", gap: 1 }}>
        {record.state === "ACTIVE" && (
          <Button onClick={() => setAction("suspend")}>Suspend</Button>
        )}
        {record.state === "SUSPENDED" && (
          <Button onClick={() => setAction("restore")}>
            Restore {record.priorApprovedRole}
          </Button>
        )}
        {record.state !== "REMOVED" && (
          <Button color="error" onClick={() => setAction("remove")}>
            Remove
          </Button>
        )}
      </Box>
      {action === "suspend" && (
        <SuspendMembershipDialog
          open
          targetLabel={target}
          onClose={() => setAction(undefined)}
          onConfirm={submit}
        />
      )}
      {action === "restore" && (
        <RestoreMembershipDialog
          open
          targetLabel={target}
          onClose={() => setAction(undefined)}
          onConfirm={submit}
        />
      )}
      {action === "remove" && (
        <RemoveMembershipDialog
          open
          targetLabel={target}
          confirmationText={record.id}
          onClose={() => setAction(undefined)}
          onConfirm={submit}
        />
      )}
      <StepUpDialog
        open={stepUp}
        onCancel={() => setStepUp(false)}
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
