"use client";

import { Box, Chip, Divider, Paper, Stack, Typography } from "@mui/material";
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
  enforcementLinks: Array<{
    enforcementAction: {
      id: string;
      type: string;
      reason: string;
      occurredAt: string;
      targets: Array<{ targetType: string; targetReference: string }>;
    };
  }>;
};

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mb: 0.25 }}
      >
        {label}
      </Typography>
      <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
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
    <Paper
      component="section"
      aria-labelledby={id}
      variant="outlined"
      sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}
    >
      <Stack spacing={1.75}>
        <Typography id={id} component="h2" variant="h6">
          {title}
        </Typography>
        {children}
      </Stack>
    </Paper>
  );
}

function Review() {
  const record = useRecordContext<Report>();
  const refresh = useRefresh();
  if (!record) return null;
  const priorityColor =
    record.priority === "CRITICAL"
      ? "error"
      : record.priority === "HIGH"
        ? "warning"
        : "default";
  const stateColor =
    record.state === "RESOLVED"
      ? "success"
      : record.state === "DISMISSED"
        ? "default"
        : "warning";

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 1200,
        mx: "auto",
        p: { xs: 1, sm: 2 },
        display: "grid",
        gap: 2.5,
      }}
    >
      <Paper
        component="header"
        elevation={0}
        sx={{
          p: { xs: 2, sm: 2.5 },
          border: 1,
          borderColor: "divider",
          borderRadius: 2,
          background:
            "linear-gradient(135deg, rgba(237, 108, 2, 0.10), transparent 60%)",
        }}
      >
        <Stack spacing={2}>
          <Box>
            <Typography component="h1" variant="h5" sx={{ fontWeight: 700 }}>
              Moderation report
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Reference: {record.id}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip label={record.state} color={stateColor} />
            <Chip
              label={`${record.priority} priority`}
              color={priorityColor}
              variant="outlined"
            />
            <Chip label={record.category} variant="outlined" />
          </Stack>
          <Divider />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(3, minmax(0, 1fr))",
              },
              gap: 2,
            }}
          >
            <Detail label="Reporter account" value={record.reporterUserId} />
            <Detail
              label="Target"
              value={`${record.targetType} · ${record.targetReference}`}
            />
            <Detail
              label="Assigned administrator"
              value={record.assignedAdminUserId ?? "Unassigned"}
            />
          </Box>
        </Stack>
      </Paper>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            lg: "minmax(0, 1.45fr) minmax(300px, 0.85fr)",
          },
          gap: 2.5,
          alignItems: "start",
        }}
      >
        <Stack spacing={2.5}>
          <Section id="report-detail-heading" title="Report detail">
            <Typography sx={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
              {record.normalizedDetail ?? "No optional detail was supplied."}
            </Typography>
            <Divider />
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(3, minmax(0, 1fr))",
                },
                gap: 2,
              }}
            >
              <Detail
                label="Company reference"
                value={record.companyReference ?? "None"}
              />
              <Detail
                label="Job reference"
                value={record.jobReference ?? "None"}
              />
              <Detail
                label="Application reference"
                value={record.applicationReference ?? "None"}
              />
            </Box>
          </Section>
          <Section id="notes-heading" title="Private investigation notes">
            {record.notes.length === 0 ? (
              <Typography color="text.secondary">
                No private notes recorded.
              </Typography>
            ) : (
              <Stack spacing={1.25} divider={<Divider flexItem />}>
                {record.notes.map((note) => (
                  <Box key={note.id}>
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                      {note.normalizedText}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {note.authorAdminUserId} ·{" "}
                      {new Date(note.createdAt).toLocaleString()}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </Section>
          <Section id="enforcement-heading" title="Linked enforcement">
            {record.enforcementLinks.length ? (
              <Stack spacing={1.25} divider={<Divider flexItem />}>
                {record.enforcementLinks.map(({ enforcementAction }) => (
                  <Box key={enforcementAction.id}>
                    <Typography variant="body2" fontWeight={600}>
                      {enforcementAction.type}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {enforcementAction.reason}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {enforcementAction.targets
                        .map(
                          (target) =>
                            `${target.targetType} ${target.targetReference}`,
                        )
                        .join(", ")}{" "}
                      ·{" "}
                      {new Date(enforcementAction.occurredAt).toLocaleString()}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            ) : (
              <Typography color="text.secondary">
                No enforcement linked.
              </Typography>
            )}
          </Section>
        </Stack>

        <Stack
          spacing={2.5}
          sx={{ position: { lg: "sticky" }, top: { lg: 16 } }}
        >
          <Section id="report-actions-heading" title="Report actions">
            <ReportActionPanel
              reportId={record.id}
              version={record.version}
              state={record.state}
              onDone={refresh}
            />
          </Section>
          <Section id="history-heading" title="Immutable history">
            {record.history.length === 0 ? (
              <Typography color="text.secondary">
                No history recorded.
              </Typography>
            ) : (
              <Stack spacing={1.25} divider={<Divider flexItem />}>
                {record.history.map((item) => (
                  <Box key={item.id}>
                    <Typography variant="body2" fontWeight={600}>
                      {item.action}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.priorState} → {item.resultingState} ·{" "}
                      {new Date(item.occurredAt).toLocaleString()}
                    </Typography>
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

export function ModerationReviewShow() {
  return (
    <Show>
      <Review />
    </Show>
  );
}
