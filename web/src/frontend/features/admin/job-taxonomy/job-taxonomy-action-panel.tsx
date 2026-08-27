"use client";

import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useRef, useState } from "react";
import { useRecordContext, useRefresh } from "react-admin";
import {
  adminDataProvider,
  jobTaxonomyCommandPath,
} from "../app/data-provider";
import { StepUpDialog } from "../auth/step-up-dialog";
import { createAdminOperationIdController } from "../shared/admin-operation-id";
import {
  adminReasonLabel,
  privilegedReasonCategories,
} from "../shared/admin-reason-label";
import { StaleConflictPanel } from "../shared/stale-conflict-panel";

type TaxonomyStatus = "ACTIVE" | "INACTIVE" | "REMOVED";

export type JobTaxonomyRecord = {
  id: string;
  kind: "SUBINDUSTRY";
  industryId: string;
  industry: {
    id: string;
    code: string;
    name: string;
    status: TaxonomyStatus;
  };
  code: string;
  name: string;
  status: TaxonomyStatus;
  version: number;
  jobCount: number;
  proposalCount: number;
  createdAt: string;
  updatedAt: string;
};

type Action = "deactivate" | "reactivate" | "remove";

function actionLabel(action: Action) {
  if (action === "deactivate") return "Deactivate";
  if (action === "reactivate") return "Reactivate";
  return "Remove";
}

function actionCommand(action: Action) {
  if (action === "deactivate") return "DEACTIVATE" as const;
  if (action === "reactivate") return "REACTIVATE" as const;
  return "REMOVE" as const;
}

function errorCode(error: unknown) {
  const value = error as {
    body?: { code?: unknown };
    code?: unknown;
  } | null;
  return typeof value?.body?.code === "string"
    ? value.body.code
    : typeof value?.code === "string"
      ? value.code
      : undefined;
}

export function JobTaxonomyActionPanel({
  compact = false,
}: Readonly<{ compact?: boolean }>) {
  const record = useRecordContext<JobTaxonomyRecord>();
  const refresh = useRefresh();
  const [action, setAction] = useState<Action>();
  const [reasonCategory, setReasonCategory] = useState("");
  const [explanation, setExplanation] = useState("");
  const [removalConfirmation, setRemovalConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [stepUp, setStepUp] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const operation = useRef(createAdminOperationIdController());
  const explanationLength = Array.from(
    explanation.normalize("NFC").trim(),
  ).length;

  if (!record) return null;
  const currentRecord = record;
  const isActive = currentRecord.status === "ACTIVE";
  const isInactive = currentRecord.status === "INACTIVE";
  const isRemoved = currentRecord.status === "REMOVED";

  const openAction = (nextAction: Action) => {
    operation.current.begin();
    setFailure(null);
    setConflict(false);
    setAction(nextAction);
  };

  const close = (force = false) => {
    if (busy && !force) return;
    operation.current.cancel();
    setAction(undefined);
    setReasonCategory("");
    setExplanation("");
    setRemovalConfirmation("");
    setFailure(null);
  };

  async function submit() {
    if (!action) return;
    setBusy(true);
    setFailure(null);
    try {
      await adminDataProvider.command(
        jobTaxonomyCommandPath(currentRecord.id, action),
        {
          command: actionCommand(action),
          confirmation: true,
          reasonCategory,
          explanation,
        },
        currentRecord.version,
        operation.current.current(),
      );
      operation.current.complete();
      close(true);
      refresh();
    } catch (error) {
      if (errorCode(error) === "STEP_UP_REQUIRED") {
        setStepUp(true);
        return;
      }
      operation.current.complete();
      if ((error as { status?: number }).status === 409) {
        setConflict(true);
      } else {
        setFailure("The taxonomy action could not be completed. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  const controls = (
    <Stack
      direction="row"
      spacing={1}
      useFlexGap
      flexWrap="wrap"
      sx={compact ? undefined : { mt: 1.5 }}
    >
      {isActive ? (
        <Button
          size={compact ? "small" : "medium"}
          color="error"
          variant="contained"
          onClick={(event) => {
            event.stopPropagation();
            openAction("deactivate");
          }}
        >
          Deactivate{compact ? "" : " sub-industry"}
        </Button>
      ) : null}
      {isInactive ? (
        <Button
          size={compact ? "small" : "medium"}
          color="success"
          variant="contained"
          onClick={(event) => {
            event.stopPropagation();
            openAction("reactivate");
          }}
        >
          Reactivate{compact ? "" : " sub-industry"}
        </Button>
      ) : null}
      {!isRemoved ? (
        <Button
          size={compact ? "small" : "medium"}
          color="error"
          variant={isActive ? "outlined" : "contained"}
          onClick={(event) => {
            event.stopPropagation();
            openAction("remove");
          }}
        >
          Remove{compact ? "" : " sub-industry"}
        </Button>
      ) : null}
      {isRemoved ? (
        <Typography variant="body2" color="text.secondary">
          Removed values are retained for existing jobs and cannot be changed
          here.
        </Typography>
      ) : null}
    </Stack>
  );

  const dialogAction = action;
  const dialogLabel = dialogAction ? actionLabel(dialogAction) : "Confirm";
  const isRemove = dialogAction === "remove";
  const isDeactivate = dialogAction === "deactivate";

  return (
    <>
      {compact ? (
        controls
      ) : (
        <Box component="section" aria-labelledby="job-taxonomy-actions-heading">
          <Typography
            id="job-taxonomy-actions-heading"
            component="h2"
            variant="h6"
            fontWeight={700}
          >
            Taxonomy status
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            Deactivation is reversible. Removal is a terminal soft-remove: the
            value leaves new forms and category menus, while existing jobs and
            review history keep their label.
          </Typography>
          {controls}
        </Box>
      )}
      {conflict ? (
        <StaleConflictPanel
          onRefresh={() => {
            setConflict(false);
            refresh();
          }}
        />
      ) : null}
      {dialogAction ? (
        <Dialog open onClose={() => close()} fullWidth maxWidth="sm">
          <DialogTitle>
            {dialogLabel} &quot;{currentRecord.name}&quot;
          </DialogTitle>
          <DialogContent
            sx={{ display: "grid", gap: 2, pt: "12px !important" }}
          >
            <Alert
              severity={isRemove ? "error" : isDeactivate ? "warning" : "info"}
            >
              Industry: {currentRecord.industry.name}. Jobs using this shared
              value: {currentRecord.jobCount}.{" "}
              {isRemove
                ? "This value will be removed from all new recruiter forms and category menus. Existing jobs, approved snapshots, proposals, and audit history are retained. The removed status cannot be changed from this screen."
                : isDeactivate
                  ? "It will disappear from new job forms and category menus; existing jobs are retained and the value can be reactivated later."
                  : "It will become available again for new job forms and category menus."}
            </Alert>
            {isRemove ? (
              <TextField
                label={`Type ${currentRecord.code} to confirm removal`}
                value={removalConfirmation}
                onChange={(event) => setRemovalConfirmation(event.target.value)}
                helperText="This extra confirmation is required because removal is terminal."
                autoFocus
              />
            ) : null}
            <FormControl required>
              <InputLabel id="job-taxonomy-reason-category">
                Reason category
              </InputLabel>
              <Select
                labelId="job-taxonomy-reason-category"
                label="Reason category"
                value={reasonCategory}
                onChange={(event) => setReasonCategory(event.target.value)}
              >
                {privilegedReasonCategories.map((value) => (
                  <MenuItem key={value} value={value}>
                    {adminReasonLabel(value)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Private administrator explanation"
              multiline
              minRows={4}
              required
              value={explanation}
              onChange={(event) => setExplanation(event.target.value)}
              helperText={`${explanationLength}/500 characters; minimum 10`}
              inputProps={{ maxLength: 500 }}
            />
            {failure ? <Alert severity="error">{failure}</Alert> : null}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => close()} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color={isRemove || isDeactivate ? "error" : "success"}
              onClick={() => void submit()}
              disabled={
                busy ||
                (isRemove &&
                  removalConfirmation.trim() !== currentRecord.code) ||
                !reasonCategory ||
                explanationLength < 10 ||
                explanationLength > 500
              }
            >
              {dialogLabel}
            </Button>
          </DialogActions>
        </Dialog>
      ) : null}
      <StepUpDialog
        open={stepUp}
        id={`job-taxonomy-status-${currentRecord.id}`}
        onCancel={() => {
          setStepUp(false);
          close();
        }}
        onVerified={() => {
          setStepUp(false);
          void submit();
        }}
      />
    </>
  );
}
