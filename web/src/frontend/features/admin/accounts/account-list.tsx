"use client";

import {
  Datagrid,
  DateField,
  FunctionField,
  List,
  Pagination,
  SelectInput,
  TextField,
  TextInput,
} from "react-admin";
import { AccountActivityField } from "./account-activity-field";
import { AccessRolesField } from "./access-roles-field";

const filters = [
  <TextInput
    key="q"
    source="q"
    label="Account reference, name, or email"
    alwaysOn
  />,
  <SelectInput
    key="type"
    source="type"
    label="Account type"
    choices={[
      { id: "ALL", name: "All accounts" },
      { id: "CANDIDATE", name: "Candidates" },
      { id: "RECRUITER", name: "Recruiters" },
    ]}
  />,
  <SelectInput
    key="status"
    source="status"
    label="Account status"
    choices={[
      { id: "ALL", name: "All statuses" },
      { id: "ACTIVE", name: "Active" },
      { id: "SUSPENDED", name: "Suspended" },
    ]}
  />,
  <TextInput
    key="registeredFrom"
    source="registeredFrom"
    label="Registered from (YYYY-MM-DD)"
  />,
  <TextInput
    key="registeredTo"
    source="registeredTo"
    label="Registered to (YYYY-MM-DD)"
  />,
];

export function AccountList() {
  return (
    <List
      filters={filters}
      perPage={25}
      pagination={<Pagination rowsPerPageOptions={[25, 50, 100]} />}
      sort={{ field: "registeredAt", order: "DESC" }}
    >
      <Datagrid bulkActionButtons={false} rowClick="show">
        <TextField source="accountReference" label="Account reference" />
        <TextField source="displayName" />
        <TextField source="maskedEmail" />
        <FunctionField label="Roles" render={() => <AccessRolesField />} />
        <TextField source="status" label="Status" />
        <DateField source="registeredAt" showTime />
        <FunctionField
          label="Activity"
          render={() => <AccountActivityField />}
        />
      </Datagrid>
    </List>
  );
}
