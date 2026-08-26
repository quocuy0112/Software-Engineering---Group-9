"use client";

import { Box, Chip, Stack, Tooltip, Typography } from "@mui/material";
import { useRecordContext } from "react-admin";

export type CompanyListRecord = {
  id: string;
  legalName: string;
  displayName: string;
  verificationState: "ACTIVE" | "UNVERIFIED" | "INACTIVE";
  moderationState: "ACTIVE" | "BANNED";
  metrics: {
    activeMembershipCount: number;
    activeOwnerCount: number;
    pendingJobReviewCount: number;
    openModerationReportCount: number;
  };
};

function verificationLabel(value: CompanyListRecord["verificationState"]) {
  if (value === "ACTIVE") return "Verified";
  if (value === "INACTIVE") return "Verification inactive";
  return "Unverified";
}

export function CompanyIdentityField() {
  const record = useRecordContext<CompanyListRecord>();
  if (!record) return null;
  const displayDiffers = record.displayName !== record.legalName;
  return (
    <Stack spacing={0.25} sx={{ minWidth: 220 }}>
      <Typography fontWeight={700}>{record.legalName}</Typography>
      {displayDiffers && (
        <Typography variant="body2" color="text.secondary">
          {record.displayName}
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary">
        Ref: {record.id}
      </Typography>
    </Stack>
  );
}

export function CompanyTrustField() {
  const record = useRecordContext<CompanyListRecord>();
  if (!record) return null;
  const verificationColor =
    record.verificationState === "ACTIVE"
      ? "success"
      : record.verificationState === "INACTIVE"
        ? "error"
        : "warning";
  return (
    <Stack spacing={0.5} alignItems="flex-start">
      <Chip
        label={verificationLabel(record.verificationState)}
        color={verificationColor}
        size="small"
      />
      <Chip
        label={record.moderationState === "BANNED" ? "Banned" : "Normal"}
        color={record.moderationState === "BANNED" ? "error" : "default"}
        size="small"
        variant="outlined"
      />
    </Stack>
  );
}

export function CompanyPeopleField() {
  const record = useRecordContext<CompanyListRecord>();
  if (!record) return null;
  const { activeMembershipCount, activeOwnerCount } = record.metrics;
  const summary = `${activeMembershipCount} active members; ${activeOwnerCount} active owners`;
  return (
    <Tooltip title={summary}>
      <Box role="group" aria-label={`People: ${summary}`}>
        <Typography variant="body2" fontWeight={700}>
          {activeMembershipCount} active members
        </Typography>
        <Chip
          label={`${activeOwnerCount} owner${activeOwnerCount === 1 ? "" : "s"}`}
          color={activeOwnerCount === 0 ? "error" : "default"}
          size="small"
          variant="outlined"
          sx={{ mt: 0.5 }}
        />
      </Box>
    </Tooltip>
  );
}

export function CompanyWorkQueueField() {
  const record = useRecordContext<CompanyListRecord>();
  if (!record) return null;
  const { pendingJobReviewCount, openModerationReportCount } = record.metrics;
  const summary = `${pendingJobReviewCount} pending job reviews; ${openModerationReportCount} open moderation reports`;
  return (
    <Tooltip title={summary}>
      <Stack
        direction="row"
        spacing={0.5}
        useFlexGap
        flexWrap="wrap"
        role="group"
        aria-label={`Work queue: ${summary}`}
      >
        <Chip
          label={`Review ${pendingJobReviewCount}`}
          color={pendingJobReviewCount > 0 ? "warning" : "default"}
          size="small"
        />
        <Chip
          label={`Reports ${openModerationReportCount}`}
          color={openModerationReportCount > 0 ? "error" : "default"}
          size="small"
          variant="outlined"
        />
      </Stack>
    </Tooltip>
  );
}
