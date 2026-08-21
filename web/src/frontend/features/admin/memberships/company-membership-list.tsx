"use client";
import {
  Datagrid,
  List,
  Pagination,
  SelectInput,
  TextField,
  TextInput,
} from "react-admin";
import { CurrentListSnapshotDifference } from "../dashboard/snapshot-difference-notice";
const choices = (values: string[]) => values.map((id) => ({ id, name: id }));

const filters = [
  <TextInput
    key="q"
    source="q"
    label="Membership, company, or account"
    alwaysOn
  />,
  <TextInput key="companyId" source="companyId" label="Company reference" />,
  <TextInput key="accountId" source="accountId" label="Account reference" />,
  <SelectInput
    key="role"
    source="role"
    choices={choices(["OWNER", "HR_MANAGER", "RECRUITER", "HIRING_MANAGER"])}
  />,
  <SelectInput
    key="state"
    source="state"
    choices={choices(["ACTIVE", "SUSPENDED", "REMOVED"])}
  />,
];

export function CompanyMembershipList() {
  return (
    <List
      perPage={25}
      pagination={<Pagination rowsPerPageOptions={[25, 50, 100]} />}
      sort={{ field: "createdAt", order: "DESC" }}
      filters={filters}
    >
      <CurrentListSnapshotDifference />
      <Datagrid bulkActionButtons={false} rowClick="show">
        <TextField source="id" label="Membership reference" />
        <TextField source="company.legalName" />
        <TextField source="companyId" />
        <TextField source="accountDisplayName" />
        <TextField source="accountId" />
        <TextField source="role" />
        <TextField source="state" />
        <TextField source="accessState" label="Effective access" />
        <TextField source="priorApprovedRole" />
      </Datagrid>
    </List>
  );
}
