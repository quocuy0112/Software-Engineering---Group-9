"use client";

import { useState } from "react";
import {
  addCalendarDays,
  createAnalyticsDateRange,
  formatAnalyticsRange,
  isValidAnalyticsDateRange,
  type AnalyticsDateRange,
} from "@/frontend/features/recruitment-analytics/analytics-date-range";
import type { AnalyticsGrouping } from "@/shared/contracts/analytics";
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

export function AdminAnalyticsFilters({
  range,
  grouping,
  onApply,
  onGroupingChange,
  busy = false,
}: {
  range: AnalyticsDateRange;
  grouping: AnalyticsGrouping;
  onApply: (next: AnalyticsDateRange) => void;
  onGroupingChange: (next: AnalyticsGrouping) => void;
  busy?: boolean;
}) {
  const [fromDate, setFromDate] = useState(range.fromDate);
  const [toDate, setToDate] = useState(range.toDate);
  const [error, setError] = useState("");

  function apply(nextFrom = fromDate, nextTo = toDate) {
    if (!isValidAnalyticsDateRange(nextFrom, nextTo)) {
      setError("Choose a start date on or before the end date.");
      return;
    }
    setError("");
    onApply(createAnalyticsDateRange(nextFrom, nextTo));
  }

  function applyPreset(days: number) {
    const nextTo = range.toDate;
    const nextFrom = addCalendarDays(nextTo, -(days - 1));
    setFromDate(nextFrom);
    setToDate(nextTo);
    apply(nextFrom, nextTo);
  }

  return (
    <Box
      component="form"
      aria-label="Admin analytics date filters"
      onSubmit={(event) => {
        event.preventDefault();
        apply();
      }}
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        p: { xs: 2, md: 2.5 },
        bgcolor: "background.paper",
      }}
    >
      <Stack
        direction={{ xs: "column", lg: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", lg: "flex-end" }}
      >
        <Box sx={{ flex: 1, minWidth: 220 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            Reporting window
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {formatAnalyticsRange(range)} · {range.timeZone} · end date includes
            the full local day
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {[7, 30, 90].map((days) => (
            <Button
              key={days}
              type="button"
              size="small"
              variant={
                range.fromDate === addCalendarDays(range.toDate, -(days - 1))
                  ? "contained"
                  : "outlined"
              }
              onClick={() => applyPreset(days)}
              disabled={busy}
            >
              {days} days
            </Button>
          ))}
        </Stack>
        <TextField
          label="From"
          type="date"
          value={fromDate}
          onChange={(event) => setFromDate(event.target.value)}
          disabled={busy}
          size="small"
          slotProps={{ inputLabel: { shrink: true } }}
          inputProps={{ "aria-label": "Admin analytics start date" }}
        />
        <TextField
          label="To (inclusive)"
          type="date"
          value={toDate}
          onChange={(event) => setToDate(event.target.value)}
          disabled={busy}
          size="small"
          slotProps={{ inputLabel: { shrink: true } }}
          inputProps={{ "aria-label": "Admin analytics end date inclusive" }}
        />
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel id="admin-analytics-grouping-label">Group by</InputLabel>
          <Select
            labelId="admin-analytics-grouping-label"
            label="Group by"
            value={grouping}
            onChange={(event) =>
              onGroupingChange(event.target.value as AnalyticsGrouping)
            }
            disabled={busy}
          >
            <MenuItem value="DAY">Day</MenuItem>
            <MenuItem value="WEEK">Week</MenuItem>
            <MenuItem value="MONTH">Month</MenuItem>
          </Select>
        </FormControl>
        <Button
          type="submit"
          variant="contained"
          disabled={busy}
          sx={{ minWidth: 96, minHeight: 40 }}
        >
          {busy ? "Updating…" : "Apply"}
        </Button>
      </Stack>
      {error ? (
        <Typography color="error" role="alert" variant="body2" sx={{ mt: 1.5 }}>
          {error}
        </Typography>
      ) : null}
    </Box>
  );
}
