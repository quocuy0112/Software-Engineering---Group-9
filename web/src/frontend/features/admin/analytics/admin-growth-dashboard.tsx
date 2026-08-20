"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import type {
  AdminGrowthReport,
  AdminOverviewQuery,
} from "@/shared/contracts/analytics/admin";
import type {
  AnalyticsGrouping,
  MetricRate,
} from "@/shared/contracts/analytics";
import { adminDataProvider } from "../app/data-provider";
import {
  defaultAnalyticsDateRange,
  formatAnalyticsDate,
  type AnalyticsDateRange,
} from "@/frontend/features/recruitment-analytics/analytics-date-range";
import { AdminAnalyticsFilters } from "./analytics-filters";
import { AnalyticsTrend, type AnalyticsTrendPoint } from "./analytics-trend";

const numberFormatter = new Intl.NumberFormat("en-US");

function formatCount(value: number | null) {
  return value === null ? "—" : numberFormatter.format(value);
}

function formatPercent(value: number | null) {
  return value === null ? "—" : value.toFixed(2) + "%";
}

function ratioFromMetric(rate: MetricRate) {
  return rate.denominator === 0 ? null : rate.numerator / rate.denominator;
}

function formatRatio(value: number | null) {
  return value === null ? "—" : value.toFixed(2) + "×";
}

function bucketLabel(
  value: string,
  grouping: AnalyticsGrouping,
  timeZone: string,
) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: grouping === "MONTH" ? undefined : "numeric",
    year: grouping === "MONTH" ? "numeric" : undefined,
  }).format(new Date(value));
}

function metricCard(label: string, value: string, detail: string, key: string) {
  return (
    <Card key={key} variant="outlined">
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography
          component="p"
          variant="h4"
          fontWeight={700}
          sx={{ mt: 1, letterSpacing: "-0.03em" }}
        >
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {detail}
        </Typography>
      </CardContent>
    </Card>
  );
}

function pointsForReport(
  report: AdminGrowthReport,
  value: (bucket: AdminGrowthReport["buckets"][number]) => number | null,
  format: (value: number | null) => string,
): AnalyticsTrendPoint[] {
  return report.buckets.map((bucket) => {
    const pointValue = value(bucket);
    return {
      key: bucket.start,
      label: bucketLabel(
        bucket.start,
        report.grouping,
        report.metadata.timeZone,
      ),
      value: pointValue,
      displayValue: format(pointValue),
    };
  });
}

export function AdminGrowthDashboard() {
  const [range, setRange] = useState<AnalyticsDateRange>(() =>
    defaultAnalyticsDateRange(30),
  );
  const [grouping, setGrouping] = useState<AnalyticsGrouping>("DAY");
  const [report, setReport] = useState<AdminGrowthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  const loadReport = useCallback(
    async (nextRange: AnalyticsDateRange, nextGrouping: AnalyticsGrouping) => {
      const currentRequest = ++requestId.current;
      setLoading(true);
      setError("");
      const query: AdminOverviewQuery = {
        from: nextRange.from,
        to: nextRange.to,
        timeZone: nextRange.timeZone,
        grouping: nextGrouping,
      };
      try {
        const nextReport = await adminDataProvider.analyticsOverview(query);
        if (currentRequest === requestId.current) setReport(nextReport);
      } catch (caught) {
        if (currentRequest === requestId.current) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Admin analytics could not be loaded.",
          );
        }
      } finally {
        if (currentRequest === requestId.current) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadReport(range, grouping);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [grouping, loadReport, range]);

  const summary = useMemo(() => {
    if (!report || report.buckets.length === 0) return null;
    const last = report.buckets[report.buckets.length - 1]!;
    const registrations = report.buckets.reduce(
      (total, bucket) => total + bucket.newRegistrations,
      0,
    );
    const applications = report.buckets.reduce(
      (total, bucket) => total + bucket.submittedApplications,
      0,
    );
    const candidates = report.buckets.reduce(
      (total, bucket) => total + bucket.distinctSubmittingCandidates,
      0,
    );
    const hired = report.buckets.reduce(
      (total, bucket) => total + bucket.applicationSuccessRate.numerator,
      0,
    );
    return {
      registrations,
      applications,
      activePostings: last.activePostingsAtEnd,
      successRate: applications === 0 ? null : (hired / applications) * 100,
      applicationsPerCandidate:
        candidates === 0 ? null : applications / candidates,
    };
  }, [report]);

  const trends = useMemo(() => {
    if (!report) return [];
    return [
      {
        title: "New user registrations",
        description: "Accounts registered in each reporting bucket.",
        points: pointsForReport(
          report,
          (bucket) => bucket.newRegistrations,
          formatCount,
        ),
        format: formatCount,
      },
      {
        title: "Active job postings",
        description: "Active postings at the end of each reporting bucket.",
        points: pointsForReport(
          report,
          (bucket) => bucket.activePostingsAtEnd,
          formatCount,
        ),
        format: formatCount,
      },
      {
        title: "Application success rate",
        description: "Hired applications divided by submitted applications.",
        points: pointsForReport(
          report,
          (bucket) => bucket.applicationSuccessRate.value,
          formatPercent,
        ),
        format: formatPercent,
      },
      {
        title: "Applications per candidate",
        description:
          "Submitted applications divided by distinct candidates per bucket.",
        points: pointsForReport(
          report,
          (bucket) => ratioFromMetric(bucket.applicationsPerCandidate),
          formatRatio,
        ),
        format: formatRatio,
      },
    ];
  }, [report]);

  return (
    <Box
      component="section"
      aria-labelledby="admin-growth-title"
      sx={{ mt: 4 }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={1}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography id="admin-growth-title" component="h2" variant="h5">
            Recruitment analytics
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Monitor platform growth and application outcomes over time.
          </Typography>
        </Box>
      </Stack>
      <AdminAnalyticsFilters
        key={range.fromDate + ":" + range.toDate}
        range={range}
        grouping={grouping}
        onApply={setRange}
        onGroupingChange={setGrouping}
        busy={loading}
      />
      {loading && !report ? (
        <Box
          role="status"
          aria-label="Loading recruitment analytics"
          sx={{ display: "grid", placeItems: "center", minHeight: 220 }}
        >
          <CircularProgress />
        </Box>
      ) : null}
      {error ? (
        <Alert
          severity="error"
          sx={{ mt: 2 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => void loadReport(range, grouping)}
            >
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      ) : null}
      {report && report.buckets.length === 0 ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          No platform activity is available for the selected reporting window.
        </Alert>
      ) : null}
      {summary ? (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Data through{" "}
            {formatAnalyticsDate(report!.metadata.dataCutoff.slice(0, 10))}.
            {" Analytics are available from "}
            {formatAnalyticsDate(
              report!.metadata.analyticsAvailableFrom.slice(0, 10),
            )}
            {new Date(report!.metadata.from).getTime() >
            new Date(range.from).getTime()
              ? ". The selected window begins before collection started; data is shown from the baseline."
              : "."}
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: 2,
              mt: 2,
            }}
          >
            {metricCard(
              "New registrations",
              formatCount(summary.registrations),
              "Selected reporting window",
              "registrations",
            )}
            {metricCard(
              "Active job postings",
              formatCount(summary.activePostings),
              "Latest bucket",
              "active-postings",
            )}
            {metricCard(
              "Application success rate",
              formatPercent(summary.successRate),
              "Hired ÷ submitted applications",
              "success-rate",
            )}
            {metricCard(
              "Applications per candidate",
              formatRatio(summary.applicationsPerCandidate),
              "Selected-window bucket totals",
              "applications-per-candidate",
            )}
          </Box>
        </>
      ) : null}
      {report && report.buckets.length > 0 ? (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
            gap: 2,
            mt: 3,
          }}
        >
          {trends.map((trend) => (
            <AnalyticsTrend
              key={trend.title}
              title={trend.title}
              description={trend.description}
              points={trend.points}
              formatValue={trend.format}
            />
          ))}
        </Box>
      ) : null}
    </Box>
  );
}
