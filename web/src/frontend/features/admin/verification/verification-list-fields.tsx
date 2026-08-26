"use client";

import { Box, Chip, Stack, Typography } from "@mui/material";
import { useRecordContext } from "react-admin";

type VerificationListRecord = {
  id: string;
  applicantId: string;
  companyName: string;
  taxCode: string;
  targetCompanyId: string | null;
  state: string;
  applicantEligibility: "ACTIVE" | "SUSPENDED";
  resubmissionCount: number;
  assignedAdminRef: string | null;
  assignmentStatus: "UNASSIGNED" | "MINE" | "ASSIGNED_TO_OTHER";
};

function sentenceCase(value: string) {
  return value
    .replace(/_/gu, " ")
    .toLowerCase()
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

function stateColor(value: string) {
  if (value === "APPROVED") return "success" as const;
  if (value === "REJECTED" || value === "EXPIRED") return "error" as const;
  if (value === "PENDING_REVIEW" || value === "CHANGES_REQUESTED")
    return "warning" as const;
  return "default" as const;
}

export function VerificationCompanyField() {
  const record = useRecordContext<VerificationListRecord>();
  if (!record) return null;
  return (
    <Stack spacing={0.25} sx={{ minWidth: 220 }}>
      <Typography fontWeight={700}>{record.companyName}</Typography>
      <Typography variant="body2" color="text.secondary">
        Tax ID: {record.taxCode}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Request: {record.id}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Company ID: {record.targetCompanyId ?? "Assigned after approval"}
      </Typography>
    </Stack>
  );
}

export function VerificationApplicantField() {
  const record = useRecordContext<VerificationListRecord>();
  if (!record) return null;
  return (
    <Stack spacing={0.5} alignItems="flex-start">
      <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
        {record.applicantId}
      </Typography>
      <Chip
        label={
          record.applicantEligibility === "ACTIVE"
            ? "Account active"
            : "Account suspended"
        }
        color={record.applicantEligibility === "ACTIVE" ? "success" : "error"}
        size="small"
        variant="outlined"
      />
    </Stack>
  );
}

export function VerificationStateField() {
  const record = useRecordContext<VerificationListRecord>();
  if (!record) return null;
  return (
    <Stack spacing={0.5} alignItems="flex-start">
      <Chip
        label={sentenceCase(record.state)}
        color={stateColor(record.state)}
        size="small"
      />
      {record.resubmissionCount > 0 && (
        <Typography variant="caption" color="text.secondary">
          Resubmitted {record.resubmissionCount} time
          {record.resubmissionCount === 1 ? "" : "s"}
        </Typography>
      )}
    </Stack>
  );
}

export function VerificationAssignmentField() {
  const record = useRecordContext<VerificationListRecord>();
  if (!record) return null;
  if (record.assignmentStatus === "UNASSIGNED")
    return <Chip label="Unassigned" color="warning" size="small" />;
  if (record.assignmentStatus === "MINE")
    return <Chip label="Claimed by you" color="success" size="small" />;
  return (
    <Box>
      <Chip label="Claimed" size="small" variant="outlined" />
      <Typography
        variant="caption"
        display="block"
        color="text.secondary"
        sx={{ mt: 0.5, overflowWrap: "anywhere" }}
      >
        {record.assignedAdminRef}
      </Typography>
    </Box>
  );
}
