"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { adminDataProvider } from "../app/data-provider";

type PendingAction = {
  action: string;
  body: Record<string, unknown>;
  label: string;
};

type Placement = { id: string; placement: string; state: string };

export function JobPostManagementActionPanel({
  jobId,
  version,
  featuredPlacements = [],
  onDone,
}: {
  jobId: string;
  version: number;
  featuredPlacements?: Placement[];
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [explanation, setExplanation] = useState("");
  const [placement, setPlacement] = useState("HOME_FEATURED");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [priority, setPriority] = useState("1");
  const [reportIds, setReportIds] = useState("");
  const [enforcementType, setEnforcementType] = useState("HIDE_JOB");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );

  async function execute(pending: PendingAction) {
    setBusy(true);
    setError(null);
    try {
      await adminDataProvider.command(
        `/api/admin/job-postings/${encodeURIComponent(jobId)}/${pending.action}`,
        { confirmation: true, ...pending.body },
        version,
        crypto.randomUUID(),
      );
      setPendingAction(null);
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ACTION_FAILED");
    } finally {
      setBusy(false);
    }
  }

  function confirm(
    action: string,
    label: string,
    body: Record<string, unknown>,
  ) {
    setPendingAction({ action, label, body });
  }

  function normal(action: string, command: string, label: string) {
    confirm(action, label, { command, reason });
  }

  const activePlacements = featuredPlacements.filter((item) =>
    ["SCHEDULED", "ACTIVE"].includes(item.state),
  );

  return (
    <Box
      component="section"
      sx={{ p: 2, border: 1, borderColor: "divider", borderRadius: 2 }}
    >
      <Typography variant="h6">Post operations</Typography>
      {error ? (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      ) : null}
      <TextField
        fullWidth
        sx={{ mt: 2 }}
        label="Operational reason"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        inputProps={{ maxLength: 1000 }}
      />
      <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mt: 2 }}>
        <Button
          disabled={busy || !reason.trim()}
          onClick={() => normal("hide", "HIDE", "Hide this job post")}
        >
          Hide
        </Button>
        <Button
          disabled={busy || !reason.trim()}
          onClick={() => normal("restore", "RESTORE", "Restore this job post")}
        >
          Restore
        </Button>
        <Button
          disabled={busy || !reason.trim()}
          onClick={() =>
            normal(
              "close-applications",
              "CLOSE_APPLICATIONS",
              "Close applications",
            )
          }
        >
          Close applications
        </Button>
        <Button
          disabled={busy || !reason.trim()}
          onClick={() =>
            normal(
              "reopen-applications",
              "REOPEN_APPLICATIONS",
              "Reopen applications",
            )
          }
        >
          Reopen applications
        </Button>
        <Button
          disabled={busy || !reason.trim()}
          onClick={() => normal("archive", "ARCHIVE", "Archive this job post")}
        >
          Archive
        </Button>
      </Stack>

      <Divider sx={{ my: 2 }} />
      <TextField
        fullWidth
        multiline
        minRows={3}
        label="Recruiter-visible correction request"
        value={explanation}
        onChange={(event) => setExplanation(event.target.value)}
        inputProps={{ minLength: 20, maxLength: 1000 }}
      />
      <Button
        sx={{ mt: 1 }}
        disabled={busy || explanation.trim().length < 20}
        onClick={() =>
          confirm(
            "request-changes",
            "Request a revised version while keeping the approved version live",
            {
              command: "REQUEST_CHANGES",
              publicExplanation: explanation,
              hideImmediately: false,
            },
          )
        }
      >
        Request changes and keep live version
      </Button>

      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle1">Featured placement</Typography>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mt: 1 }}>
        <TextField
          select
          label="Placement"
          value={placement}
          onChange={(event) => setPlacement(event.target.value)}
        >
          <MenuItem value="HOME_FEATURED">Home featured</MenuItem>
          <MenuItem value="SEARCH_FEATURED">Search featured</MenuItem>
        </TextField>
        <TextField
          type="datetime-local"
          label="Starts"
          value={startsAt}
          onChange={(event) => setStartsAt(event.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          type="datetime-local"
          label="Ends"
          value={endsAt}
          onChange={(event) => setEndsAt(event.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          type="number"
          label="Priority"
          value={priority}
          onChange={(event) => setPriority(event.target.value)}
          inputProps={{ min: 1, max: 100 }}
        />
      </Stack>
      <Button
        sx={{ mt: 1 }}
        disabled={busy || !reason.trim() || !startsAt || !endsAt}
        onClick={() =>
          confirm("feature", "Schedule this featured placement", {
            command: "FEATURE",
            placement,
            startsAt: new Date(startsAt).toISOString(),
            endsAt: new Date(endsAt).toISOString(),
            priority: Number(priority),
            reason,
          })
        }
      >
        Schedule feature
      </Button>
      {activePlacements.map((item) => (
        <Button
          key={item.id}
          sx={{ mt: 1, ml: 1 }}
          color="warning"
          disabled={busy || !reason.trim()}
          onClick={() =>
            confirm("unfeature", `Cancel ${item.placement} placement`, {
              command: "UNFEATURE",
              featureId: item.id,
              reason,
            })
          }
        >
          Cancel {item.placement}
        </Button>
      ))}

      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle1">Enforcement from reports</Typography>
      <TextField
        fullWidth
        sx={{ mt: 1 }}
        label="Report IDs (comma-separated)"
        value={reportIds}
        onChange={(event) => setReportIds(event.target.value)}
      />
      <TextField
        select
        sx={{ mt: 1, minWidth: 240 }}
        label="Enforcement"
        value={enforcementType}
        onChange={(event) => setEnforcementType(event.target.value)}
      >
        <MenuItem value="HIDE_JOB">Hide job</MenuItem>
        <MenuItem value="CLOSE_APPLICATIONS">Close applications</MenuItem>
        <MenuItem value="REQUEST_CHANGES">Request changes and hide</MenuItem>
        <MenuItem value="SOFT_DELETE_JOB">Soft delete job</MenuItem>
      </TextField>
      <Button
        sx={{ mt: 1, ml: { md: 1 } }}
        color="warning"
        disabled={
          busy ||
          !reason.trim() ||
          !reportIds.trim() ||
          (enforcementType === "REQUEST_CHANGES" &&
            explanation.trim().length < 20)
        }
        onClick={() =>
          confirm("enforce", `Apply ${enforcementType} enforcement`, {
            command: "ENFORCE",
            type: enforcementType,
            reportIds: reportIds
              .split(",")
              .map((id) => id.trim())
              .filter(Boolean),
            reason,
            publicExplanation: explanation || undefined,
          })
        }
      >
        Apply enforcement
      </Button>

      <Dialog
        open={Boolean(pendingAction)}
        onClose={() => !busy && setPendingAction(null)}
      >
        <DialogTitle>Confirm administrative action</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pendingAction?.label}. This action will be recorded in the
            operational audit timeline.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setPendingAction(null)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="warning"
            disabled={busy || !pendingAction}
            onClick={() => pendingAction && execute(pendingAction)}
          >
            Confirm action
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
