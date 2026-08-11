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
const choices = (values: string[]) => values.map((id) => ({ id, name: id }));
export function ModerationReportList() {
  return (
    <List
      perPage={25}
      pagination={<Pagination rowsPerPageOptions={[25, 50, 100]} />}
      sort={{ field: "priority", order: "ASC" }}
      filters={[
        <SelectInput
          key="targetType"
          source="targetType"
          choices={choices(["JOB", "COMPANY", "MEMBERSHIP", "CANDIDATE"])}
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
          key="priority"
          source="priority"
          choices={choices(["CRITICAL", "HIGH", "NORMAL"])}
        />,
        <SelectInput
          key="state"
          source="state"
          choices={choices(["PENDING_REVIEW", "RESOLVED", "DISMISSED"])}
        />,
        <TextInput key="company" source="company" />,
        <TextInput key="age" source="age" label="Minimum age (hours)" />,
        <TextInput
          key="assigneeId"
          source="assigneeId"
          label="Assignee reference or UNASSIGNED"
        />,
      ]}
    >
      <CurrentListSnapshotDifference />
      <Datagrid bulkActionButtons={false} rowClick="show">
        <TextField source="id" />
        <TextField source="targetType" />
        <TextField source="targetReference" />
        <TextField source="category" />
        <TextField source="priority" />
        <TextField source="state" />
        <TextField source="assignedAdministratorId" />
        <DateField source="createdAt" showTime />
      </Datagrid>
    </List>
  );
}
