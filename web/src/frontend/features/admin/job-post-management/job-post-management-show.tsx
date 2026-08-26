"use client";
import { Box, Chip, Divider, Paper, Stack, Typography } from "@mui/material";
import { Show, useRecordContext, useRefresh } from "react-admin";
import { JobPostManagementActionPanel } from "./job-post-management-action-panel";
import { adminReasonLabel } from "../shared/admin-reason-label";

type ManagementRecord = {
  id: string;
  version: number;
  visibilityState: string;
  applicationState: string;
  applicationCount?: number;
  recruiterContact?: { name: string; maskedEmail: string } | null;
  company?: { displayName?: string };
  publicJobPosting?: { title?: string };
  approvedVersion?: { id?: string; decidedByAdmin?: { name?: string } };
  pendingVersion?: { id?: string };
  reportSummary?: {
    activeCount?: number;
    distinctReporterCount?: number;
    highestPriority?: string | null;
  };
  reports?: Array<{
    id: string;
    category: string;
    priority: string;
    createdAt: string;
  }>;
  featuredPlacements?: Array<{
    id: string;
    placement: string;
    state: string;
    startsAt: string;
    endsAt: string;
  }>;
  operationalHistory?: Array<{
    id: string;
    occurredAt: string;
    action: string;
    reason: string | null;
  }>;
};

function Detail() {
  const record = useRecordContext<ManagementRecord>();
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
          <Chip label={`Applicants: ${record.applicationCount ?? 0}`} />
          <Chip label={`Version ${record.version}`} />
        </Stack>
      </Paper>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6">Recruiter contact</Typography>
        {record.recruiterContact ? (
          <Typography>
            {record.recruiterContact.name} ·{" "}
            {record.recruiterContact.maskedEmail}
          </Typography>
        ) : (
          <Typography color="text.secondary">Unavailable</Typography>
        )}
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
          Active reports: {record.reportSummary?.activeCount ?? 0}; distinct
          reporters: {record.reportSummary?.distinctReporterCount ?? 0}; highest
          priority: {record.reportSummary?.highestPriority ?? "none"}
        </Typography>
        {record.reports?.map((report) => (
          <Typography key={report.id} sx={{ mt: 1 }}>
            Report {report.id}: {adminReasonLabel(report.category)} /{" "}
            {adminReasonLabel(report.priority)} /{" "}
            {new Date(report.createdAt).toLocaleString()}
          </Typography>
        ))}
        {record.featuredPlacements?.map((item) => (
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
        featuredPlacements={record.featuredPlacements ?? []}
        onDone={refresh}
      />
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6">Operational timeline</Typography>
        <Divider sx={{ my: 1 }} />
        {record.operationalHistory?.map((entry) => (
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
