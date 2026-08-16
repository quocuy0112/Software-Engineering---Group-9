"use client";
import { Box, Chip, Divider, Paper, Stack, Typography } from "@mui/material";
import { Show, useRecordContext, useRefresh } from "react-admin";
import { JobPostManagementActionPanel } from "./job-post-management-action-panel";

function Detail() {
  const record = useRecordContext<any>();
  const refresh = useRefresh();
  if (!record) return null;
  return (
    <Box sx={{ p: 2, display: "grid", gap: 2 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5">
          {record.publicJobPosting?.title ?? "Managed job"}
        </Typography>
        <Typography color="text.secondary">
          {record.company?.displayName} · Job ID {record.id}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Chip label={`Visibility: ${record.visibilityState}`} />
          <Chip label={`Applications: ${record.applicationState}`} />
          <Chip label={`Version ${record.version}`} />
        </Stack>
      </Paper>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6">Approval and versions</Typography>
        <Typography>
          Live review: {record.approvedVersion?.id ?? "Unavailable"}
        </Typography>
        <Typography>
          Approved by:{" "}
          {record.approvedVersion?.decidedByAdmin?.name ??
            "Imported or unavailable"}
        </Typography>
        <Typography>
          Pending revision: {record.pendingVersion?.id ?? "None"}
        </Typography>
      </Paper>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6">Reports and featured placement</Typography>
        <Typography>
          Linked report actions: {record.reportSummary?.activeCount ?? 0}
        </Typography>
        {record.featuredPlacements?.map((item: any) => (
          <Typography key={item.id}>
            {item.placement}: {item.state} (
            {new Date(item.startsAt).toLocaleString()} -{" "}
            {new Date(item.endsAt).toLocaleString()})
          </Typography>
        ))}
      </Paper>
      <JobPostManagementActionPanel
        jobId={record.id}
        version={record.version}
        onDone={refresh}
      />
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6">Operational timeline</Typography>
        <Divider sx={{ my: 1 }} />
        {record.operationalHistory?.map((entry: any) => (
          <Typography key={entry.id}>
            {new Date(entry.occurredAt).toLocaleString()} · {entry.action} ·{" "}
            {entry.reason ?? "No reason recorded"}
          </Typography>
        ))}
      </Paper>
    </Box>
  );
}
export function JobPostManagementShow() {
  return (
    <Show>
      <Detail />
    </Show>
  );
}
