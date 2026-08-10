"use client";
import {
  BooleanField,
  BooleanInput,
  Datagrid,
  DateField,
  List,
  Pagination,
  SelectInput,
  TextField,
  TextInput,
} from "react-admin";
import { CurrentListSnapshotDifference } from "../dashboard/snapshot-difference-notice";

const filters = [
  <TextInput
    key="q"
    source="q"
    label="Account reference, name, or exact email"
    alwaysOn
  />,
  <SelectInput
    key="state"
    source="state"
    choices={["ACTIVE", "SUSPENDED", "PENDING_VERIFICATION", "DELETED"].map(
      (id) => ({ id, name: id }),
    )}
  />,
  <BooleanInput
    key="recruiterEnabled"
    source="recruiterEnabled"
    label="Recruiter enabled"
  />,
  <SelectInput
    key="membershipRole"
    source="membershipRole"
    choices={["OWNER", "HR_MANAGER", "RECRUITER", "HIRING_MANAGER"].map(
      (id) => ({ id, name: id }),
    )}
  />,
  <SelectInput
    key="membershipState"
    source="membershipState"
    choices={["ACTIVE", "SUSPENDED", "REMOVED"].map((id) => ({ id, name: id }))}
  />,
];

export function AccountList() {
  return (
    <List
      filters={filters}
      perPage={25}
      pagination={<Pagination rowsPerPageOptions={[25, 50, 100]} />}
      sort={{ field: "createdAt", order: "DESC" }}
    >
      <CurrentListSnapshotDifference />
      <Datagrid bulkActionButtons={false} rowClick="show">
        <TextField source="id" label="Account reference" />
        <TextField source="displayName" />
        <TextField source="maskedEmail" />
        <TextField source="state" />
        <DateField source="createdAt" showTime />
        <TextField source="activeMembershipCount" />
        <BooleanField source="hasActiveAdministratorGrant" />
      </Datagrid>
    </List>
  );
}
