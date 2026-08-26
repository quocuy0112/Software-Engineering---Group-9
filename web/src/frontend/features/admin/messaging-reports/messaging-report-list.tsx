"use client";

import { Chip, Stack, Typography } from "@mui/material";
import {
  Datagrid,
  List,
  NumberInput,
  Pagination,
  SelectInput,
  TextInput,
  useRecordContext,
} from "react-admin";
import { Link as RouterLink } from "react-router-dom";
import { CurrentListSnapshotDifference } from "../dashboard/snapshot-difference-notice";

type MessagingReportRecord = {
  id: string;
  reporterAccountId: string;
  reporterDisplayName: string;
  targetAccountId: string;
  targetDisplayName: string;
  targetType: "PARTICIPANT" | "CONVERSATION";
  category: string;
  state: "PENDING_REVIEW" | "RESOLVED" | "DISMISSED";
  assignedAdministratorId: string | null;
  evidenceAvailable: boolean;
  createdAt: string;
};

function sentenceCase(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

function ageSince(value: string) {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "Unknown age";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

const choices = (values: string[]) =>
  values.map((id) => ({ id, name: sentenceCase(id) }));

function StateChip({ state }: { state: MessagingReportRecord["state"] }) {
  const label =
    state === "PENDING_REVIEW" ? "Needs review" : sentenceCase(state);
  return (
    <Chip
      label={label}
      size="small"
      color={
        state === "PENDING_REVIEW"
          ? "warning"
          : state === "RESOLVED"
            ? "success"
            : "default"
      }
      variant={state === "DISMISSED" ? "outlined" : "filled"}
    />
  );
}

function ParticipantsField(props: { label?: string }) {
  void props;
  const record = useRecordContext<MessagingReportRecord>();
  if (!record) return null;
  return (
    <Stack spacing={0.75} sx={{ minWidth: 230 }}>
      <Stack spacing={0.15}>
        <Typography variant="caption" color="text.secondary">
          Reporter
        </Typography>
        <RouterLink
          to={`/accounts/${encodeURIComponent(record.reporterAccountId)}/show`}
          onClick={(event) => event.stopPropagation()}
          style={{ color: "inherit", fontWeight: 700, textDecoration: "none" }}
        >
          {record.reporterDisplayName}
        </RouterLink>
      </Stack>
      <Stack spacing={0.15}>
        <Typography variant="caption" color="text.secondary">
          Reported user
        </Typography>
        <RouterLink
          to={`/accounts/${encodeURIComponent(record.targetAccountId)}/show`}
          onClick={(event) => event.stopPropagation()}
          style={{ color: "inherit", fontWeight: 700, textDecoration: "none" }}
        >
          {record.targetDisplayName}
        </RouterLink>
      </Stack>
    </Stack>
  );
}

function ReportField(props: { label?: string }) {
  void props;
  const record = useRecordContext<MessagingReportRecord>();
  if (!record) return null;
  return (
    <Stack spacing={0.75} alignItems="flex-start" sx={{ minWidth: 210 }}>
      <Chip label={sentenceCase(record.category)} size="small" variant="outlined" />
      <Typography variant="body2" color="text.secondary">
        {sentenceCase(record.targetType)} report
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Ref {record.id}
      </Typography>
    </Stack>
  );
}

function QueueField(props: { label?: string }) {
  void props;
  const record = useRecordContext<MessagingReportRecord>();
  if (!record) return null;
  return (
    <Stack spacing={0.75} alignItems="flex-start" sx={{ minWidth: 160 }}>
      <StateChip state={record.state} />
      <Chip
        label={record.assignedAdministratorId ? "Assigned" : "Unassigned"}
        size="small"
        color={record.assignedAdministratorId ? "success" : "warning"}
        variant="outlined"
      />
      {record.assignedAdministratorId ? (
        <Typography variant="caption" color="text.secondary">
          Admin {record.assignedAdministratorId}
        </Typography>
      ) : null}
    </Stack>
  );
}

function ActivityField(props: { label?: string }) {
  void props;
  const record = useRecordContext<MessagingReportRecord>();
  if (!record) return null;
  return (
    <Stack spacing={0.75} alignItems="flex-start" sx={{ minWidth: 165 }}>
      <Chip
        label={record.evidenceAvailable ? "Evidence attached" : "No evidence"}
        size="small"
        color={record.evidenceAvailable ? "info" : "default"}
        variant="outlined"
      />
      <Typography variant="body2">
        Reported {new Date(record.createdAt).toLocaleString()}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Age {ageSince(record.createdAt)}
      </Typography>
    </Stack>
  );
}

export function MessagingReportList() {
  return (
    <List
      title="Messaging Reports"
      perPage={25}
      pagination={<Pagination rowsPerPageOptions={[25, 50, 100]} />}
      sort={{ field: "createdAt", order: "ASC" }}
      filters={[
        <TextInput
          key="q"
          source="q"
          label="Search report, reporter, or reported user"
          alwaysOn
        />,
        <SelectInput
          key="targetType"
          source="targetType"
          label="Report target"
          choices={choices(["PARTICIPANT", "CONVERSATION"])}
          emptyText="All targets"
        />,
        <SelectInput
          key="category"
          source="category"
          label="Category"
          choices={choices([
            "FRAUD_OR_IMPERSONATION",
            "MISLEADING_CONTENT",
            "DISCRIMINATION_OR_HARASSMENT",
            "ABUSE_OR_THREATS",
            "SPAM_OR_DUPLICATE",
            "PRIVACY_OR_DATA_MISUSE",
            "OTHER",
          ])}
          emptyText="All categories"
        />,
        <SelectInput
          key="state"
          source="state"
          label="Review state"
          choices={choices(["PENDING_REVIEW", "RESOLVED", "DISMISSED"])}
          emptyText="All states"
        />,
        <NumberInput
          key="age"
          source="age"
          label="Minimum age (hours)"
          min={0}
        />,
        <TextInput
          key="assigneeId"
          source="assigneeId"
          label="Assignee account ID"
          helperText="Use UNASSIGNED for reports awaiting ownership."
        />,
      ]}
    >
      <CurrentListSnapshotDifference />
      <Datagrid
        bulkActionButtons={false}
        rowClick="show"
        rowSx={(record: MessagingReportRecord) => ({
          bgcolor:
            record.state === "PENDING_REVIEW" &&
            !record.assignedAdministratorId
              ? "warning.50"
              : "transparent",
          "&:hover": { bgcolor: "action.hover" },
        })}
      >
        <ParticipantsField label="Participants" />
        <ReportField label="Report" />
        <QueueField label="Review queue" />
        <ActivityField label="Evidence & activity" />
      </Datagrid>
    </List>
  );
}
