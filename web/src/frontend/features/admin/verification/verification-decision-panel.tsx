"use client";
import { useState } from "react";
import { Alert, Box, Button, MenuItem, TextField } from "@mui/material";
import { adminDataProvider } from "../app/data-provider";
import { StepUpDialog } from "../auth/step-up-dialog";
export function VerificationDecisionPanel(props: {
  requestId: string;
  version: number;
  state: string;
  resubmissionCount: number;
  disabled: boolean;
  onDone: () => void;
}) {
  const [action, setAction] = useState<
    "request-changes" | "reject" | "approve"
  >("request-changes");
  const [text, setText] = useState("");
  const [category, setCategory] = useState("DOCUMENT_UNREADABLE");
  const [role, setRole] = useState("RECRUITER");
  const [note, setNote] = useState("");
  const [stepUp, setStepUp] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    const body =
      action === "request-changes"
        ? { confirmation: true, guidance: text, privateNote: note || undefined }
        : action === "reject"
          ? {
              confirmation: true,
              category,
              reason: text,
              privateNote: note || undefined,
            }
          : { confirmation: true, role, privateNote: note || undefined };
    try {
      await adminDataProvider.command(
        `/api/admin/verification-requests/${encodeURIComponent(props.requestId)}/${action}`,
        body,
        props.version,
        crypto.randomUUID(),
      );
      props.onDone();
    } catch (e) {
      if ((e as { body?: { code?: string } }).body?.code === "STEP_UP_REQUIRED")
        setStepUp(true);
      else setError("The decision did not commit. Refresh current state.");
    }
  }
  if (props.state !== "PENDING_REVIEW")
    return (
      <Alert severity="info">This request is not currently actionable.</Alert>
    );
  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      {error && <Alert severity="warning">{error}</Alert>}
      <TextField
        select
        label="Decision"
        value={action}
        onChange={(e) => setAction(e.target.value as never)}
      >
        <MenuItem
          value="request-changes"
          disabled={props.resubmissionCount >= 3}
        >
          Request changes
        </MenuItem>
        <MenuItem value="reject">Reject</MenuItem>
        <MenuItem value="approve">Approve</MenuItem>
      </TextField>
      {action === "reject" && (
        <TextField
          select
          label="Rejection category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {[
            "DOCUMENT_UNREADABLE",
            "TAX_ID_MISMATCH",
            "DOCUMENT_EXPIRED",
            "COMPANY_INFORMATION_MISMATCH",
            "DUPLICATE_OR_CONFLICTING_REQUEST",
            "POLICY_INELIGIBLE",
            "OTHER",
          ].map((v) => (
            <MenuItem key={v} value={v}>
              {v}
            </MenuItem>
          ))}
        </TextField>
      )}
      {action === "approve" && (
        <TextField
          select
          label="Approved role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          {["OWNER", "HR_MANAGER", "RECRUITER", "HIRING_MANAGER"].map((v) => (
            <MenuItem key={v} value={v}>
              {v}
            </MenuItem>
          ))}
        </TextField>
      )}
      {action !== "approve" && (
        <TextField
          multiline
          minRows={3}
          label={
            action === "reject"
              ? "Applicant-visible reason"
              : "Applicant-visible guidance"
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          inputProps={{ maxLength: 500 }}
        />
      )}
      <TextField
        multiline
        minRows={2}
        label="Optional private note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        inputProps={{ maxLength: 2000 }}
      />
      <Button
        variant="contained"
        disabled={
          props.disabled ||
          (action !== "approve" && Array.from(text.trim()).length < 10)
        }
        onClick={submit}
      >
        Confirm {action}
      </Button>
      <StepUpDialog
        open={stepUp}
        onCancel={() => setStepUp(false)}
        onVerified={() => {
          setStepUp(false);
          void submit();
        }}
      />
    </Box>
  );
}
