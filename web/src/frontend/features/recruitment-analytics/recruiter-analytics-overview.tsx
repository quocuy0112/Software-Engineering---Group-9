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
import type { RecruiterCompanyView } from "@/shared/contracts/recruiter-job-posting";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { RecruiterCompanyFilter } from "@/frontend/features/recruiter-workspace/recruiter-company-filter";
import {
  companyMatchesScope,
  useRecruiterCompanyScope,
} from "@/frontend/features/recruiter-workspace/recruiter-company-scope";
import { AnalyticsDateRangeControls } from "./analytics-filters";
import {
  defaultAnalyticsDateRange,
  type AnalyticsDateRange,
} from "./analytics-date-range";
import { fetchJobPerformance } from "./analytics-api";
import { CandidateExportPanel } from "./candidate-export-panel";
import { JobPerformanceReport as JobPerformanceReportPanel } from "./job-performance-report";
import { recruitmentAnalyticsCopy } from "./recruitment-analytics-copy";

type PerformanceState =
  | { status: "loading" }
  | { status: "success"; report: JobPerformanceReport }
  | { status: "error"; message: string };

type SortKey = "title" | "views" | "applications" | "conversion";

const emptyCompanies: RecruiterCompanyView[] = [];

function formatNumber(value: number, locale: string) {
  return value.toLocaleString(locale);
}

function formatRate(value: number | null, notAvailable: string) {
  return value === null ? notAvailable : value.toFixed(2) + "%";
}

function conversionDescription(
  value: number | null,
  copy: ReturnType<typeof recruitmentAnalyticsCopy>["overview"],
) {
  return value === null
    ? copy.metrics.conversionUnavailable
    : copy.metrics.conversionFormula;
}

function formatAnalyticsInstant(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
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
  companies,
  initialJobId,
}: {
  jobs: RecruiterJob[];
  companies?: RecruiterCompanyView[];
  initialJobId?: string;
}) {
  const companyOptions = companies ?? emptyCompanies;
  const locale = useWorkspaceLocale();
  const analyticsCopy = recruitmentAnalyticsCopy(locale);
  const copy = analyticsCopy.overview;
  const { companyId, selectedCompanyId, setCompanyId } =
    useRecruiterCompanyScope(companyOptions);
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
      jobs.filter(
        (job) =>
          (job.status === "active" || job.status === "closed") &&
          companyMatchesScope(job.companyId, selectedCompanyId),
      ),
    [jobs, selectedCompanyId],
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
          } catch {
            if (controller.signal.aborted) return null;
            return [
              job.id,
              {
                status: "error",
                message: copy.jobUnavailable,
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
  }, [copy.jobUnavailable, locale, range, refreshVersion, reportableJobs]);

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
        const comparison = (
          left.title || analyticsCopy.untitledJob
        ).localeCompare(right.title || analyticsCopy.untitledJob);
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
  }, [
    analyticsCopy.untitledJob,
    performance,
    reportableJobs,
    sortDirection,
    sortKey,
  ]);

  const selectedJob =
    reportableJobs.find((job) => job.id === selectedJobId) ?? reportableJobs[0];
  const activeSelectedJobId = selectedJob?.id ?? "";
  const selectedState = activeSelectedJobId
    ? performance[activeSelectedJobId]
    : undefined;
  const selectedReport =
    selectedState?.status === "success" ? selectedState.report : null;
  const backgroundRefreshActive = isRefreshing && reportableJobs.length > 0;
  const filtersClassName = [
    "recruiter-analytics-overview__filters",
    companyOptions.length > 1
      ? "recruiter-analytics-overview__filters--with-company"
      : null,
  ]
    .filter(Boolean)
    .join(" ");

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
          <p className="recruiter-analytics-eyebrow">{copy.eyebrow}</p>
          <h1 id="recruiter-analytics-title">{copy.title}</h1>
          <p>{copy.intro}</p>
        </div>
        <Link
          href={recruiterRoutes.jobPostings}
          className="recruiter-analytics-secondary-link"
        >
          <BriefcaseBusiness aria-hidden="true" />
          {copy.manageJobs}
        </Link>
      </header>

      <div className={filtersClassName}>
        <RecruiterCompanyFilter
          companies={companyOptions}
          value={companyId}
          onChange={setCompanyId}
          id="recruiter-overview-company"
        />
        <AnalyticsDateRangeControls
          key={range.fromDate + ":" + range.toDate}
          range={range}
          onApply={applyRange}
          busy={loadingReports}
        />
      </div>

      <div className="recruiter-analytics-overview__context" role="note">
        <span
          className="recruiter-analytics-overview__context-dot"
          aria-hidden="true"
        />
        <span>{copy.contextMetrics(range.timeZone)}</span>
        {adjustedReports.length > 0 ? (
          <span>
            {copy.contextCollectionStarted(
              formatAnalyticsInstant(
                adjustedReports[0]!.metadata.from,
                analyticsCopy.locale,
              ),
            )}
          </span>
        ) : null}
        <span className="recruiter-analytics-overview__context-badge">
          {copy.reportsReady(successfulReports.length, reportableJobs.length)}
        </span>
        <span
          className="recruiter-analytics-overview__context-updated"
          role="status"
          aria-live="polite"
        >
          {loadingReports
            ? copy.loading
            : backgroundRefreshActive
              ? copy.updating
              : lastUpdatedAt
                ? copy.updated(
                    formatAnalyticsInstant(lastUpdatedAt, analyticsCopy.locale),
                  )
                : copy.autoRefresh}
        </span>
      </div>

      <section
        className="recruiter-analytics-overview__metrics"
        aria-labelledby="recruiter-overview-metrics-title"
      >
        <div className="sr-only">
          <h2 id="recruiter-overview-metrics-title">{copy.metricsTitle}</h2>
        </div>
        <MetricCard
          label={copy.metrics.activeJobs}
          value={formatNumber(
            reportableJobs.filter((job) => job.status === "active").length,
            analyticsCopy.locale,
          )}
          description={copy.metrics.activeJobsDescription}
          tone="blue"
          icon={<BriefcaseBusiness />}
        />
        <MetricCard
          label={copy.metrics.qualifiedViews}
          value={formatNumber(totalViews, analyticsCopy.locale)}
          description={copy.metrics.qualifiedViewsDescription}
          tone="teal"
          icon={<Eye />}
          loading={loadingReports}
        />
        <MetricCard
          label={copy.metrics.applications}
          value={formatNumber(totalApplications, analyticsCopy.locale)}
          description={copy.metrics.applicationsDescription}
          tone="violet"
          icon={<UsersRound />}
          loading={loadingReports}
        />
        <MetricCard
          label={copy.metrics.withdrawn}
          value={formatNumber(totalWithdrawnApplications, analyticsCopy.locale)}
          description={copy.metrics.withdrawnDescription}
          tone="amber"
          icon={<UserRoundX />}
          loading={loadingReports}
        />
        <MetricCard
          label={copy.metrics.conversion}
          value={formatRate(overallConversion, analyticsCopy.notAvailable)}
          description={conversionDescription(overallConversion, copy)}
          tone="amber"
          icon={<Percent />}
          loading={loadingReports}
        />
      </section>

      {failedReports.length > 0 ? (
        <div className="recruiter-analytics-inline-alert" role="status">
          <AlertCircle aria-hidden="true" />
          <span>{copy.unavailable(failedReports.length)}</span>
          <button type="button" onClick={() => requestRefresh()}>
            {copy.retry}
          </button>
        </div>
      ) : null}

      <section
        className="recruiter-analytics-panel recruiter-analytics-performance"
        aria-labelledby="posting-performance-title"
      >
        <header className="recruiter-analytics-panel__heading">
          <div>
            <p className="recruiter-analytics-eyebrow">
              {copy.performanceEyebrow}
            </p>
            <h2 id="posting-performance-title">{copy.performanceTitle}</h2>
            <p>{copy.performanceDescription}</p>
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
            {copy.refresh}
          </button>
        </header>
        {reportableJobs.length === 0 ? (
          <div className="recruiter-analytics-empty">
            <FileText aria-hidden="true" />
            <h3>{copy.emptyTitle}</h3>
            <p>{copy.emptyDescription}</p>
            <Link
              href={
                selectedCompanyId
                  ? recruiterRoutes.jobPostingCreateForCompany(
                      selectedCompanyId,
                    )
                  : recruiterRoutes.jobPostingCreate
              }
              className="recruiter-analytics-primary-link"
            >
              <Plus aria-hidden="true" />
              {copy.createJob}
            </Link>
          </div>
        ) : (
          <div className="recruiter-analytics-table-wrap">
            <table className="recruiter-analytics-performance-table">
              <caption className="sr-only">{copy.tableCaption}</caption>
              <thead>
                <tr>
                  {[
                    ["title", copy.columns.job],
                    ["views", copy.columns.views],
                    ["applications", copy.columns.applications],
                    ["conversion", copy.columns.conversion],
                  ].map(([key, label]) => (
                    <th
                      key={key}
                      scope="col"
                      aria-sort={sortLabel(key as SortKey)}
                    >
                      <button
                        type="button"
                        onClick={() => sortBy(key as SortKey)}
                        aria-label={copy.columns.sortBy(label)}
                      >
                        {label}
                        <span aria-hidden="true">↕</span>
                      </button>
                    </th>
                  ))}
                  <th scope="col">{copy.columns.withdrawn}</th>
                  <th scope="col">{copy.columns.export}</th>
                </tr>
              </thead>
              <tbody>
                {sortedJobs.map((job) => {
                  const state = performance[job.id];
                  const report =
                    state?.status === "success" ? state.report : null;
                  const title = job.title || analyticsCopy.untitledJob;
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
                            {job.status === "active"
                              ? copy.active
                              : copy.closed}
                          </span>
                        </button>
                      </th>
                      <td>
                        {state?.status === "loading"
                          ? "…"
                          : report
                            ? formatNumber(
                                report.qualifiedViews,
                                analyticsCopy.locale,
                              )
                            : "—"}
                      </td>
                      <td>
                        {state?.status === "loading"
                          ? "…"
                          : report
                            ? formatNumber(
                                report.submittedApplications,
                                analyticsCopy.locale,
                              )
                            : "—"}
                      </td>
                      <td>
                        {state?.status === "loading"
                          ? "…"
                          : report
                            ? formatRate(
                                report.conversionRate.value,
                                analyticsCopy.notAvailable,
                              )
                            : "—"}
                      </td>
                      <td>
                        {state?.status === "loading"
                          ? "\u2026"
                          : report
                            ? formatNumber(
                                report.withdrawnApplications,
                                analyticsCopy.locale,
                              )
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
            <strong>
              {copy.selectedLoading(
                selectedJob.title || analyticsCopy.untitledJob,
              )}
            </strong>
            <p>{copy.selectedLoadingDescription}</p>
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
