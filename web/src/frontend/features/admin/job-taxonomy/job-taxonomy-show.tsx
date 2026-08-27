"use client";

import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import { Show, useRecordContext } from "react-admin";
import {
  JobTaxonomyActionPanel,
  type JobTaxonomyRecord,
} from "./job-taxonomy-action-panel";

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ overflowWrap: "anywhere" }}>{value}</Typography>
    </Box>
  );
}

function Content() {
  const record = useRecordContext<JobTaxonomyRecord>();
  if (!record) return null;
  return (
    <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 1200, mx: "auto" }}>
      <Stack spacing={2.5}>
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            gap={1.5}
          >
            <Box>
              <Typography
                variant="overline"
                color="primary.main"
                fontWeight={700}
              >
                Shared job taxonomy
              </Typography>
              <Typography component="h1" variant="h4" fontWeight={750}>
                {record.name}
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                {record.industry.name} · {record.code}
              </Typography>
            </Box>
            <Chip
              label={
                record.status === "ACTIVE"
                  ? "Active"
                  : record.status === "INACTIVE"
                    ? "Inactive"
                    : "Removed"
              }
              color={
                record.status === "ACTIVE"
                  ? "success"
                  : record.status === "INACTIVE"
                    ? "warning"
                    : "error"
              }
            />
          </Stack>
          <Box
            sx={{
              mt: 3,
              display: "grid",
              gridTemplateColumns: {
                xs: "repeat(2, 1fr)",
                md: "repeat(4, 1fr)",
              },
              gap: 2,
            }}
          >
            <Detail label="Industry code" value={record.industry.code} />
            <Detail label="Jobs using it" value={record.jobCount} />
            <Detail label="Approved proposals" value={record.proposalCount} />
            <Detail label="Taxonomy version" value={record.version} />
            <Detail label="Created" value={dateTime(record.createdAt)} />
            <Detail label="Last changed" value={dateTime(record.updatedAt)} />
            <Detail label="Sub-industry reference" value={record.id} />
          </Box>
        </Paper>
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
          <JobTaxonomyActionPanel />
        </Paper>
      </Stack>
    </Box>
  );
}

export function JobTaxonomyShow() {
  return (
    <Show title="Shared sub-industry" component="div">
      <Content />
    </Show>
  );
}
