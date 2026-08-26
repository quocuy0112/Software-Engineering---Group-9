"use client";

import { useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import { adminDataProvider } from "../app/data-provider";
import { StepUpDialog } from "../auth/step-up-dialog";
import { createAdminOperationIdController } from "../shared/admin-operation-id";
import { adminReasonLabel } from "../shared/admin-reason-label";

const categories = [
  "DOCUMENT_UNREADABLE",
  "TAX_ID_MISMATCH",
  "DOCUMENT_EXPIRED",
  "COMPANY_INFORMATION_MISMATCH",
  "DUPLICATE_OR_CONFLICTING_REQUEST",
  "POLICY_INELIGIBLE",
  "OTHER",
] as const;

export function VerificationDecisionPanel(props: {
  requestId: string;
  version: number;
  state: string;
  applicantEligibility?: "ACTIVE" | "SUSPENDED";
  canDecide?: boolean;
  blockReason?: string | null;
  assignment: {
    status: "UNASSIGNED" | "MINE" | "ASSIGNED_TO_OTHER";
    assignedAdminRef: string | null;
    canClaim: boolean;
  };
  /** @deprecated accepted for compatibility with the previous panel contract */
  requestedRole?: string;
  /** @deprecated accepted for compatibility with the previous panel contract */
  resubmissionCount?: number;
  /** @deprecated use canDecide */
  disabled?: boolean;
  onDone: () => void;
}) {
  const [category, setCategory] = useState<(typeof categories)[number]>(
    "DOCUMENT_UNREADABLE",
  );
  const [comment, setComment] = useState("");
  const [protectedNote, setProtectedNote] = useState("");
  const [stepUp, setStepUp] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    "claim" | "approve" | "reject"
  >();
  const [error, setError] = useState("");
  const operation = useRef(createAdminOperationIdController());

  async function submit(action: "approve" | "reject") {
    const body =
      action === "reject"
        ? {
            category,
            applicantComment: comment,
            protectedNote: protectedNote || undefined,
          }
        : {
            protectedNote: protectedNote || undefined,
          };
    try {
      await adminDataProvider.command(
        `/api/admin/verification-requests/${encodeURIComponent(props.requestId)}/${action}`,
        body,
        props.version,
        operation.current.current(),
      );
      operation.current.complete();
      props.onDone();
    } catch (value) {
      const errorValue = value as { body?: { code?: string }; status?: number };
      if (errorValue.body?.code === "STEP_UP_REQUIRED") {
        setPendingAction(action);
        setStepUp(true);
      } else {
        operation.current.complete();
        setError(
          errorValue.body?.code === "APPLICANT_SUSPENDED"
            ? "The applicant account is suspended. Refresh after the account state changes."
            : "The decision did not commit. Refresh the current review state.",
        );
      }
    }
  }

  async function claim() {
    try {
      await adminDataProvider.command(
        `/api/admin/verification-requests/${encodeURIComponent(props.requestId)}/claim`,
        {},
        props.version,
        operation.current.current(),
      );
      operation.current.complete();
      props.onDone();
    } catch (value) {
      const errorValue = value as { body?: { code?: string } };
      if (errorValue.body?.code === "STEP_UP_REQUIRED") {
        setPendingAction("claim");
        setStepUp(true);
      } else {
        operation.current.complete();
        setError(
          errorValue.body?.code === "ASSIGNED_TO_OTHER"
            ? "Another administrator has already claimed this case. Refresh the review state."
            : "The case was not claimed. Refresh the current review state.",
        );
      }
    }
  }

  if (props.state !== "PENDING_REVIEW")
    return (
      <Alert severity="info">
        <span>This request is not currently actionable.</span>{" "}
        <span>Historical lifecycle states remain readable.</span>
      </Alert>
    );

  const blocked =
    props.disabled === true ||
    props.canDecide === false ||
    props.applicantEligibility === "SUSPENDED";
  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      {error && <Alert severity="warning">{error}</Alert>}
      {props.assignment.status === "UNASSIGNED" && (
        <Alert
          severity="warning"
          action={
            <Button
              color="inherit"
              size="small"
              disabled={!props.assignment.canClaim}
              onClick={() => {
                operation.current.begin();
                void claim();
              }}
            >
              Claim case
            </Button>
          }
        >
          This case is unassigned. Claim it before approving or rejecting.
        </Alert>
      )}
      {props.assignment.status === "MINE" && (
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip label="Claimed by you" color="success" size="small" />
          <span>Only the assigned administrator can make a decision.</span>
        </Stack>
      )}
      {props.assignment.status === "ASSIGNED_TO_OTHER" && (
        <Alert severity="info">
          This case is claimed by another administrator. Decisions are
          read-only.
        </Alert>
      )}
      {blocked && (
        <Alert severity="warning">
          {props.blockReason === "APPLICANT_SUSPENDED" ||
          props.applicantEligibility === "SUSPENDED"
            ? "Applicant account is suspended; Approve and Reject are disabled."
            : props.blockReason === "CLAIM_REQUIRED"
              ? "Claim this case before making a decision."
              : props.blockReason === "ASSIGNED_TO_OTHER"
                ? "This case is assigned to another administrator."
                : `Decision unavailable: ${props.blockReason ?? "current eligibility changed"}.`}
        </Alert>
      )}
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        <Button
          variant="contained"
          color="success"
          disabled={blocked}
          onClick={() => {
            operation.current.begin();
            void submit("approve");
          }}
        >
          {props.requestedRole ? "Approve recruiter" : "Approve"}
        </Button>
        <Button
          variant="outlined"
          color="error"
          disabled={blocked || Array.from(comment.trim()).length < 10}
          onClick={() => {
            operation.current.begin();
            void submit("reject");
          }}
        >
          Reject
        </Button>
      </Box>
      <TextField
        select
        label="Rejection category"
        value={category}
        onChange={(event) =>
          setCategory(event.target.value as (typeof categories)[number])
        }
        disabled={blocked}
      >
        {categories.map((value) => (
          <MenuItem key={value} value={value}>
            {adminReasonLabel(value)}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        multiline
        minRows={3}
        label="Applicant-visible rejection reason"
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        inputProps={{ maxLength: 500 }}
        helperText={`${Array.from(comment).length}/500 characters; minimum 10`}
        disabled={blocked}
      />
      <TextField
        multiline
        minRows={2}
        label="Protected administrator note (optional)"
        value={protectedNote}
        onChange={(event) => setProtectedNote(event.target.value)}
        inputProps={{ maxLength: 2000 }}
        disabled={blocked}
      />
      <StepUpDialog
        open={stepUp}
        onCancel={() => {
          operation.current.cancel();
          setStepUp(false);
          setPendingAction(undefined);
        }}
        onVerified={() => {
          setStepUp(false);
          if (pendingAction === "claim") void claim();
          if (pendingAction === "approve" || pendingAction === "reject")
            void submit(pendingAction);
        }}
      />
    </Box>
  );
}
