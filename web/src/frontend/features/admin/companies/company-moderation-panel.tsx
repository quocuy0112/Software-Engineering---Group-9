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
  TextField,
  Typography,
} from "@mui/material";
import { useRef, useState } from "react";
import {
  adminDataProvider,
  companyModerationCommandPath,
} from "../app/data-provider";
import { StepUpDialog } from "../auth/step-up-dialog";
import { createAdminOperationIdController } from "../shared/admin-operation-id";

const categories = [
  "SECURITY_COMPROMISE",
  "POLICY_VIOLATION",
  "USER_REQUEST",
  "VERIFICATION_FAILURE",
  "INCIDENT_RESOLVED",
  "ACCESS_CLEANUP",
  "OTHER",
];

export function CompanyModerationPanel(props: {
  company: {
    id: string;
    legalName: string;
    moderationState: "ACTIVE" | "BANNED";
    moderationVersion: number;
  };
  onDone: () => void;
}) {
  const [action, setAction] = useState<"ban" | "unban">();
  const [category, setCategory] = useState("");
  const [explanation, setExplanation] = useState("");
  const [busy, setBusy] = useState(false);
  const [stepUp, setStepUp] = useState(false);
  const [conflict, setConflict] = useState(false);
  const operation = useRef(createAdminOperationIdController());
  const length = Array.from(explanation.normalize("NFC").trim()).length;

  const close = () => {
    operation.current.cancel();
    setAction(undefined);
    setCategory("");
    setExplanation("");
  };
  async function submit() {
    if (!action) return;
    setBusy(true);
    try {
      await adminDataProvider.command(
        companyModerationCommandPath(props.company.id, action),
        { confirmation: true, reasonCategory: category, explanation },
        props.company.moderationVersion,
        operation.current.current(),
      );
      operation.current.complete();
      close();
      props.onDone();
    } catch (error) {
      const response = error as { status?: number; body?: { code?: string } };
      if (response.body?.code === "STEP_UP_REQUIRED") setStepUp(true);
      else {
        operation.current.complete();
        if (response.status === 409) setConflict(true);
      }
    } finally {
      setBusy(false);
    }
  }
  const isBan = action === "ban";
  return (
    <Box component="section" aria-labelledby="company-moderation-heading">
      <Typography
        id="company-moderation-heading"
        component="h2"
        variant="h6"
        fontWeight={700}
      >
        Company moderation
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
        {props.company.moderationState === "BANNED"
          ? "This company is banned. Its data is retained and its prior verification state will be restored when unbanned."
          : "Banning immediately makes the company ineligible for recruiter access, public jobs, and new applications. No company data is deleted."}
      </Typography>
      <Box sx={{ mt: 1.5 }}>
        {props.company.moderationState === "ACTIVE" ? (
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              operation.current.begin();
              setAction("ban");
            }}
          >
            Ban company
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={() => {
              operation.current.begin();
              setAction("unban");
            }}
          >
            Unban company
          </Button>
        )}
      </Box>
      {conflict && (
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          The company changed while this page was open. Refresh before retrying.
        </Alert>
      )}
      {action && (
        <Dialog open onClose={close} aria-labelledby="company-moderation-title">
          <DialogTitle id="company-moderation-title">
            {isBan ? "Ban company" : "Unban company"}
          </DialogTitle>
          <DialogContent
            sx={{ display: "grid", gap: 2, pt: "12px !important" }}
          >
            <Alert severity={isBan ? "warning" : "info"}>
              Target: {props.company.legalName}.{" "}
              {isBan
                ? "The company will stop qualifying for recruiter access, public jobs, and new applications immediately."
                : "The company's verification state from before the ban will be restored."}{" "}
              No records are deleted.
            </Alert>
            <FormControl required>
              <InputLabel id="company-reason-category">
                Reason category
              </InputLabel>
              <Select
                labelId="company-reason-category"
                label="Reason category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {categories.map((value) => (
                  <MenuItem key={value} value={value}>
                    {value}
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
              helperText={`${length}/500 characters; minimum 10`}
              inputProps={{ maxLength: 500 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={close}>Cancel</Button>
            <Button
              variant="contained"
              color={isBan ? "error" : "primary"}
              onClick={() => void submit()}
              disabled={busy || !category || length < 10 || length > 500}
            >
              {isBan ? "Ban company" : "Unban company"}
            </Button>
          </DialogActions>
        </Dialog>
      )}
      <StepUpDialog
        open={stepUp}
        onCancel={() => {
          setStepUp(false);
          close();
        }}
        onVerified={() => {
          setStepUp(false);
          void submit();
        }}
      />
    </Box>
  );
}
