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
} from "@mui/material";
import { AccountStateDialog } from "../accounts/account-state-dialog";
import {
  adminReasonLabel,
  privilegedReasonCategories,
} from "../shared/admin-reason-label";

type Command = {
  reasonCategory: string;
  explanation: string;
  confirmation: true;
};
type Props = {
  open: boolean;
  targetLabel: string;
  onClose: () => void;
  onConfirm: (value: Command) => Promise<boolean | void>;
};

export function SuspendMembershipDialog(props: Props) {
  return (
    <AccountStateDialog
      {...props}
      title="Suspend company membership"
      actionLabel="Suspend membership"
    />
  );
}

export function RestoreMembershipDialog(props: Props) {
  return (
    <AccountStateDialog
      {...props}
      title="Restore prior approved company role"
      actionLabel="Restore membership"
    />
  );
}

export function RemoveMembershipDialog(
  props: Props & { confirmationText: string },
) {
  const [typed, setTyped] = useState("");
  const [category, setCategory] = useState("");
  const [explanation, setExplanation] = useState("");
  const [busy, setBusy] = useState(false);
  const length = Array.from(explanation.normalize("NFC").trim()).length;
  const valid =
    typed === props.confirmationText &&
    Boolean(category) &&
    length >= 10 &&
    length <= 500;
  return (
    <Dialog open={props.open} onClose={props.onClose}>
      <DialogTitle>Remove company membership</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: 2, pt: "12px !important" }}>
        <Alert severity="error">
          Removal is terminal. A new approved invitation or verification is
          required to regain company authority. Target: {props.targetLabel}.
        </Alert>
        <TextField
          label={`Type ${props.confirmationText} to continue`}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoFocus
        />
        <FormControl required>
          <InputLabel id="remove-membership-reason">Reason category</InputLabel>
          <Select
            labelId="remove-membership-reason"
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
          value={explanation}
          onChange={(event) => setExplanation(event.target.value)}
          helperText={`${length}/500 characters; minimum 10`}
          multiline
          minRows={4}
          inputProps={{ maxLength: 500 }}
          required
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancel</Button>
        <Button
          color="error"
          variant="contained"
          disabled={!valid || busy}
          onClick={async () => {
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
          }}
        >
          Remove membership
        </Button>
      </DialogActions>
    </Dialog>
  );
}
