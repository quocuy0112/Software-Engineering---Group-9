"use client";

import { memo, useCallback, useMemo, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  ChevronLeft,
  ChevronRight,
  Grid2X2,
  List,
  LoaderCircle,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import type { RecruiterJob } from "@/shared/contracts/recruiter-job-posting";
import { recruiterRoutes } from "@/shared/routing/recruiter-routes";
import { RecruiterCandidateWorkspace } from "./recruiter-candidate-workspace";
import { CampaignDistributionBar } from "./campaign-distribution-bar";
import {
  useCampaignScoringStats,
  type CampaignScoringStats,
} from "./use-campaign-scoring-stats";

const visibleStatuses = new Set<RecruiterJob["status"]>(["active", "closed"]);
const campaignRangeSeparator = "\u2013";
const campaignPaginationEllipsis = "\u2026";

function applicationLabel(count: number) {
  return `${count.toLocaleString("en-US")} ${count === 1 ? "candidate" : "candidates"}`;
}

function departmentFor(job: RecruiterJob) {
  return (
    job.description.generalInfo.department?.trim() ||
    job.categoryFamily ||
    job.industry
  );
}

type CampaignPaginationItem = number | "ellipsis";

function campaignPaginationItems(
  pageCount: number,
  pageIndex: number,
): CampaignPaginationItem[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index);
  }

  const visiblePages = new Set([0, pageCount - 1, pageIndex]);
  if (pageIndex > 0) visiblePages.add(pageIndex - 1);
  if (pageIndex < pageCount - 1) visiblePages.add(pageIndex + 1);
  const sortedPages = Array.from(visiblePages).sort(
    (left, right) => left - right,
  );
  const items: CampaignPaginationItem[] = [];

  sortedPages.forEach((page, index) => {
    if (index > 0 && page - sortedPages[index - 1] > 1) {
      items.push("ellipsis");
    }
    items.push(page);
  });

  return items;
}

function CampaignPagination({
  pageIndex,
  pageCount,
  pageSize,
  total,
  onPage,
  onPageSize,
}: {
  pageIndex: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onPage: (pageIndex: number) => void;
  onPageSize: (pageSize: number) => void;
}) {
  const start = pageIndex * pageSize + 1;
  const end = Math.min((pageIndex + 1) * pageSize, total);
  return (
    <footer className="ranking-pagination campaign-pagination">
      <span>
        Showing {start}
        {campaignRangeSeparator}
        {end} of {total} campaigns
      </span>
      <label>
        <span>Campaigns per page</span>
        <select
          value={pageSize}
          onChange={(event) => onPageSize(Number(event.target.value))}
        >
          <option value={12}>12 / page</option>
          <option value={24}>24 / page</option>
          <option value={48}>48 / page</option>
        </select>
      </label>
      <nav
        className="ranking-pager campaign-pagination__pager"
        aria-label="Campaign pagination"
      >
        <button
          type="button"
          onClick={() => onPage(pageIndex - 1)}
          disabled={pageIndex === 0}
          aria-label="Previous page"
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        {campaignPaginationItems(pageCount, pageIndex).map((item, index) =>
          item === "ellipsis" ? (
            <span
              className="campaign-pagination__ellipsis"
              key={`ellipsis-${index}`}
              aria-hidden="true"
            >
              {campaignPaginationEllipsis}
            </span>
          ) : (
            <button
              type="button"
              className={item === pageIndex ? "is-current" : undefined}
              key={item}
              onClick={() => onPage(item)}
              aria-label={`Page ${item + 1}`}
              aria-current={item === pageIndex ? "page" : undefined}
            >
              {item + 1}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => onPage(pageIndex + 1)}
          disabled={pageIndex === pageCount - 1}
          aria-label="Next page"
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </nav>
    </footer>
  );
}

const CampaignCard = memo(function CampaignCard({
  job,
  view,
  stats,
  statsLoading,
  statsError,
  hasUpdates,
}: {
  job: RecruiterJob;
  view: "grid" | "list";
  stats?: CampaignScoringStats;
  statsLoading: boolean;
  statsError: boolean;
  hasUpdates: boolean;
}) {
  const isActive = job.status === "active";
  const applicantCount = stats?.total ?? job.stats.applicantCount;
  return (
    <article className={`campaign-card campaign-card--${view}`}>
      <div className="campaign-card__main">
        <div className="campaign-card__topline">
          <div className="campaign-card__topline-left">
            <span
              className={`campaign-status-pill campaign-status-pill--${isActive ? "active" : "closed"}`}
            >
              <span className="campaign-status-pill__dot" aria-hidden="true" />
              {isActive ? "Active" : "Closed"}
            </span>
            {hasUpdates ? (
              <span
                className="campaign-card__update-badge"
                aria-label="Campaign updated since your last view"
              >
                <span aria-hidden="true" />
                Updated
              </span>
            ) : null}
          </div>
          <span className="campaign-card__department">
            <BriefcaseBusiness aria-hidden="true" />
            {departmentFor(job)}
          </span>
        </div>
        <h2>{job.title || "Untitled job posting"}</h2>
        <p className="campaign-card__company">
          <Building2 aria-hidden="true" />
          {job.company.name}
        </p>
        <div className="campaign-card__applicants">
          <strong>{applicationLabel(applicantCount)}</strong>
          <span>Applications received</span>
        </div>
      </div>
      <CampaignDistributionBar
        jobId={job.id}
        stats={stats}
        fallbackTotal={job.stats.applicantCount}
        loading={statsLoading && !stats}
        error={statsError}
      />
      <div className="campaign-card__footer">
        <span className="campaign-card__updated">
          Updated{" "}
          {new Date(job.updatedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
        <a
          href={recruiterRoutes.candidateRanking(job.id)}
          className="campaign-card__action"
          aria-label={`Review candidates for ${job.title || "Untitled job posting"}`}
        >
          Review candidates
          <ArrowRight aria-hidden="true" />
        </a>
      </div>
    </article>
  );
});

export function RecruiterCandidatesPage({
  jobs,
  selectedJobId,
}: {
  jobs: RecruiterJob[];
  selectedJobId?: string;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | "active" | "closed">("ALL");
  const [department, setDepartment] = useState("ALL");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [campaignPageIndex, setCampaignPageIndex] = useState(0);
  const [campaignPageSize, setCampaignPageSize] = useState(12);
  const campaignData = useCampaignScoringStats(jobs);
  const liveJobs = campaignData.jobs ?? jobs;
  const stats = campaignData.stats;
  const statsError = campaignData.error;
  const statsLoading = campaignData.loading;
  const campaignError = campaignData.campaignError;
  const refreshing = campaignData.refreshing;
  const lastUpdatedAt = campaignData.lastUpdatedAt;
  const changedJobIds = campaignData.changedJobIds;
  const refreshCampaigns = campaignData.refresh;
  const selectableJobs = useMemo(
    () =>
      liveJobs
        .filter((job) => visibleStatuses.has(job.status))
        .sort(
          (left, right) =>
            right.stats.applicantCount - left.stats.applicantCount ||
            right.updatedAt.localeCompare(left.updatedAt),
        ),
    [liveJobs],
  );
  const departments = useMemo(
    () =>
      Array.from(new Set(selectableJobs.map(departmentFor))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [selectableJobs],
  );
  const filteredJobs = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return selectableJobs.filter((job) => {
      if (status !== "ALL" && job.status !== status) return false;
      if (department !== "ALL" && departmentFor(job) !== department)
        return false;
      if (!normalizedSearch) return true;
      return [job.title, job.company.name, departmentFor(job)]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedSearch);
    });
  }, [department, search, selectableJobs, status]);
  const campaignPageCount = Math.max(
    1,
    Math.ceil(filteredJobs.length / campaignPageSize),
  );
  const currentCampaignPageIndex = Math.min(
    campaignPageIndex,
    campaignPageCount - 1,
  );
  const pagedJobs = filteredJobs.slice(
    currentCampaignPageIndex * campaignPageSize,
    (currentCampaignPageIndex + 1) * campaignPageSize,
  );
  const hasCampaignFilters =
    Boolean(search.trim()) || status !== "ALL" || department !== "ALL";
  const clearCampaignFilters = () => {
    setSearch("");
    setStatus("ALL");
    setDepartment("ALL");
    setCampaignPageIndex(0);
  };
  const handleRefresh = useCallback(() => {
    void refreshCampaigns?.("manual");
  }, [refreshCampaigns]);
  const selectedJob = liveJobs.find((job) => job.id === selectedJobId);

  if (selectedJob) {
    return (
      <RecruiterCandidateWorkspace
        jobId={selectedJob.id}
        jobTitle={selectedJob.title}
        backHref={recruiterRoutes.candidates}
      />
    );
  }

  return (
    <section
      className="recruiter-management recruiter-candidates-page"
      aria-labelledby="recruiter-candidates-title"
    >
      <header className="campaign-page-header">
        <div>
          <p className="recruiter-eyebrow">Recruiter workspace</p>
          <h1 id="recruiter-candidates-title">Candidates</h1>
          <p>
            Choose a campaign to review applications, evidence, and hybrid
            scoring in one focused workspace.
          </p>
        </div>
        <div className="campaign-page-header__meta">
          <span>
            <Users aria-hidden="true" /> {selectableJobs.length} campaigns
          </span>
          <span className="campaign-insights-meta" role="status">
            <LoaderCircle
              aria-hidden="true"
              className={statsLoading ? "is-spinning" : undefined}
            />{" "}
            {statsLoading
              ? "Updating insights"
              : statsError
                ? "Insights unavailable"
                : "Insights up to date"}
            {statsError ? (
              <button
                type="button"
                className="campaign-insights-retry"
                onClick={handleRefresh}
              >
                Retry
              </button>
            ) : null}
          </span>
          {campaignError ? (
            <span className="campaign-page-header__meta-error">
              Campaign data unavailable
            </span>
          ) : null}
        </div>
      </header>

      <div
        className="ai-ranking-human-banner campaign-trust-banner"
        role="note"
      >
        <span className="campaign-trust-banner__icon" aria-hidden="true">
          <SlidersHorizontal />
        </span>
        <div>
          <strong>Scores support decision-making only.</strong>
          <span>
            Automatic and AI scores help you prioritize review; every hiring
            decision remains with the recruiter.
          </span>
        </div>
      </div>

      <div className="campaign-toolbar" role="search">
        <label className="campaign-search-field">
          <Search aria-hidden="true" />
          <span className="sr-only">Search campaigns</span>
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setCampaignPageIndex(0);
            }}
            placeholder="Search by role, company, or department"
          />
        </label>
        <label className="campaign-filter-field">
          <span>Status</span>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as typeof status);
              setCampaignPageIndex(0);
            }}
          >
            <option value="ALL">All statuses</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        <label className="campaign-filter-field">
          <span>Department</span>
          <select
            value={department}
            onChange={(event) => {
              setDepartment(event.target.value);
              setCampaignPageIndex(0);
            }}
          >
            <option value="ALL">All departments</option>
            {departments.map((item) => (
              <option value={item} key={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <div className="campaign-view-toggle" aria-label="Campaign view">
          <button
            type="button"
            className={view === "grid" ? "is-active" : ""}
            onClick={() => setView("grid")}
            aria-label="Grid view"
            aria-pressed={view === "grid"}
          >
            <Grid2X2 aria-hidden="true" />
          </button>
          <button
            type="button"
            className={view === "list" ? "is-active" : ""}
            onClick={() => setView("list")}
            aria-label="List view"
            aria-pressed={view === "list"}
          >
            <List aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="campaign-results-toolbar">
        <div>
          <strong>
            {filteredJobs.length
              ? `Showing ${currentCampaignPageIndex * campaignPageSize + 1}${campaignRangeSeparator}${Math.min((currentCampaignPageIndex + 1) * campaignPageSize, filteredJobs.length)} of ${filteredJobs.length} campaigns`
              : `Showing 0${campaignRangeSeparator}0 of 0 campaigns`}
          </strong>
          <span>
            {hasCampaignFilters
              ? "matching your filters"
              : "ready for candidate review"}
          </span>
        </div>
        <div className="campaign-results-actions">
          {lastUpdatedAt ? (
            <span className="campaign-refresh-confirmation" role="status">
              Updated just now
            </span>
          ) : null}
          <button
            type="button"
            className="campaign-refresh-button"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              aria-hidden="true"
              className={refreshing ? "is-spinning" : undefined}
            />
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
          {hasCampaignFilters ? (
            <button
              type="button"
              className="ai-ranking-clear-button"
              onClick={clearCampaignFilters}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      {selectableJobs.length === 0 ? (
        <div className="campaign-empty-state recruiter-surface-card">
          <span className="campaign-empty-state__icon" aria-hidden="true">
            <BriefcaseBusiness />
          </span>
          <h2>No campaigns are ready for candidate review</h2>
          <p>
            Active and closed job postings will appear here after they are
            available to candidates.
          </p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="campaign-empty-state recruiter-surface-card">
          <span className="campaign-empty-state__icon" aria-hidden="true">
            <Search />
          </span>
          <h2>No campaigns match these filters</h2>
          <p>Try a different role, status, or department.</p>
          <button
            type="button"
            className="ai-ranking-button ai-ranking-button--secondary"
            onClick={clearCampaignFilters}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div
          className={`campaign-card-grid campaign-card-grid--${view}`}
          role="list"
        >
          {pagedJobs.map((job) => (
            <div role="listitem" key={job.id}>
              <CampaignCard
                job={job}
                view={view}
                stats={stats[job.id]}
                statsLoading={statsLoading}
                statsError={Boolean(statsError)}
                hasUpdates={changedJobIds?.has(job.id) ?? false}
              />
            </div>
          ))}
        </div>
      )}
      {filteredJobs.length > 0 ? (
        <CampaignPagination
          pageIndex={currentCampaignPageIndex}
          pageCount={campaignPageCount}
          pageSize={campaignPageSize}
          total={filteredJobs.length}
          onPage={setCampaignPageIndex}
          onPageSize={(nextPageSize) => {
            setCampaignPageSize(nextPageSize);
            setCampaignPageIndex(0);
          }}
        />
      ) : null}
    </section>
  );
}
