"use client";
import {
  Datagrid,
  DateField,
  List,
  Pagination,
  SelectInput,
  TextField,
  TextInput,
} from "react-admin";
import { CurrentListSnapshotDifference } from "../dashboard/snapshot-difference-notice";
export function VerificationRequestList() {
  return (
    <List
      perPage={25}
      pagination={<Pagination rowsPerPageOptions={[25, 50, 100]} />}
      sort={{ field: "createdAt", order: "ASC" }}
      filters={[
        <SelectInput
          key="state"
          source="state"
          choices={[
            "PENDING_CHECKS",
            "PENDING_REVIEW",
            "CHANGES_REQUESTED",
            "APPROVED",
            "REJECTED",
            "CANCELLED",
            "EXPIRED",
          ].map((id) => ({ id, name: id }))}
        />,
        <TextInput key="company" source="company" />,
        <TextInput
          key="targetCompanyId"
          source="targetCompanyId"
          label="Target company reference"
        />,
        <TextInput key="taxCode" source="taxCode" />,
        <SelectInput
          key="applicantEligibility"
          source="applicantEligibility"
          choices={["ACTIVE_ONLY", "SUSPENDED_ONLY", "ANY"].map((id) => ({
            id,
            name: id,
          }))}
        />,
        <SelectInput
          key="assignment"
          source="assignment"
          choices={["UNASSIGNED", "MINE", "ANY"].map((id) => ({
            id,
            name: id,
          }))}
        />,
      ]}
    >
      <CurrentListSnapshotDifference />
      <Datagrid bulkActionButtons={false} rowClick="show">
        <TextField source="id" />
        <TextField source="applicantId" label="Applicant" />
        <TextField source="companyName" />
        <TextField source="taxCode" />
        <TextField source="state" />
        <TextField source="applicantEligibility" label="Applicant account" />
        <TextField source="resubmissionCount" />
        <TextField source="assignedAdminRef" label="Assigned administrator" />
        <DateField source="submittedAt" showTime />
      </Datagrid>
    </List>
  );
}
