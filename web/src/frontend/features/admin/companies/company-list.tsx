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

const filters = [
  <TextInput key="q" source="q" label="Company reference or name" alwaysOn />,
  <SelectInput
    key="verificationState"
    source="verificationState"
    label="Verification status"
    choices={[
      { id: "ALL", name: "All statuses" },
      { id: "ACTIVE", name: "Active" },
      { id: "UNVERIFIED", name: "Unverified" },
      { id: "INACTIVE", name: "Inactive" },
    ]}
  />,
  <TextInput
    key="createdFrom"
    source="createdFrom"
    label="Created from (YYYY-MM-DD)"
  />,
  <TextInput
    key="createdTo"
    source="createdTo"
    label="Created to (YYYY-MM-DD)"
  />,
];

export function CompanyList() {
  return (
    <List
      perPage={25}
      pagination={<Pagination rowsPerPageOptions={[25, 50, 100]} />}
      sort={{ field: "legalName", order: "ASC" }}
      filters={filters}
    >
      <CurrentListSnapshotDifference />
      <Datagrid bulkActionButtons={false} rowClick="show">
        <TextField source="legalName" label="Legal name" />
        <TextField source="displayName" label="Display name" />
        <TextField source="verificationState" label="Verification" />
        <TextField source="id" label="Company reference" />
      </Datagrid>
    </List>
  );
}
