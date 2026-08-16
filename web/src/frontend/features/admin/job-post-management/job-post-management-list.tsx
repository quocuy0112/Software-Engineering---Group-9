"use client";
import {
  Datagrid,
  List,
  TextField,
  TextInput,
  SelectInput,
  BooleanField,
  DateField,
  Pagination,
} from "react-admin";

const choices = (values: string[]) => values.map((id) => ({ id, name: id }));
export function JobPostManagementList() {
  return (
    <List
      perPage={25}
      pagination={<Pagination rowsPerPageOptions={[25, 50, 100]} />}
      filters={[
        <TextInput
          key="q"
          source="q"
          label="Search title, company, recruiter"
          alwaysOn
        />,
        <SelectInput
          key="visibility"
          source="visibility"
          choices={choices(["PUBLISHED", "HIDDEN", "ARCHIVED"])}
        />,
        <SelectInput
          key="applicationState"
          source="applicationState"
          label="Applications"
          choices={choices(["OPEN", "CLOSED"])}
        />,
        <SelectInput
          key="featured"
          source="featured"
          label="Featured"
          choices={choices(["true"])}
        />,
        <SelectInput
          key="reportState"
          source="reportState"
          label="Reports"
          choices={choices(["REPORTED", "UNREPORTED"])}
        />,
        <TextInput
          key="minimumReports"
          source="minimumReports"
          label="Minimum reports"
        />,
      ]}
    >
      <Datagrid bulkActionButtons={false} rowClick="show">
        <TextField source="title" label="Job" />
        <TextField source="company" />
        <TextField source="recruiter" />
        <TextField source="visibility" />
        <TextField source="applicationState" label="Applications" />
        <BooleanField source="featured" />
        <TextField source="reportCount" label="Reports" />
        <DateField source="publishedAt" showTime />
      </Datagrid>
    </List>
  );
}
