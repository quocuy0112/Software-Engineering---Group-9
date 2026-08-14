"use client";

import { Alert, Box, Button } from "@mui/material";
import { useRef, useState } from "react";
import { accountCommandPath, adminDataProvider } from "../app/data-provider";
import { AccountStateDialog } from "./account-state-dialog";
import { StepUpDialog } from "../auth/step-up-dialog";
import { createAdminOperationIdController } from "../shared/admin-operation-id";

export function AccountModerationPanel(props: {
  account: {
    id: string;
    displayName: string;
    maskedEmail: string;
    version: number;
    status: "ACTIVE" | "SUSPENDED";
  };
  moderation: {
    canSuspend: boolean;
    canRestore: boolean;
    protectedAdministrator: boolean;
  };
  onDone: () => void;
}) {
  const [action, setAction] = useState<"suspend" | "restore">();
  const [stepUp, setStepUp] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [pending, setPending] = useState<{
    reasonCategory: string;
    explanation: string;
    confirmation: true;
  }>();
  const operation = useRef(createAdminOperationIdController());

  async function submit(value: {
    reasonCategory: string;
    explanation: string;
    confirmation: true;
  }) {
    if (!action) return false;
    setPending(value);
    try {
      await adminDataProvider.command(
        accountCommandPath(props.account.id, action),
        {
          category: value.reasonCategory,
          reason: value.explanation,
        },
        props.account.version,
        operation.current.current(),
      );
      operation.current.complete();
      setAction(undefined);
      setPending(undefined);
      props.onDone();
      return true;
    } catch (error) {
      const response = error as { status?: number; body?: { code?: string } };
      if (response.body?.code === "STEP_UP_REQUIRED") {
        setStepUp(true);
        return false;
      }
      operation.current.complete();
      if (response.status === 409) setConflict(true);
      if (response.body?.code === "ACTION_BLOCKED") setBlocked(true);
      return false;
    }
  }

  return (
    <Box component="section" aria-labelledby="account-moderation-actions" sx={{ display: "grid", gap: 1 }}>
      {props.moderation.protectedAdministrator && (
        <Alert severity="info">
          The server marks this account as a current Platform Administrator.
          Suspend and Restore are unavailable in this workflow.
        </Alert>
      )}
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        {props.moderation.canSuspend && (
          <Button color="error" variant="contained" onClick={() => { operation.current.begin(); setAction("suspend"); }}>
            Suspend account
          </Button>
        )}
        {props.moderation.canRestore && (
          <Button variant="contained" onClick={() => { operation.current.begin(); setAction("restore"); }}>
            Restore account
          </Button>
        )}
      </Box>
      {blocked && <Alert severity="warning">The server blocked this protected account action. Refresh the authoritative detail.</Alert>}
      {conflict && <Alert severity="warning">The account changed while this page was open. Refresh before retrying.</Alert>}
      {action && (
        <AccountStateDialog
          open
          title={action === "suspend" ? "Suspend account" : "Restore account"}
          actionLabel={action === "suspend" ? "Suspend" : "Restore"}
          targetLabel={`${props.account.displayName} (${props.account.maskedEmail})`}
          onClose={() => {
            operation.current.cancel();
            setAction(undefined);
            setPending(undefined);
          }}
          onConfirm={submit}
        />
      )}
      <StepUpDialog
        open={stepUp}
        onCancel={() => {
          operation.current.cancel();
          setStepUp(false);
          setAction(undefined);
          setPending(undefined);
        }}
        onVerified={() => {
          setStepUp(false);
          if (pending) void submit(pending);
        }}
      />
    </Box>
  );
}
