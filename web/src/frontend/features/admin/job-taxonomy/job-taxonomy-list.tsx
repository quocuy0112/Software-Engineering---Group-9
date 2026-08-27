"use client";

import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import {
  Datagrid,
  DateField,
  FunctionField,
  List,
  Pagination,
  SelectInput,
  TextField,
  TextInput,
  useListContext,
  useRecordContext,
} from "react-admin";
import { recruiterIndustryTaxonomy } from "@/shared/contracts/jobs/industry-taxonomy";
import {
  JobTaxonomyActionPanel,
  type JobTaxonomyRecord,
} from "./job-taxonomy-action-panel";

const industryChoices = recruiterIndustryTaxonomy.map((industry) => ({
  id: industry.code,
  name: industry.label,
}));

const industryLabels = new Map(
  industryChoices.map((industry) => [industry.id, industry.name]),
);

const filters = [
  <TextInput
    key="q"
    source="q"
    label="Search name, code, or industry"
    alwaysOn
  />,
  <SelectInput
    key="industryCode"
    source="industryCode"
    label="Industry"
    choices={industryChoices}
    emptyText="All industries"
  />,
  <SelectInput
    key="status"
    source="status"
    label="Status"
    choices={[
      { id: "ACTIVE", name: "Active" },
      { id: "INACTIVE", name: "Inactive" },
      { id: "REMOVED", name: "Removed" },
    ]}
    emptyText="All statuses"
  />,
];

function IndustryBrowser() {
  const { filterValues, setFilters } = useListContext();
  const selectedCode =
    typeof filterValues.industryCode === "string"
      ? filterValues.industryCode
      : "";

  function chooseIndustry(code?: string) {
    const nextFilters = { ...filterValues };
    delete nextFilters.q;
    if (code) nextFilters.industryCode = code;
    else delete nextFilters.industryCode;
    setFilters(nextFilters);
  }

  return (
    <Box
      component="section"
      aria-labelledby="job-taxonomy-industry-browser-heading"
      sx={{
        mb: 2,
        p: { xs: 1.5, md: 2 },
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        bgcolor: "background.paper",
      }}
    >
      <Typography
        id="job-taxonomy-industry-browser-heading"
        component="h2"
        variant="subtitle1"
        fontWeight={700}
      >
        Browse sub-industries by industry
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {selectedCode
          ? `Showing sub-industries under ${industryLabels.get(selectedCode) ?? selectedCode}.`
          : "Select an industry to see and manage its corresponding sub-industries."}
      </Typography>
      <Stack
        direction="row"
        spacing={0.75}
        useFlexGap
        flexWrap="wrap"
        sx={{ mt: 1.5 }}
      >
        <Button
          size="small"
          variant={selectedCode ? "outlined" : "contained"}
          aria-pressed={!selectedCode}
          onClick={() => chooseIndustry()}
        >
          All industries
        </Button>
        {industryChoices.map((industry) => {
          const selected = selectedCode === industry.id;
          return (
            <Button
              key={industry.id}
              size="small"
              variant={selected ? "contained" : "outlined"}
              aria-pressed={selected}
              onClick={() => chooseIndustry(industry.id)}
              sx={{ textTransform: "none", textAlign: "left" }}
            >
              {industry.name}
            </Button>
          );
        })}
      </Stack>
    </Box>
  );
}

function StatusField() {
  const record = useRecordContext<JobTaxonomyRecord>();
  if (!record) return null;
  const color =
    record.status === "ACTIVE"
      ? "success"
      : record.status === "INACTIVE"
        ? "warning"
        : "error";
  return (
    <Chip
      label={record.status[0] + record.status.slice(1).toLowerCase()}
      color={color}
      size="small"
    />
  );
}

function RowActions() {
  return <JobTaxonomyActionPanel compact />;
}

export function JobTaxonomyList() {
  return (
    <List
      title="Shared sub-industries"
      perPage={25}
      pagination={<Pagination rowsPerPageOptions={[25, 50, 100]} />}
      sort={{ field: "updatedAt", order: "DESC" }}
      filters={filters}
    >
      <IndustryBrowser />
      <Datagrid
        bulkActionButtons={false}
        rowClick="show"
        rowSx={(record: JobTaxonomyRecord) =>
          record.status === "REMOVED"
            ? { opacity: 0.55, backgroundColor: "error.50" }
            : record.status === "INACTIVE"
              ? { opacity: 0.7, backgroundColor: "action.hover" }
              : {}
        }
      >
        <FunctionField
          label="Industry"
          render={(record) => record.industry?.name ?? "Unknown industry"}
        />
        <TextField source="name" label="Sub-industry" />
        <TextField source="code" label="Shared code" />
        <FunctionField label="Status" render={() => <StatusField />} />
        <TextField source="jobCount" label="Jobs using it" />
        <TextField source="proposalCount" label="Approved proposals" />
        <DateField source="updatedAt" label="Last changed" showTime />
        <FunctionField label="Actions" render={() => <RowActions />} />
      </Datagrid>
    </List>
  );
}
