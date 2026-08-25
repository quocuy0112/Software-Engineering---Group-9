"use client";
import { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import {
  adminReasonLabel,
  privilegedReasonCategories,
} from "../shared/admin-reason-label";
export function AccountStateDialog(props: {
  open: boolean;
  title: string;
  targetLabel: string;
  actionLabel: string;
  onClose: () => void;
  onConfirm: (value: {
    reasonCategory: string;
    explanation: string;
    confirmation: true;
  }) => Promise<boolean | void>;
}) {
  const [category, setCategory] = useState("");
  const [explanation, setExplanation] = useState("");
  const [busy, setBusy] = useState(false);
  const length = Array.from(explanation.normalize("NFC").trim()).length;
  async function confirm() {
    setBusy(true);
    try {
      const committed = await props.onConfirm({
        reasonCategory: category,
        explanation,
        confirmation: true,
      });
      if (committed !== false) props.onClose();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      aria-labelledby="account-action-title"
    >
      <DialogTitle id="account-action-title">{props.title}</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: 2, pt: "12px !important" }}>
        <Alert severity="warning">
          Target: {props.targetLabel}. This action is immediate and cannot be
          undone by closing this dialog. Existing applications, jobs,
          memberships, verification records, CV records, and scores are not
          deleted. Suspension revokes sessions; Restore does not create a new
          session.
        </Alert>
        <FormControl required>
          <InputLabel id="reason-category-label">Reason category</InputLabel>
          <Select
            labelId="reason-category-label"
            label="Reason category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
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
          value={explanation}
          onChange={(event) => setExplanation(event.target.value)}
          required
          helperText={`${length}/500 characters; minimum 10`}
          inputProps={{ maxLength: 500 }}
        />
        <Typography variant="caption">
          The explanation is encrypted and is not included in the affected user
          notification.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancel</Button>
        <Button
          variant="contained"
          color="error"
          onClick={confirm}
          disabled={busy || !category || length < 10 || length > 500}
        >
          {props.actionLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
export function SuspendAccountDialog(
  props: Omit<
    Parameters<typeof AccountStateDialog>[0],
    "title" | "actionLabel"
  >,
) {
  return (
    <AccountStateDialog
      {...props}
      title="Suspend account"
      actionLabel="Suspend account"
    />
  );
}
export function RestoreAccountDialog(
  props: Omit<
    Parameters<typeof AccountStateDialog>[0],
    "title" | "actionLabel"
  >,
) {
  return (
    <AccountStateDialog
      {...props}
      title="Restore account"
      actionLabel="Restore account"
    />
  );
}
