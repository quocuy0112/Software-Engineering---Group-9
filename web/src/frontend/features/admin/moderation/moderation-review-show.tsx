"use client";
import { Box, Typography } from "@mui/material";
import { Show, useRecordContext, useRefresh } from "react-admin";
import { ReportActionPanel } from "./report-action-panel";
type Report = {
  id: string;
  reporterUserId: string;
  targetType: string;
  targetReference: string;
  companyReference: string | null;
  jobReference: string | null;
  applicationReference: string | null;
  category: string;
  normalizedDetail: string | null;
  priority: string;
  state: string;
  version: number;
  assignedAdminUserId: string | null;
  history: Array<{
    id: string;
    action: string;
    priorState: string;
    resultingState: string;
    occurredAt: string;
  }>;
  notes: Array<{
    id: string;
    authorAdminUserId: string;
    normalizedText: string;
    createdAt: string;
  }>;
};
function Review() {
  const record = useRecordContext<Report>();
  const refresh = useRefresh();
  if (!record) return null;
  return (
    <Box sx={{ p: 2, display: "grid", gap: 2 }}>
      <Typography component="h1" variant="h5">
        Moderation report {record.id}
      </Typography>
      <Typography>Reporter account: {record.reporterUserId}</Typography>
      <Typography>
        Target: {record.targetType} / {record.targetReference}
      </Typography>
      <Typography>
        Originating references: company {record.companyReference ?? "none"}; job{" "}
        {record.jobReference ?? "none"}; application{" "}
        {record.applicationReference ?? "none"}
      </Typography>
      <Typography>
        Category: {record.category}; priority: {record.priority}; state:{" "}
        {record.state}
      </Typography>
      <Typography sx={{ whiteSpace: "pre-wrap" }}>
        Detail: {record.normalizedDetail ?? "No optional detail"}
      </Typography>
      <Typography component="h2" variant="h6">
        Private investigation notes
      </Typography>
      {record.notes.map((note) => (
        <Typography key={note.id}>{note.normalizedText}</Typography>
      ))}
      <Typography component="h2" variant="h6">
        Immutable history
      </Typography>
      {record.history.map((item) => (
        <Typography key={item.id}>
          {item.action}: {item.priorState} to {item.resultingState}
        </Typography>
      ))}
      <ReportActionPanel
        reportId={record.id}
        version={record.version}
        state={record.state}
        onDone={refresh}
      />
    </Box>
  );
}
export function ModerationReviewShow() {
  return (
    <Show>
      <Review />
    </Show>
  );
}
