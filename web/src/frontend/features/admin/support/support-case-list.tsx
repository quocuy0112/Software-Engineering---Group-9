"use client";

import { useCallback } from "react";
import {
  Datagrid,
  DateField,
  List,
  Pagination,
  SelectInput,
  TextField,
  TextInput,
  useRefresh,
} from "react-admin";
import { useSupportInvalidation } from "@/frontend/features/support/client/use-support-invalidation";

const choices = (values: string[]) =>
  values.map((id) => ({ id, name: id.replaceAll("_", " ") }));

function SupportInboxRealtime() {
  const refresh = useRefresh();
  useSupportInvalidation(useCallback(() => refresh(), [refresh]));
  return null;
}

export function SupportCaseList() {
  return (
    <List
      title="Support Inbox"
      perPage={25}
      pagination={<Pagination rowsPerPageOptions={[25, 50, 100]} />}
      filters={[
        <TextInput
          key="q"
          source="q"
          label="Case reference, requester, or subject"
          alwaysOn
        />,
        <SelectInput
          key="state"
          source="state"
          choices={choices([
            "OPEN",
            "WAITING_FOR_USER",
            "WAITING_FOR_SUPPORT",
            "RESOLVED",
            "CLOSED",
          ])}
          emptyText="All statuses"
        />,
        <SelectInput
          key="category"
          source="category"
          choices={choices([
            "ACCOUNT_ACCESS",
            "PROFILE",
            "JOBS_APPLICATIONS",
            "RECRUITER",
            "MESSAGING",
            "PRIVACY_SAFETY",
            "OTHER",
          ])}
        />,
        <TextInput
          key="assigneeId"
          source="assigneeId"
          label="Assignee ID or UNASSIGNED"
        />,
        <TextInput key="age" source="age" label="Minimum age (hours)" />,
      ]}
    >
      <SupportInboxRealtime />
      <Datagrid bulkActionButtons={false} rowClick="show">
        <TextField source="id" label="Case" />
        <TextField source="requesterDisplayName" label="Requester" />
        <TextField source="requesterMaskedEmail" label="Email" />
        <TextField source="category" />
        <TextField source="subject" />
        <TextField source="state" />
        <TextField
          source="currentAssigneeUserId"
          label="Assignee"
          emptyText="Unassigned"
        />
        <DateField source="updatedAt" showTime />
      </Datagrid>
    </List>
  );
}
