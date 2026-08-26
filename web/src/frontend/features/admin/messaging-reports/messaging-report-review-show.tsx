"use client";

import { Alert, Box, Chip, Divider, Paper, Stack, Typography } from "@mui/material";
import { Show, useRecordContext, useRefresh } from "react-admin";
import type { AdminMessagingReportDetail } from "@/shared/contracts/admin/messaging-reports";
import { MessagingReportActionPanel } from "./messaging-report-action-panel";
import { adminReasonLabel } from "../shared/admin-reason-label";

function sentenceCase(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

function stateColor(state: AdminMessagingReportDetail["state"]) {
  return state === "RESOLVED"
    ? "success"
    : state === "DISMISSED"
      ? "default"
      : "warning";
}

function stateLabel(state: AdminMessagingReportDetail["state"]) {
  return state === "PENDING_REVIEW" ? "Needs review" : sentenceCase(state);
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.3 }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600} sx={{ overflowWrap: "anywhere" }}>
        {value}
      </Typography>
    </Box>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Paper component="section" aria-labelledby={id} variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
      <Stack spacing={1.75}>
        <Typography id={id} component="h2" variant="h6" fontWeight={700}>
          {title}
        </Typography>
        {children}
      </Stack>
    </Paper>
  );
}

export function MessagingReportReviewContent({
  record,
  onDone,
}: {
  record: AdminMessagingReportDetail;
  onDone: () => void;
}) {
  return (
    <Box sx={{ width: "100%", maxWidth: 1200, mx: "auto", p: { xs: 1, sm: 2 }, display: "grid", gap: 2.5 }}>
      <Paper
        component="header"
        elevation={0}
        sx={{
          p: { xs: 2, sm: 2.5 },
          border: 1,
          borderColor: "divider",
          borderRadius: 2,
          background: "linear-gradient(135deg, rgba(237, 108, 2, 0.1), transparent 60%)",
        }}
      >
        <Stack spacing={2}>
          <Box>
            <Typography component="h1" variant="h5" fontWeight={700}>
              Messaging report review
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Reference: {record.id}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip label={stateLabel(record.state)} color={stateColor(record.state)} />
            <Chip label={adminReasonLabel(record.category)} variant="outlined" />
            <Chip label={`${sentenceCase(record.targetType)} report`} variant="outlined" />
            <Chip label={`Version ${record.version}`} size="small" variant="outlined" />
          </Stack>
          <Divider />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
            <Detail label="Reporter" value={record.reporterDisplayName} />
            <Detail label="Reported user" value={record.targetDisplayName} />
            <Detail label="Assigned administrator" value={record.assignedAdministratorId ?? "Unassigned"} />
          </Box>
        </Stack>
      </Paper>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.45fr) minmax(300px, 0.85fr)" }, gap: 2.5, alignItems: "start" }}>
        <Stack spacing={2.5}>
          <Section id="messaging-report-summary" title="Report summary">
            <Typography sx={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
              {record.detail ?? "No optional detail was supplied."}
            </Typography>
            <Divider />
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
              <Detail label="Target type" value={sentenceCase(record.targetType)} />
              <Detail label="Reported at" value={new Date(record.createdAt).toLocaleString()} />
              <Detail label="Handled by" value={record.handledByAdministratorId ?? "Not handled"} />
            </Box>
          </Section>

          <Section id="messaging-report-evidence" title="Submitted evidence">
            {record.evidence ? (
              <>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
                  <Detail label="Message sender" value={record.evidence.senderDisplayName} />
                  <Detail label="Sent at" value={new Date(record.evidence.sentAt).toLocaleString()} />
                </Box>
                <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "action.hover", borderRadius: 1.5 }}>
                  <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.65 }}>
                    {record.evidence.content}
                  </Typography>
                </Paper>
              </>
            ) : (
              <Alert severity="info">
                No submitted evidence message is available. Conversation history is not accessible from this review.
              </Alert>
            )}
          </Section>

          <Section id="messaging-report-notes" title="Private investigation notes">
            {record.notes.length === 0 ? (
              <Typography color="text.secondary">No private notes recorded.</Typography>
            ) : (
              <Stack spacing={1.25} divider={<Divider flexItem />}>
                {record.notes.map((note) => (
                  <Box key={note.id}>
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                      {note.text}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {note.authorAdministratorId} · {new Date(note.createdAt).toLocaleString()}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </Section>
        </Stack>

        <Stack spacing={2.5} sx={{ position: { lg: "sticky" }, top: { lg: 16 } }}>
          <Section id="messaging-report-actions" title="Review actions">
            <MessagingReportActionPanel reportId={record.id} version={record.version} state={record.state} onDone={onDone} />
          </Section>
          <Section id="messaging-report-history" title="Immutable history">
            {record.history.length === 0 ? (
              <Typography color="text.secondary">No review actions yet.</Typography>
            ) : (
              <Stack spacing={0}>
                {record.history.map((event, index) => (
                  <Box key={event.id} sx={{ display: "grid", gridTemplateColumns: "18px minmax(0, 1fr)", columnGap: 1.25, pb: index === record.history.length - 1 ? 0 : 2 }}>
                    <Box sx={{ position: "relative", display: "flex", justifyContent: "center" }}>
                      <Box sx={{ width: 10, height: 10, mt: 0.75, borderRadius: "50%", bgcolor: `${stateColor(event.resultingState)}.main`, boxShadow: 1, zIndex: 1 }} />
                      {index < record.history.length - 1 ? (
                        <Box sx={{ position: "absolute", top: 15, bottom: -1, borderLeft: 2, borderColor: "divider" }} />
                      ) : null}
                    </Box>
                    <Stack spacing={0.6} sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={700}>{sentenceCase(event.action)}</Typography>
                      <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Chip label={sentenceCase(event.priorState)} size="small" variant="outlined" />
                        <Typography variant="caption" color="text.secondary">to</Typography>
                        <Chip label={sentenceCase(event.resultingState)} size="small" color={stateColor(event.resultingState)} />
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {event.actorAdministratorId} · version {event.resultingVersion} · {new Date(event.occurredAt).toLocaleString()}
                      </Typography>
                      {event.enforcementCorrelationId ? (
                        <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                          Enforcement ref: {event.enforcementCorrelationId}
                        </Typography>
                      ) : null}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Section>
        </Stack>
      </Box>
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
