"use client";

import {
  BooleanField,
  Datagrid,
  DateField,
  List,
  Pagination,
  SelectInput,
  TextField,
  TextInput,
} from "react-admin";

const choices = (values: string[]) => values.map((id) => ({ id, name: id }));

export function MessagingReportList() {
  return (
    <List
      title="Messaging reports"
      perPage={25}
      pagination={<Pagination rowsPerPageOptions={[25, 50, 100]} />}
      sort={{ field: "createdAt", order: "ASC" }}
      filters={[
        <TextInput
          key="q"
          source="q"
          label="Report reference or account name"
          alwaysOn
        />,
        <SelectInput
          key="targetType"
          source="targetType"
          choices={choices(["PARTICIPANT", "CONVERSATION"])}
        />,
        <SelectInput
          key="category"
          source="category"
          choices={choices([
            "FRAUD_OR_IMPERSONATION",
            "MISLEADING_CONTENT",
            "DISCRIMINATION_OR_HARASSMENT",
            "ABUSE_OR_THREATS",
            "SPAM_OR_DUPLICATE",
            "PRIVACY_OR_DATA_MISUSE",
            "OTHER",
          ])}
        />,
        <SelectInput
          key="state"
          source="state"
          choices={choices(["PENDING_REVIEW", "RESOLVED", "DISMISSED"])}
          emptyText="All statuses"
        />,
        <TextInput key="reporterId" source="reporterId" />,
        <TextInput key="targetId" source="targetId" />,
        <TextInput key="age" source="age" label="Minimum age (hours)" />,
        <TextInput
          key="assigneeId"
          source="assigneeId"
          label="Assignee reference or UNASSIGNED"
        />,
      ]}
    >
      <Datagrid bulkActionButtons={false} rowClick="show">
        <TextField source="id" />
        <TextField source="reporterDisplayName" label="Reporter" />
        <TextField source="targetDisplayName" label="Reported user" />
        <TextField source="targetType" />
        <TextField source="category" />
        <TextField source="state" />
        <TextField source="assignedAdministratorId" label="Assignee" />
        <BooleanField source="evidenceAvailable" label="Evidence" />
        <DateField source="createdAt" showTime />
      </Datagrid>
    </List>
  );
}
