"use client";

import { Box, Chip, Stack, Tooltip, Typography } from "@mui/material";
import { useRecordContext } from "react-admin";
import type { AccountListItem } from "@/shared/contracts/admin/resources";

export function AccessRolesField({
  label = "Access roles",
}: {
  label?: string;
}) {
  const record = useRecordContext<AccountListItem>();
  if (!record) return null;

  const labels = [
    ...(record.hasCandidateIdentity ? ["Candidate"] : []),
    ...(record.activeMembershipCount > 0
      ? [
          `Recruiter access at ${record.activeMembershipCount} active ${record.activeMembershipCount === 1 ? "company" : "companies"}`,
        ]
      : []),
    ...(record.hasActiveAdministratorGrant ? ["Platform Administrator"] : []),
  ];

  if (labels.length === 0) {
    return <Typography variant="body2">None</Typography>;
  }

  return (
    <Stack
      direction="row"
      spacing={0.5}
      useFlexGap
      flexWrap="wrap"
      role="group"
      aria-label={`${label}: ${labels.join(", ")}`}
    >
      {record.hasCandidateIdentity && (
        <Tooltip title="Candidate">
          <Chip
            label="C"
            size="small"
            variant="outlined"
            aria-label="Candidate"
          />
        </Tooltip>
      )}
      {record.activeMembershipCount > 0 && (
        <Tooltip
          title={`Recruiter access at ${record.activeMembershipCount} active ${record.activeMembershipCount === 1 ? "company" : "companies"}`}
        >
          <Chip
            label={`R·${record.activeMembershipCount}`}
            size="small"
            variant="outlined"
            aria-label={`Recruiter, ${record.activeMembershipCount} active ${record.activeMembershipCount === 1 ? "company" : "companies"}`}
          />
        </Tooltip>
      )}
      {record.hasActiveAdministratorGrant && (
        <Tooltip title="Platform Administrator">
          <Chip
            label="A"
            size="small"
            variant="outlined"
            aria-label="Platform Administrator"
          />
        </Tooltip>
      )}
    </Stack>
  );
}

export function AccessRolesLegend() {
  return (
    <Box
      component="aside"
      aria-label="Access role legend"
      sx={{ px: 2, py: 1 }}
    >
      <Typography variant="caption" color="text.secondary">
        Access roles: C = Candidate · R = Recruiter (number of active companies)
        · A = Platform Administrator
      </Typography>
    </Box>
  );
}
