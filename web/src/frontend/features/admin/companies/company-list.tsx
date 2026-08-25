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
  CompanyIdentityField,
  CompanyPeopleField,
  CompanyTrustField,
  CompanyWorkQueueField,
} from "./company-list-fields";

const filters = [
  <TextInput key="q" source="q" label="Company reference or name" alwaysOn />,
  <SelectInput
    key="verificationState"
    source="verificationState"
    label="Verification"
    choices={[
      { id: "ALL", name: "All" },
      { id: "ACTIVE", name: "Verified" },
      { id: "UNVERIFIED", name: "Unverified" },
      { id: "INACTIVE", name: "Inactive" },
    ]}
  />,
  <SelectInput
    key="moderationState"
    source="moderationState"
    label="Moderation"
    choices={[
      { id: "ALL", name: "All" },
      { id: "ACTIVE", name: "Normal" },
      { id: "BANNED", name: "Banned" },
    ]}
  />,
  <SelectInput
    key="attention"
    source="attention"
    label="Priority"
    choices={[
      { id: "ALL", name: "All companies" },
      { id: "NEEDS_ATTENTION", name: "Needs attention" },
    ]}
  />,
];

export function CompanyList() {
  return (
    <List
      perPage={25}
      pagination={<Pagination rowsPerPageOptions={[25, 50, 100]} />}
      sort={{ field: "updatedAt", order: "DESC" }}
      filters={filters}
    >
      <CurrentListSnapshotDifference />
      <Datagrid bulkActionButtons={false} rowClick="show">
        <FunctionField
          label="Company"
          render={() => <CompanyIdentityField />}
        />
        <FunctionField
          label="Trust & safety"
          render={() => <CompanyTrustField />}
        />
        <FunctionField label="People" render={() => <CompanyPeopleField />} />
        <FunctionField
          label="Work queue"
          render={() => <CompanyWorkQueueField />}
        />
        <DateField source="createdAt" label="Created" showTime />
      </Datagrid>
    </List>
  );
}
