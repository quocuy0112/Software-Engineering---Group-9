"use client";

import {
  Datagrid,
  DateField,
  FunctionField,
  List,
  Pagination,
  SelectInput,
  TextInput,
} from "react-admin";
import { CurrentListSnapshotDifference } from "../dashboard/snapshot-difference-notice";
import {
  VerificationApplicantField,
  VerificationAssignmentField,
  VerificationCompanyField,
  VerificationStateField,
} from "./verification-list-fields";

const filters = [
  <TextInput
    key="q"
    source="q"
    label="Request reference, tax code, or company"
    alwaysOn
  />,
  <SelectInput
    key="state"
    source="state"
    label="Review status"
    choices={[
      "PENDING_CHECKS",
      "PENDING_REVIEW",
      "CHANGES_REQUESTED",
      "APPROVED",
      "REJECTED",
      "CANCELLED",
      "EXPIRED",
    ].map((id) => ({ id, name: id.replace(/_/gu, " ") }))}
    emptyText="All statuses"
  />,
  <SelectInput
    key="assignment"
    source="assignment"
    label="Assignment"
    choices={[
      { id: "UNASSIGNED", name: "Unassigned" },
      { id: "MINE", name: "Claimed by me" },
      { id: "ANY", name: "All assignments" },
    ]}
  />,
  <SelectInput
    key="applicantEligibility"
    source="applicantEligibility"
    label="Applicant account"
    choices={[
      { id: "ACTIVE_ONLY", name: "Active" },
      { id: "SUSPENDED_ONLY", name: "Suspended" },
      { id: "ANY", name: "All accounts" },
    ]}
  />,
  <TextInput
    key="submittedFrom"
    source="submittedFrom"
    label="Submitted from (YYYY-MM-DD)"
  />,
  <TextInput
    key="submittedTo"
    source="submittedTo"
    label="Submitted to (YYYY-MM-DD)"
  />,
];

export function VerificationRequestList() {
  return (
    <List
      perPage={25}
      pagination={<Pagination rowsPerPageOptions={[25, 50, 100]} />}
      sort={{ field: "createdAt", order: "ASC" }}
      filters={filters}
    >
      <CurrentListSnapshotDifference />
      <Datagrid
        bulkActionButtons={false}
        rowClick="show"
        rowSx={(record) =>
          record.state === "PENDING_REVIEW" &&
          record.assignmentStatus === "UNASSIGNED"
            ? {
                backgroundColor: "warning.50",
                "&:hover": { backgroundColor: "warning.100" },
              }
            : {}
        }
      >
        <FunctionField
          label="Company & request"
          render={() => <VerificationCompanyField />}
        />
        <FunctionField
          label="Applicant"
          render={() => <VerificationApplicantField />}
        />
        <FunctionField
          label="Review"
          render={() => <VerificationStateField />}
        />
        <FunctionField
          label="Assignment"
          render={() => <VerificationAssignmentField />}
        />
        <DateField source="submittedAt" label="Submitted" showTime />
      </Datagrid>
    </List>
  );
}
