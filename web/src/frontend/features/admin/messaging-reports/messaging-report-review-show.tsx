"use client";

import { Alert, Box, Chip, Divider, Paper, Typography } from "@mui/material";
import { Show, useRecordContext, useRefresh } from "react-admin";
import type { AdminMessagingReportDetail } from "@/shared/contracts/admin/messaging-reports";
import { MessagingReportActionPanel } from "./messaging-report-action-panel";

export function MessagingReportReviewContent({
  record,
  onDone,
}: {
  record: AdminMessagingReportDetail;
  onDone: () => void;
}) {
  return (
    <Box sx={{ p: 2, display: "grid", gap: 2, maxWidth: 960 }}>
      <Box>
        <Typography component="h1" variant="h5">
          Messaging report {record.id}
        </Typography>
        <Box sx={{ display: "flex", gap: 1, mt: 1, flexWrap: "wrap" }}>
          <Chip label={record.state} />
          <Chip label={record.category} variant="outlined" />
          <Chip label={`Version ${record.version}`} variant="outlined" />
        </Box>
      </Box>

      <Paper variant="outlined" sx={{ p: 2, display: "grid", gap: 1 }}>
        <Typography component="h2" variant="h6">
          Safe participant references
        </Typography>
        <Typography>
          Reporter: {record.reporterDisplayName} ({record.reporterAccountId})
        </Typography>
        <Typography>
          Reported user: {record.targetDisplayName} ({record.targetAccountId})
        </Typography>
        <Typography>
          Target: {record.targetType}; assigned administrator: {record.assignedAdministratorId ?? "unassigned"}
        </Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, display: "grid", gap: 1 }}>
        <Typography component="h2" variant="h6">
          Reporter detail
        </Typography>
        <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {record.detail ?? "No optional detail was supplied."}
        </Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, display: "grid", gap: 1 }}>
        <Typography component="h2" variant="h6">
          Submitted evidence message
        </Typography>
        {record.evidence ? (
          <>
            <Typography variant="body2" color="text.secondary">
              {record.evidence.senderDisplayName} ({record.evidence.senderAccountId}) · {new Date(record.evidence.sentAt).toLocaleString()}
            </Typography>
            <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {record.evidence.content}
            </Typography>
          </>
        ) : (
          <Alert severity="info">
            No submitted evidence message is available. Conversation history is not accessible from this review.
          </Alert>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, display: "grid", gap: 1 }}>
        <Typography component="h2" variant="h6">
          Private investigation notes
        </Typography>
        {record.notes.length === 0 ? (
          <Typography color="text.secondary">No private notes.</Typography>
        ) : (
          record.notes.map((note) => (
            <Box key={note.id}>
              <Typography sx={{ whiteSpace: "pre-wrap" }}>{note.text}</Typography>
              <Typography variant="caption" color="text.secondary">
                {note.authorAdministratorId} · {new Date(note.createdAt).toLocaleString()}
              </Typography>
            </Box>
          ))
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, display: "grid", gap: 1 }}>
        <Typography component="h2" variant="h6">
          Immutable review history
        </Typography>
        {record.history.length === 0 ? (
          <Typography color="text.secondary">No review actions yet.</Typography>
        ) : (
          record.history.map((event, index) => (
            <Box key={event.id}>
              {index > 0 ? <Divider sx={{ mb: 1 }} /> : null}
              <Typography>
                {event.action}: {event.priorState} to {event.resultingState}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {event.actorAdministratorId} · version {event.resultingVersion} · {new Date(event.occurredAt).toLocaleString()}
              </Typography>
              {event.enforcementCorrelationId ? (
                <Typography variant="body2">
                  Enforcement reference: {event.enforcementCorrelationId}
                </Typography>
              ) : null}
            </Box>
          ))
        )}
      </Paper>

      <MessagingReportActionPanel
        reportId={record.id}
        version={record.version}
        state={record.state}
        onDone={onDone}
      />
    </Box>
  );
}

function Review() {
  const record = useRecordContext<AdminMessagingReportDetail>();
  const refresh = useRefresh();
  if (!record) return null;
  return <MessagingReportReviewContent record={record} onDone={refresh} />;
}

export function MessagingReportReviewShow() {
  return (
    <Show>
      <Review />
    </Show>
  );
}
