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

type JobPostReviewRecord = {
  id: string;
  jobId: string;
  jobTitle: string;
  companyId: string;
  companyDisplayName: string;
  sequence: number;
  state: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  assignment: string | null;
  submittedAt: string;
  ageSeconds: number;
  version: number;
  integrityState?: "VALID" | "BLOCKED";
};

function formatSubmittedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatWaitingTime(seconds: number) {
  const totalMinutes = Math.floor(Math.max(0, seconds) / 60);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return "Just now";
}

function ReviewStateChip({ state }: { state: JobPostReviewRecord["state"] }) {
  const label =
    state === "PENDING_REVIEW"
      ? "Needs review"
      : state === "APPROVED"
        ? "Approved"
        : "Rejected";
  return (
    <Chip
      label={label}
      size="small"
      color={
        state === "PENDING_REVIEW"
          ? "warning"
          : state === "APPROVED"
            ? "success"
            : "error"
      }
    />
  );
}

function JobField(_props: { label?: string }) {
  const record = useRecordContext<JobPostReviewRecord>();
  if (!record) return null;
  return (
    <Stack spacing={0.25} sx={{ minWidth: 220 }}>
      <RouterLink
        to={`/job-postings/${encodeURIComponent(record.jobId)}/show`}
        onClick={(event) => event.stopPropagation()}
        style={{ color: "inherit", fontWeight: 700, textDecoration: "none" }}
      >
        {record.jobTitle}
      </RouterLink>
      <Typography variant="caption" color="text.secondary">
        Job {record.jobId}
      </Typography>
      {record.integrityState === "BLOCKED" && (
        <Chip
          label="Content integrity blocked"
          color="error"
          size="small"
          variant="outlined"
          sx={{ alignSelf: "flex-start", mt: 0.25 }}
        />
      )}
    </Stack>
  );
}

function CompanyField(_props: { label?: string }) {
  const record = useRecordContext<JobPostReviewRecord>();
  if (!record) return null;
  return (
    <Stack spacing={0.25} sx={{ minWidth: 175 }}>
      <RouterLink
        to={`/companies/${encodeURIComponent(record.companyId)}/show`}
        onClick={(event) => event.stopPropagation()}
        style={{ color: "inherit", fontWeight: 700, textDecoration: "none" }}
      >
        {record.companyDisplayName}
      </RouterLink>
      <Typography variant="caption" color="text.secondary">
        Company {record.companyId}
      </Typography>
    </Stack>
  );
}

function QueueField(_props: { label?: string }) {
  const record = useRecordContext<JobPostReviewRecord>();
  if (!record) return null;
  return (
    <Stack spacing={0.75} alignItems="flex-start" sx={{ minWidth: 155 }}>
      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
        <ReviewStateChip state={record.state} />
        <Chip
          label={record.assignment ? "Assigned" : "Unassigned"}
          color={record.assignment ? "success" : "warning"}
          size="small"
          variant="outlined"
        />
      </Stack>
      {record.assignment && (
        <Typography variant="caption" color="text.secondary">
          Admin {record.assignment}
        </Typography>
      )}
    </Stack>
  );
}

function SubmissionField(_props: { label?: string }) {
  const record = useRecordContext<JobPostReviewRecord>();
  if (!record) return null;
  const ageColor =
    record.state !== "PENDING_REVIEW"
      ? "default"
      : record.ageSeconds >= 72 * 3_600
        ? "error"
        : record.ageSeconds >= 24 * 3_600
          ? "warning"
          : "info";
  return (
    <Stack spacing={0.5} alignItems="flex-start" sx={{ minWidth: 180 }}>
      <Typography variant="body2">
        {formatSubmittedAt(record.submittedAt)}
      </Typography>
      <Chip
        label={
          record.state === "PENDING_REVIEW"
            ? `Waiting ${formatWaitingTime(record.ageSeconds)}`
            : `Submitted ${formatWaitingTime(record.ageSeconds)} ago`
        }
        color={ageColor}
        size="small"
        variant="outlined"
      />
    </Stack>
  );
}

function VersionField(_props: { label?: string }) {
  const record = useRecordContext<JobPostReviewRecord>();
  if (!record) return null;
  return (
    <Stack spacing={0.5} alignItems="flex-start">
      <Chip label={`Submission ${record.sequence}`} size="small" />
      <Typography variant="caption" color="text.secondary">
        Record revision {record.version}
      </Typography>
    </Stack>
  );
}

const filters = [
  <TextInput
    key="q"
    source="q"
    label="Review, job, company reference, or name"
    alwaysOn
  />,
  <SelectInput
    key="state"
    source="state"
    aria-label="Filter by review state"
    choices={[
      { id: "PENDING_REVIEW", name: "Pending review" },
      { id: "APPROVED", name: "Approved" },
      { id: "REJECTED", name: "Rejected" },
    ]}
    emptyText="All statuses"
  />,
  <SelectInput
    key="assignment"
    source="assignment"
    aria-label="Filter by assignment"
    choices={[
      { id: "ANY", name: "Any assignment" },
      { id: "UNASSIGNED", name: "Unassigned" },
      { id: "MINE", name: "Assigned to me" },
    ]}
  />,
  <TextInput
    key="companyId"
    source="companyId"
    aria-label="Filter by company id"
  />,
  <NumberInput
    key="minimumAgeHours"
    source="minimumAgeHours"
    min={0}
    aria-label="Minimum pending age in hours"
  />,
  <NumberInput
    key="sequence"
    source="sequence"
    min={1}
    aria-label="Submission version"
  />,
];

export function JobPostReviewList() {
  return (
    <List
      title="Job Post Reviews"
      filters={filters}
      perPage={25}
      pagination={<Pagination rowsPerPageOptions={[25, 50, 100]} />}
      sort={{ field: "submittedAt", order: "ASC" }}
    >
      <Datagrid
        bulkActionButtons={false}
        rowClick="show"
        rowSx={(record: JobPostReviewRecord) => ({
          bgcolor:
            record.state === "PENDING_REVIEW" && record.ageSeconds >= 72 * 3_600
              ? "error.50"
              : record.state === "PENDING_REVIEW" &&
                  record.ageSeconds >= 24 * 3_600
                ? "warning.50"
                : record.state === "PENDING_REVIEW" && !record.assignment
                  ? "grey.50"
                  : "transparent",
          "&:hover": { bgcolor: "action.hover" },
        })}
      >
        <JobField label="Job" />
        <CompanyField label="Company" />
        <QueueField label="Review queue" />
        <SubmissionField label="Submitted & age" />
        <VersionField label="Submission" />
      </Datagrid>
    </List>
  );
}
