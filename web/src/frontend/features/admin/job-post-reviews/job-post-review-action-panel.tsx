"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  useDataProvider,
  useGetIdentity,
  useNotify,
  useRecordContext,
  useRefresh,
} from "react-admin";
import type { AdminDataProvider } from "../app/data-provider";

type PendingAction = "claim" | "reassign" | "approve" | "reject" | null;

export function JobPostReviewActionPanel() {
  const record = useRecordContext<{
    id: string;
    state: string;
    assignment: string | null;
    version: number;
    integrityState: "VALID" | "BLOCKED";
    company?: { active?: boolean };
    submitter?: { currentlyEligible?: boolean };
    taxonomyProposal?: {
      proposedName: string;
      status: "PENDING_APPROVAL" | "APPROVED" | "MAPPED" | "REJECTED";
    } | null;
  }>();
  const dataProvider = useDataProvider<AdminDataProvider>();
  const { data: identity } = useGetIdentity();
  const notify = useNotify();
  const refresh = useRefresh();
  const [target, setTarget] = useState("");
  const [status, setStatus] = useState("");
  const [reasonCode, setReasonCode] = useState("INCOMPLETE_OR_UNCLEAR");
  const [publicExplanation, setPublicExplanation] = useState("");
  const [privateNote, setPrivateNote] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [confirmationAction, setConfirmationAction] = useState<
    "approve" | "reject" | null
  >(null);
  const [claimedByCurrentAdmin, setClaimedByCurrentAdmin] = useState(false);

  if (!record || record.state !== "PENDING_REVIEW") return null;

  const hasAssignment = Boolean(record.assignment) || claimedByCurrentAdmin;
  const assignedToCurrentAdmin =
    claimedByCurrentAdmin || record.assignment === identity?.id;
  const approvalBlocked =
    record.integrityState !== "VALID" ||
    !record.assignment ||
    !assignedToCurrentAdmin ||
    !record.company?.active ||
    !record.submitter?.currentlyEligible;
  const rejectionBlocked =
    record.integrityState !== "VALID" ||
    !record.assignment ||
    !assignedToCurrentAdmin;
  const approvalBlockers: string[] = [];
  if (record.integrityState !== "VALID") {
    approvalBlockers.push("The submitted snapshot integrity must be valid.");
  }
  if (!record.assignment) {
    approvalBlockers.push("Claim or assign this review first.");
  }
  if (record.assignment && !assignedToCurrentAdmin) {
    approvalBlockers.push(
      "Only the assigned administrator can approve, reject, or reassign this review.",
    );
  }
  if (!record.company?.active) {
    approvalBlockers.push("The company must be active.");
  }
  if (!record.submitter?.currentlyEligible) {
    approvalBlockers.push("The submitting recruiter must be eligible.");
  }

  const execute = async (action: "claim" | "reassign") => {
    setPendingAction(action);
    try {
      await dataProvider.command(
        `/api/admin/job-post-reviews/${encodeURIComponent(record.id)}/${action}`,
        action === "claim"
          ? { command: "CLAIM" }
          : { command: "REASSIGN", targetAdminUserId: target },
        record.version,
        crypto.randomUUID(),
      );
      if (action === "claim") setClaimedByCurrentAdmin(true);
      setStatus(action === "claim" ? "Review claimed." : "Review reassigned.");
      refresh();
    } catch (error) {
      const code = (error as { code?: string }).code ?? "ACTION_FAILED";
      setStatus(
        code === "STALE_CONFLICT" ? "STALE_CONFLICT - reload required" : code,
      );
      notify(code, { type: "warning" });
    } finally {
      setPendingAction(null);
    }
  };

  const decide = async (action: "approve" | "reject") => {
    setPendingAction(action);
    try {
      const result = (await dataProvider.command(
        `/api/admin/job-post-reviews/${encodeURIComponent(record.id)}/${action}`,
        action === "approve"
          ? { command: "APPROVE" }
          : {
              command: "REJECT",
              reasonCode,
              publicExplanation,
              ...(privateNote.trim() ? { privateNote } : {}),
            },
        record.version,
        crypto.randomUUID(),
      )) as { status?: string; code?: string };
      if (result.status === "ACTION_BLOCKED") {
        setStatus(`Decision result: ${result.code ?? "ACTION_BLOCKED"}`);
        notify(result.code ?? "ACTION_BLOCKED", { type: "warning" });
      } else {
        const resultLabel = action === "approve" ? "Approved" : "Rejected";
        setStatus(`Decision result: ${resultLabel}`);
        notify(resultLabel, { type: "success" });
      }
      refresh();
    } catch (error) {
      const code = (error as { code?: string }).code ?? "ACTION_FAILED";
      setStatus(
        `Decision result: ${
          code === "STALE_CONFLICT" ? "STALE_CONFLICT - reload required" : code
        }`,
      );
      notify(code, { type: "warning" });
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <Paper
      component="section"
      aria-label="Review assignment actions"
      variant="outlined"
      sx={{ overflow: "hidden" }}
    >
      <Box sx={{ px: 2, py: 1.75, bgcolor: "action.hover" }}>
        <Typography component="h2" variant="subtitle1" fontWeight={700}>
          Review actions
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          Decisions apply only to submitted version {record.version}.
        </Typography>
      </Box>

      <Stack spacing={2.25} sx={{ p: 2 }}>
        <Box>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            spacing={1}
          >
            <Typography component="h3" variant="subtitle2" fontWeight={700}>
              Assignment
            </Typography>
            <Chip
              label={hasAssignment ? "Assigned" : "Unassigned"}
              color={hasAssignment ? "success" : "warning"}
              size="small"
            />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            {claimedByCurrentAdmin
              ? "Assigned to you. You can now approve, reject, or reassign it."
              : record.assignment
                ? `Assigned to ${record.assignment}`
                : "Claim this item before making a decision."}
          </Typography>
          <Button
            fullWidth
            variant="outlined"
            sx={{ mt: 1.5 }}
            disabled={hasAssignment || pendingAction !== null}
            onClick={() => void execute("claim")}
          >
            {pendingAction === "claim"
              ? "Claiming..."
              : hasAssignment
                ? "Review already assigned"
                : "Claim review"}
          </Button>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{ mt: 1 }}
          >
            <TextField
              fullWidth
              size="small"
              label="Reassign to administrator ID"
              aria-label="Target Administrator user id"
              value={target}
              onFocus={() => setStatus("Enter an active Administrator user id")}
              onChange={(event) => setTarget(event.currentTarget.value)}
            />
            <Button
              variant="outlined"
              disabled={
                !target.trim() ||
                !record.assignment ||
                !assignedToCurrentAdmin ||
                pendingAction !== null
              }
              onClick={() => void execute("reassign")}
              sx={{ whiteSpace: "nowrap" }}
            >
              {pendingAction === "reassign" ? "Reassigning..." : "Reassign"}
            </Button>
          </Stack>
        </Box>

        <Divider />

        <Box>
          <Typography component="h3" variant="subtitle2" fontWeight={700}>
            Decision
          </Typography>
          <Box
            sx={{
              mt: 1.25,
              p: 1.5,
              border: 1,
              borderColor: "success.light",
              borderRadius: 1,
              bgcolor: "rgba(46, 125, 50, 0.06)",
            }}
          >
            <Typography variant="body2" fontWeight={700}>
              Approve this version
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              The job becomes visible to candidates after approval.
              {record.taxonomyProposal?.status === "PENDING_APPROVAL"
                ? ` The proposed sub-industry "${record.taxonomyProposal.proposedName}" will also be mapped or created for all companies.`
                : ""}
            </Typography>
            <Button
              fullWidth
              variant="contained"
              color="success"
              aria-label="Approve exact version"
              disabled={approvalBlocked || pendingAction !== null}
              onClick={() => setConfirmationAction("approve")}
              sx={{ mt: 1.5 }}
            >
              {pendingAction === "approve"
                ? "Approving..."
                : "Approve exact version"}
            </Button>
          </Box>
          {approvalBlocked ? (
            <Alert severity="warning" sx={{ mt: 1.25 }}>
              <Typography variant="body2" fontWeight={700}>
                Approval is blocked until assignment and eligibility are valid.
              </Typography>
              <Box component="ul" sx={{ mt: 0.75, mb: 0, pl: 2.25 }}>
                {approvalBlockers.map((blocker) => (
                  <li key={blocker}>
                    <Typography variant="body2">{blocker}</Typography>
                  </li>
                ))}
              </Box>
            </Alert>
          ) : null}
        </Box>

        <Box
          sx={{
            p: 1.5,
            border: 1,
            borderColor: "error.light",
            borderRadius: 1,
            bgcolor: "rgba(211, 47, 47, 0.04)",
          }}
        >
          <Typography component="h3" variant="subtitle2" fontWeight={700}>
            Reject this version
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Explain the required changes. The recruiter can see the public
            explanation.
          </Typography>
          <Stack spacing={1.25} sx={{ mt: 1.5 }}>
            <TextField
              select
              fullWidth
              size="small"
              label="Rejection reason"
              aria-label="Rejection reason"
              value={reasonCode}
              onChange={(event) => setReasonCode(event.target.value)}
            >
              <MenuItem value="INCOMPLETE_OR_UNCLEAR">
                Incomplete or unclear
              </MenuItem>
              <MenuItem value="MISLEADING_CONTENT">Misleading content</MenuItem>
              <MenuItem value="COMPENSATION_OR_LOCATION_UNCLEAR">
                Compensation or location unclear
              </MenuItem>
              <MenuItem value="DISCRIMINATORY_OR_PROHIBITED">
                Discriminatory or prohibited
              </MenuItem>
              <MenuItem value="COMPANY_OR_ROLE_MISMATCH">
                Company or role mismatch
              </MenuItem>
              <MenuItem value="DUPLICATE_OR_SPAM">Duplicate or spam</MenuItem>
              <MenuItem value="EXPIRED_OR_INVALID_DEADLINE">
                Expired or invalid deadline
              </MenuItem>
              <MenuItem value="POLICY_OR_LEGAL_RISK">
                Policy or legal risk
              </MenuItem>
              <MenuItem value="OTHER_ACTION_REQUIRED">
                Other action required
              </MenuItem>
            </TextField>
            <TextField
              fullWidth
              multiline
              minRows={3}
              label="Public explanation"
              aria-label="Public explanation"
              helperText={`${publicExplanation.trim().length}/20 characters minimum. Visible to the recruiter.`}
              inputProps={{ minLength: 20, maxLength: 1000 }}
              value={publicExplanation}
              onChange={(event) =>
                setPublicExplanation(event.currentTarget.value)
              }
            />
            <TextField
              fullWidth
              multiline
              minRows={2}
              label="Administrator private note"
              aria-label="Administrator private note"
              helperText="Visible only to administrators. Optional."
              inputProps={{ maxLength: 2000 }}
              value={privateNote}
              onChange={(event) => setPrivateNote(event.currentTarget.value)}
            />
            <Button
              fullWidth
              variant="contained"
              color="error"
              aria-label="Reject exact version"
              disabled={
                rejectionBlocked ||
                publicExplanation.trim().length < 20 ||
                pendingAction !== null
              }
              onClick={() => setConfirmationAction("reject")}
            >
              {pendingAction === "reject"
                ? "Rejecting..."
                : "Reject exact version"}
            </Button>
          </Stack>
        </Box>

        {status ? (
          <Alert
            severity={
              status.includes("ACTION") || status.includes("STALE")
                ? "warning"
                : "success"
            }
            role="status"
            aria-live="polite"
          >
            {status}
          </Alert>
        ) : null}
      </Stack>
      <Dialog
        open={confirmationAction !== null}
        onClose={() => setConfirmationAction(null)}
        aria-labelledby="job-post-review-decision-confirmation-title"
        aria-describedby="job-post-review-decision-confirmation-description"
      >
        <DialogTitle id="job-post-review-decision-confirmation-title">
          {confirmationAction === "approve"
            ? "Approve this submitted version?"
            : "Reject this submitted version?"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="job-post-review-decision-confirmation-description">
            {confirmationAction === "approve"
              ? record.taxonomyProposal?.status === "PENDING_APPROVAL"
                ? `The job will become visible to candidates, and "${record.taxonomyProposal.proposedName}" will be mapped or created as a shared sub-industry.`
                : "The job will become visible to candidates after approval."
              : "The recruiter will receive the selected reason and public explanation."}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmationAction(null)}>Cancel</Button>
          <Button
            variant="contained"
            color={confirmationAction === "approve" ? "success" : "error"}
            onClick={() => {
              if (!confirmationAction) return;
              const action = confirmationAction;
              setConfirmationAction(null);
              void decide(action);
            }}
          >
            {confirmationAction === "approve"
              ? "Approve version"
              : "Reject version"}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
