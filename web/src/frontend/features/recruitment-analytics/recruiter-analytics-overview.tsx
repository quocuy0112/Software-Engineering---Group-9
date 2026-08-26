"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  BriefcaseBusiness,
  Eye,
  FileText,
  Percent,
  Plus,
  RefreshCw,
  UserRoundX,
  UsersRound,
} from "lucide-react";
import type { JobPerformanceReport } from "@/shared/contracts/analytics/employer";
import type { RecruiterJob } from "@/shared/contracts/recruiter-job-posting";
import { recruiterRoutes } from "@/shared/routing/recruiter-routes";
import { AnalyticsDateRangeControls } from "./analytics-filters";
import {
  defaultAnalyticsDateRange,
  type AnalyticsDateRange,
} from "./analytics-date-range";
import { AnalyticsApiError, fetchJobPerformance } from "./analytics-api";
import { CandidateExportPanel } from "./candidate-export-panel";
import { JobPerformanceReport as JobPerformanceReportPanel } from "./job-performance-report";

type PerformanceState =
  | { status: "loading" }
  | { status: "success"; report: JobPerformanceReport }
  | { status: "error"; message: string };

type SortKey = "title" | "views" | "applications" | "conversion";

function formatNumber(value: number) {
  return value.toLocaleString("en-US");
}

function formatRate(value: number | null) {
  return value === null ? "N/A" : value.toFixed(2) + "%";
}

function conversionDescription(value: number | null) {
  return value === null
    ? "No qualified views in the selected window"
    : "Applications divided by qualified views";
}

function formatAnalyticsInstant(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function MetricCard({
  label,
  value,
  description,
  icon,
  tone,
  loading = false,
}: {
  label: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  tone: "blue" | "teal" | "violet" | "amber";
  loading?: boolean;
}) {
  return (
    <article className="recruiter-analytics-overview-metric" data-tone={tone}>
      <span
        className="recruiter-analytics-overview-metric__icon"
        aria-hidden="true"
      >
        {icon}
      </span>
      <div>
        <p>{label}</p>
        <strong className={loading ? "is-loading" : undefined}>
          {loading ? "…" : value}
        </strong>
        <small>{description}</small>
      </div>
    </article>
  );
}

function reportValue(
  state: PerformanceState | undefined,
  key: "views" | "applications" | "conversion",
) {
  if (!state || state.status !== "success") return null;
  if (key === "views") return state.report.qualifiedViews;
  if (key === "applications") return state.report.submittedApplications;
  return state.report.conversionRate.value;
}

export function RecruiterAnalyticsOverview({
  jobs,
  initialJobId,
}: {
  jobs: RecruiterJob[];
  initialJobId?: string;
}) {
  const [range, setRange] = useState<AnalyticsDateRange>(() =>
    defaultAnalyticsDateRange(),
  );
  const [performance, setPerformance] = useState<
    Record<string, PerformanceState>
  >({});
  const [selectedJobId, setSelectedJobId] = useState(initialJobId ?? "");
  const [sortKey, setSortKey] = useState<SortKey>("applications");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const performanceRef = useRef<Record<string, PerformanceState>>({});
  const backgroundRefreshRef = useRef(false);

  const reportableJobs = useMemo(
    () =>
      jobs.filter((job) => job.status === "active" || job.status === "closed"),
    [jobs],
  );

  function requestRefresh(background = false) {
    backgroundRefreshRef.current = background;
    setRefreshVersion((version) => version + 1);
  }

  function applyRange(nextRange: AnalyticsDateRange) {
    backgroundRefreshRef.current = false;
    setRange(nextRange);
  }

  useEffect(() => {
    const controller = new AbortController();
    const ids = reportableJobs.map((job) => job.id);
    if (ids.length === 0) {
      return () => controller.abort();
    }

    const isBackgroundRefresh =
      backgroundRefreshRef.current &&
      ids.some((id) => performanceRef.current[id]?.status === "success");
    backgroundRefreshRef.current = false;
    setIsRefreshing(isBackgroundRefresh);

    const timeoutId = window.setTimeout(() => {
      if (!isBackgroundRefresh) {
        const loadingPerformance: Record<string, PerformanceState> =
          Object.fromEntries(
            ids.map((id): [string, PerformanceState] => [
              id,
              { status: "loading" },
            ]),
          );
        performanceRef.current = loadingPerformance;
        setPerformance(loadingPerformance);
      }
      void Promise.all(
        reportableJobs.map(async (job) => {
          try {
            const report = await fetchJobPerformance(
              job.id,
              range,
              controller.signal,
            );
            return [job.id, { status: "success", report }] as [
              string,
              PerformanceState,
            ];
          } catch (error) {
            if (controller.signal.aborted) return null;
            return [
              job.id,
              {
                status: "error",
                message:
                  error instanceof AnalyticsApiError
                    ? error.message
                    : "This posting's analytics are unavailable.",
              },
            ] as [string, PerformanceState];
          }
        }),
      ).then((entries) => {
        if (controller.signal.aborted) return;
        const nextPerformance = Object.fromEntries(
          entries.filter(
            (entry): entry is [string, PerformanceState] => entry !== null,
          ),
        );
        performanceRef.current = nextPerformance;
        setPerformance(nextPerformance);
        setLastUpdatedAt(new Date().toISOString());
        setIsRefreshing(false);
      });
    }, 0);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [range, refreshVersion, reportableJobs]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState !== "visible") return;
      backgroundRefreshRef.current = true;
      setRefreshVersion((version) => version + 1);
    };
    const intervalId = window.setInterval(refreshWhenVisible, 15_000);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  const successfulReports = useMemo(
    () =>
      reportableJobs
        .map((job) => performance[job.id])
        .filter(
          (
            state,
          ): state is { status: "success"; report: JobPerformanceReport } =>
            state?.status === "success",
        )
        .map((state) => state.report),
    [performance, reportableJobs],
  );
  const loadingReports = reportableJobs.some(
    (job) => performance[job.id]?.status === "loading",
  );
  const failedReports = reportableJobs.filter(
    (job) => performance[job.id]?.status === "error",
  );
  const firstFailureMessage = failedReports
    .map((job) => performance[job.id])
    .find(
      (state): state is { status: "error"; message: string } =>
        state?.status === "error",
    )?.message;
  const adjustedReports = successfulReports.filter(
    (report) =>
      new Date(report.metadata.from).getTime() > new Date(range.from).getTime(),
  );
  const totalViews = successfulReports.reduce(
    (sum, report) => sum + report.qualifiedViews,
    0,
  );
  const totalApplications = successfulReports.reduce(
    (sum, report) => sum + report.submittedApplications,
    0,
  );
  const totalWithdrawnApplications = successfulReports.reduce(
    (sum, report) => sum + report.withdrawnApplications,
    0,
  );
  const overallConversion =
    totalViews === 0
      ? null
      : Math.round((totalApplications / totalViews) * 10000) / 100;

  const sortedJobs = useMemo(() => {
    const copy = [...reportableJobs];
    copy.sort((left, right) => {
      if (sortKey === "title") {
        const comparison = (left.title || "Untitled job posting").localeCompare(
          right.title || "Untitled job posting",
        );
        return sortDirection === "asc" ? comparison : -comparison;
      }

      const leftValue = reportValue(performance[left.id], sortKey);
      const rightValue = reportValue(performance[right.id], sortKey);
      if (leftValue === null && rightValue !== null) return 1;
      if (leftValue !== null && rightValue === null) return -1;
      const comparison = (leftValue ?? 0) - (rightValue ?? 0);
      return sortDirection === "asc" ? comparison : -comparison;
    });
    return copy;
  }, [performance, reportableJobs, sortDirection, sortKey]);

  const selectedJob =
    reportableJobs.find((job) => job.id === selectedJobId) ?? reportableJobs[0];
  const activeSelectedJobId = selectedJob?.id ?? "";
  const selectedState = activeSelectedJobId
    ? performance[activeSelectedJobId]
    : undefined;
  const selectedReport =
    selectedState?.status === "success" ? selectedState.report : null;
  const backgroundRefreshActive = isRefreshing && reportableJobs.length > 0;

  function sortBy(nextKey: SortKey) {
    if (nextKey === sortKey) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === "title" ? "asc" : "desc");
  }

  function sortLabel(key: SortKey) {
    return sortKey === key
      ? sortDirection === "asc"
        ? "ascending"
        : "descending"
      : "none";
  }

  return (
    <main
      className="recruiter-analytics-overview"
      aria-labelledby="recruiter-analytics-title"
    >
      <header className="recruiter-analytics-overview__header">
        <div>
          <p className="recruiter-analytics-eyebrow">Recruiter workspace</p>
          <h1 id="recruiter-analytics-title">Hiring overview</h1>
          <p>
            See which postings attract attention, where candidates progress, and
            what deserves your next review.
          </p>
        </div>
        <Link
          href={recruiterRoutes.jobPostings}
          className="recruiter-analytics-secondary-link"
        >
          <BriefcaseBusiness aria-hidden="true" />
          Manage job postings
        </Link>
      </header>

      <AnalyticsDateRangeControls
        key={range.fromDate + ":" + range.toDate}
        range={range}
        onApply={applyRange}
        busy={loadingReports}
      />

      <div className="recruiter-analytics-overview__context" role="note">
        <span
          className="recruiter-analytics-overview__context-dot"
          aria-hidden="true"
        />
        <span>
          Metrics use qualified views and submitted applications in the selected
          window. The end date includes the full local calendar day in{" "}
          {range.timeZone}. Withdrawn applications are shown separately and
          excluded from the current funnel snapshot.
        </span>
        {adjustedReports.length > 0 ? (
          <span>
            The selected window begins before analytics collection started; data
            is shown from{" "}
            {formatAnalyticsInstant(adjustedReports[0]!.metadata.from)}.
          </span>
        ) : null}
        <span className="recruiter-analytics-overview__context-badge">
          {successfulReports.length}/{reportableJobs.length} reports ready
        </span>
        <span
          className="recruiter-analytics-overview__context-updated"
          role="status"
          aria-live="polite"
        >
          {loadingReports
            ? "Loading analytics..."
            : backgroundRefreshActive
              ? "Updating analytics..."
              : lastUpdatedAt
                ? "Updated " + formatAnalyticsInstant(lastUpdatedAt)
                : "Auto-refreshes every 15 seconds"}
        </span>
      </div>

      <section
        className="recruiter-analytics-overview__metrics"
        aria-labelledby="recruiter-overview-metrics-title"
      >
        <div className="sr-only">
          <h2 id="recruiter-overview-metrics-title">Overview metrics</h2>
        </div>
        <MetricCard
          label="Active job postings"
          value={formatNumber(
            jobs.filter((job) => job.status === "active").length,
          )}
          description="Currently visible to candidates"
          tone="blue"
          icon={<BriefcaseBusiness />}
        />
        <MetricCard
          label="Qualified views"
          value={formatNumber(totalViews)}
          description="Across active and closed postings"
          tone="teal"
          icon={<Eye />}
          loading={loadingReports}
        />
        <MetricCard
          label="Applications"
          value={formatNumber(totalApplications)}
          description="Submitted in the selected window"
          tone="violet"
          icon={<UsersRound />}
          loading={loadingReports}
        />
        <MetricCard
          label="Withdrawn applications"
          value={formatNumber(totalWithdrawnApplications)}
          description="Excluded from the current funnel snapshot"
          tone="amber"
          icon={<UserRoundX />}
          loading={loadingReports}
        />
        <MetricCard
          label="Overall conversion"
          value={formatRate(overallConversion)}
          description={conversionDescription(overallConversion)}
          tone="amber"
          icon={<Percent />}
          loading={loadingReports}
        />
      </section>

      {failedReports.length > 0 ? (
        <div className="recruiter-analytics-inline-alert" role="status">
          <AlertCircle aria-hidden="true" />
          <span>
            Analytics are unavailable for {failedReports.length} posting
            {failedReports.length === 1 ? "" : "s"}. Available rows are still
            shown below. {firstFailureMessage ?? ""}
          </span>
          <button type="button" onClick={() => requestRefresh()}>
            Retry
          </button>
        </div>
      ) : null}

      <section
        className="recruiter-analytics-panel recruiter-analytics-performance"
        aria-labelledby="posting-performance-title"
      >
        <header className="recruiter-analytics-panel__heading">
          <div>
            <p className="recruiter-analytics-eyebrow">Posting performance</p>
            <h2 id="posting-performance-title">Job postings</h2>
            <p>
              Sort by acquisition volume or conversion, then select a posting to
              inspect its funnel.
            </p>
          </div>
          <button
            type="button"
            className="recruiter-analytics-refresh"
            onClick={() => requestRefresh()}
            disabled={loadingReports || backgroundRefreshActive}
          >
            <RefreshCw
              aria-hidden="true"
              className={
                loadingReports || backgroundRefreshActive
                  ? "is-spinning"
                  : undefined
              }
            />
            Refresh
          </button>
        </header>
        {reportableJobs.length === 0 ? (
          <div className="recruiter-analytics-empty">
            <FileText aria-hidden="true" />
            <h3>No active job postings to analyze</h3>
            <p>
              Publish a job posting to start collecting qualified views and
              applications.
            </p>
            <Link
              href={recruiterRoutes.jobPostingCreate}
              className="recruiter-analytics-primary-link"
            >
              <Plus aria-hidden="true" />
              Create a job posting
            </Link>
          </div>
        ) : (
          <div className="recruiter-analytics-table-wrap">
            <table className="recruiter-analytics-performance-table">
              <caption className="sr-only">
                Job posting views, applications, withdrawn applications,
                conversion, and export actions
              </caption>
              <thead>
                <tr>
                  {[
                    ["title", "Job posting"],
                    ["views", "Views"],
                    ["applications", "Applications"],
                    ["conversion", "Conversion"],
                  ].map(([key, label]) => (
                    <th
                      key={key}
                      scope="col"
                      aria-sort={sortLabel(key as SortKey)}
                    >
                      <button
                        type="button"
                        onClick={() => sortBy(key as SortKey)}
                        aria-label={"Sort by " + label}
                      >
                        {label}
                        <span aria-hidden="true">↕</span>
                      </button>
                    </th>
                  ))}
                  <th scope="col">Withdrawn</th>
                  <th scope="col">Export candidates</th>
                </tr>
              </thead>
              <tbody>
                {sortedJobs.map((job) => {
                  const state = performance[job.id];
                  const report =
                    state?.status === "success" ? state.report : null;
                  const title = job.title || "Untitled job posting";
                  return (
                    <tr
                      key={job.id}
                      className={
                        selectedJob?.id === job.id ? "is-selected" : undefined
                      }
                    >
                      <th scope="row">
                        <button
                          type="button"
                          className="recruiter-analytics-job-select"
                          onClick={() => setSelectedJobId(job.id)}
                        >
                          <strong>{title}</strong>
                          <span>
                            {job.status === "active" ? "Active" : "Closed"}
                          </span>
                        </button>
                      </th>
                      <td>
                        {state?.status === "loading"
                          ? "…"
                          : report
                            ? formatNumber(report.qualifiedViews)
                            : "—"}
                      </td>
                      <td>
                        {state?.status === "loading"
                          ? "…"
                          : report
                            ? formatNumber(report.submittedApplications)
                            : "—"}
                      </td>
                      <td>
                        {state?.status === "loading"
                          ? "…"
                          : report
                            ? formatRate(report.conversionRate.value)
                            : "—"}
                      </td>
                      <td>
                        {state?.status === "loading"
                          ? "\u2026"
                          : report
                            ? formatNumber(report.withdrawnApplications)
                            : "\u2014"}
                      </td>
                      <td>
                        <CandidateExportPanel jobId={job.id} jobTitle={title} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedJob && selectedState?.status === "loading" ? (
        <section className="recruiter-analytics-loading-panel" role="status">
          <RefreshCw className="is-spinning" aria-hidden="true" />
          <div>
            <strong>Loading {selectedJob.title || "posting"} analytics…</strong>
            <p>Fetching the selected reporting window.</p>
          </div>
        </section>
      ) : null}
      {selectedJob && selectedState?.status === "error" ? (
        <section className="recruiter-analytics-inline-alert" role="alert">
          <AlertCircle aria-hidden="true" />
          <span>{selectedState.message}</span>
        </section>
      ) : null}
      {selectedReport ? (
        <JobPerformanceReportPanel
          report={selectedReport}
          jobs={reportableJobs}
          selectedJobId={activeSelectedJobId}
          onSelectJob={setSelectedJobId}
        />
      ) : null}
    </main>
  );
}
