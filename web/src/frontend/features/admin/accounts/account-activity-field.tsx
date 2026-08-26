"use client";

import { Box, Chip, Stack, Tooltip, Typography } from "@mui/material";
import { useRecordContext } from "react-admin";
import type { AccountDirectoryItem } from "@/shared/contracts/admin/resources";

type CandidateCounts = {
  kind: "CANDIDATE";
  cvCount: number;
  applicationCount: number;
};

type RecruiterCounts = {
  kind: "RECRUITER";
  active: number;
  pendingReview: number;
  rejected: number;
  draft: number;
  closed: number;
};

function hasAvailableCounts(
  value: AccountDirectoryItem["counts"],
): value is CandidateCounts | RecruiterCounts {
  return !("unavailable" in value && value.unavailable);
}

function candidateSummary(value: CandidateCounts) {
  return `CVs: ${value.cvCount}; applications: ${value.applicationCount}`;
}

function recruiterSummary(value: RecruiterCounts) {
  return [
    `Active: ${value.active}`,
    `Pending review: ${value.pendingReview}`,
    `Draft: ${value.draft}`,
    `Rejected: ${value.rejected}`,
    `Closed: ${value.closed}`,
  ].join("; ");
}

export function AccountActivityField() {
  const record = useRecordContext<AccountDirectoryItem>();
  if (!record) return null;
  const { counts } = record;

  if (!hasAvailableCounts(counts)) {
    return <Typography variant="body2">Unavailable</Typography>;
  }

  if (counts.kind === "CANDIDATE") {
    const summary = candidateSummary(counts);
    return (
      <Tooltip title={summary}>
        <Stack
          direction="row"
          spacing={0.5}
          useFlexGap
          flexWrap="wrap"
          role="group"
          aria-label={`Candidate activity: ${summary}`}
        >
          <Chip label={`${counts.cvCount} CVs`} size="small" />
          <Chip
            label={`${counts.applicationCount} applications`}
            size="small"
            variant="outlined"
          />
        </Stack>
      </Tooltip>
    );
  }

  const total =
    counts.active +
    counts.pendingReview +
    counts.rejected +
    counts.draft +
    counts.closed;
  const summary = recruiterSummary(counts);
  return (
    <Tooltip title={summary}>
      <Box role="group" aria-label={`Recruiter activity: ${summary}`}>
        <Typography variant="body2" fontWeight={700}>
          {total} job posts
        </Typography>
        <Stack
          direction="row"
          spacing={0.5}
          useFlexGap
          flexWrap="wrap"
          sx={{ mt: 0.5 }}
        >
          <Chip
            label={`Active ${counts.active}`}
            color="success"
            size="small"
          />
          <Chip
            label={`Review ${counts.pendingReview}`}
            color="warning"
            size="small"
          />
        </Stack>
      </Box>
    </Tooltip>
  );
}
