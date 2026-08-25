"use client";
import { Datagrid, List, SelectInput, TextField, TextInput } from "react-admin";

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
      { id: "WITHDRAWN", name: "Withdrawn" },
    ]}
    emptyText="All statuses"
  />,
  <SelectInput
    key="recordStatus"
    source="recordStatus"
    label="Record status"
    aria-label="Filter by record status"
    choices={[
      { id: "ACTIVE", name: "Current records" },
      { id: "DELETED", name: "Deleted archive" },
      { id: "ALL", name: "Current and deleted" },
    ]}
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
  <TextInput
    key="minimumAgeHours"
    source="minimumAgeHours"
    type="number"
    aria-label="Minimum pending age in hours"
  />,
  <TextInput
    key="sequence"
    source="sequence"
    type="number"
    aria-label="Submission version"
  />,
];

export function JobPostReviewList() {
  return (
    <List
      filters={filters}
      filterDefaultValues={{
        state: "PENDING_REVIEW",
        recordStatus: "ACTIVE",
      }}
      sort={{ field: "submittedAt", order: "ASC" }}
    >
      <Datagrid bulkActionButtons={false} rowClick="show">
        <TextField source="jobTitle" label="Job" />
        <TextField source="companyDisplayName" label="Company" />
        <TextField source="state" />
        <TextField source="recordStatus" label="Record" />
        <TextField source="assignment" emptyText="Unassigned" />
        <TextField source="submittedAt" label="Submitted" />
        <TextField source="ageSeconds" label="Age (seconds)" />
        <TextField source="version" label="Version" />
      </Datagrid>
    </List>
  );
}
