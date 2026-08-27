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
import type {
  RecruiterCompanyView,
  RecruiterJob,
} from "@/shared/contracts/recruiter-job-posting";
import { recruiterRoutes } from "@/shared/routing/recruiter-routes";
import { RecruiterCandidateWorkspace } from "./recruiter-candidate-workspace";
import { CampaignDistributionBar } from "./campaign-distribution-bar";
import { RecruiterCompanyFilter } from "@/frontend/features/recruiter-workspace/recruiter-company-filter";
import {
  companyMatchesScope,
  useRecruiterCompanyScope,
} from "@/frontend/features/recruiter-workspace/recruiter-company-scope";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import {
  recruiterApplicationsCopy,
  type RecruiterApplicationsCopy,
} from "./recruiter-applications-copy";

const emptyCompanies: RecruiterCompanyView[] = [];
import {
  useCampaignScoringStats,
  type CampaignScoringStats,
} from "./use-campaign-scoring-stats";

const visibleStatuses = new Set<RecruiterJob["status"]>(["active", "closed"]);
const campaignPaginationEllipsis = "\u2026";

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
  copy,
}: {
  pageIndex: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onPage: (pageIndex: number) => void;
  onPageSize: (pageSize: number) => void;
  copy: RecruiterApplicationsCopy["campaigns"];
}) {
  const start = pageIndex * pageSize + 1;
  const end = Math.min((pageIndex + 1) * pageSize, total);
  return (
    <footer className="ranking-pagination campaign-pagination">
      <span>{copy.showing(start, end, total)}</span>
      <label>
        <span>{copy.pagination.campaignsPerPage}</span>
        <select
          value={pageSize}
          onChange={(event) => onPageSize(Number(event.target.value))}
        >
          <option value={12}>{copy.pagination.perPage(12)}</option>
          <option value={24}>{copy.pagination.perPage(24)}</option>
          <option value={48}>{copy.pagination.perPage(48)}</option>
        </select>
      </label>
      <nav
        className="ranking-pager campaign-pagination__pager"
        aria-label={copy.pagination.pagination}
      >
        <button
          type="button"
          onClick={() => onPage(pageIndex - 1)}
          disabled={pageIndex === 0}
          aria-label={copy.pagination.previous}
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
              aria-label={copy.pagination.page(item + 1)}
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
          aria-label={copy.pagination.next}
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
  copy,
  locale,
}: {
  job: RecruiterJob;
  view: "grid" | "list";
  stats?: CampaignScoringStats;
  statsLoading: boolean;
  statsError: boolean;
  hasUpdates: boolean;
  copy: RecruiterApplicationsCopy["campaigns"];
  locale: "vi" | "en";
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
              {isActive ? copy.active : copy.closed}
            </span>
            {hasUpdates ? (
              <span
                className="campaign-card__update-badge"
                aria-label={copy.updated}
              >
                <span aria-hidden="true" />
                {copy.updated}
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
          <strong>{copy.candidates(applicantCount)}</strong>
          <span>{copy.applicationReceived}</span>
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
          {copy.updatedOn(
            new Date(job.updatedAt).toLocaleDateString(
              locale === "vi" ? "vi-VN" : "en-US",
              {
                month: "short",
                day: "numeric",
                year: "numeric",
              },
            ),
          )}
        </span>
        <a
          href={recruiterRoutes.candidateRanking(job.id)}
          className="campaign-card__action"
          aria-label={copy.reviewCandidatesFor(job.title || copy.noTitle)}
        >
          {copy.reviewCandidates}
          <ArrowRight aria-hidden="true" />
        </a>
        <a
          href={recruiterRoutes.pipelineForJob(job.id)}
          className="campaign-card__action"
          aria-label={copy.viewPipelineFor(job.title || copy.noTitle)}
        >
          {copy.viewPipeline}
          <ArrowRight aria-hidden="true" />
        </a>
      </div>
    </article>
  );
});

export function RecruiterCandidatesPage({
  jobs,
  companies,
  selectedJobId,
  csrfProof,
}: {
  jobs: RecruiterJob[];
  companies?: RecruiterCompanyView[];
  selectedJobId?: string;
  csrfProof?: string;
}) {
  const locale = useWorkspaceLocale();
  const copy = recruiterApplicationsCopy(locale).campaigns;
  const companyOptions = companies ?? emptyCompanies;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | "active" | "closed">("ALL");
  const [department, setDepartment] = useState("ALL");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [campaignPageIndex, setCampaignPageIndex] = useState(0);
  const [campaignPageSize, setCampaignPageSize] = useState(12);
  const { companyId, selectedCompanyId, setCompanyId } =
    useRecruiterCompanyScope(companyOptions);
  const campaignData = useCampaignScoringStats(jobs);
  const liveJobs = (campaignData.jobs ?? jobs).filter((job) =>
    companyMatchesScope(job.companyId, selectedCompanyId),
  );
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
    Boolean(search.trim()) ||
    status !== "ALL" ||
    department !== "ALL" ||
    companyId !== "all";
  const clearCampaignFilters = () => {
    setSearch("");
    setStatus("ALL");
    setDepartment("ALL");
    setCompanyId("all");
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
        csrfProof={csrfProof}
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
          <p className="recruiter-eyebrow">{copy.workspace}</p>
          <h1 id="recruiter-candidates-title">{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
        <div className="campaign-page-header__meta">
          <span>
            <Users aria-hidden="true" /> {copy.campaign(selectableJobs.length)}
          </span>
          <span className="campaign-insights-meta" role="status">
            <LoaderCircle
              aria-hidden="true"
              className={statsLoading ? "is-spinning" : undefined}
            />{" "}
            {statsLoading
              ? copy.insightsUpdating
              : statsError
                ? copy.insightsUnavailable
                : copy.insightsUpToDate}
            {statsError ? (
              <button
                type="button"
                className="campaign-insights-retry"
                onClick={handleRefresh}
              >
                {copy.retry}
              </button>
            ) : null}
          </span>
          {campaignError ? (
            <span className="campaign-page-header__meta-error">
              {copy.campaignDataUnavailable}
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
          <strong>{copy.trustTitle}</strong>
          <span>{copy.trustDescription}</span>
        </div>
      </div>

      <div
        className={`campaign-toolbar${companyOptions.length > 1 ? "campaign-toolbar--with-company" : ""}`}
        role="search"
      >
        <label className="campaign-search-field">
          <Search aria-hidden="true" />
          <span className="sr-only">{copy.searchCampaigns}</span>
          <input
            id="candidate-campaign-search"
            name="campaignSearch"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setCampaignPageIndex(0);
            }}
            placeholder={copy.searchPlaceholder}
          />
        </label>
        <label className="campaign-filter-field">
          <span>{copy.status}</span>
          <select
            id="candidate-campaign-status"
            name="campaignStatus"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as typeof status);
              setCampaignPageIndex(0);
            }}
          >
            <option value="ALL">{copy.allStatuses}</option>
            <option value="active">{copy.active}</option>
            <option value="closed">{copy.closed}</option>
          </select>
        </label>
        <label className="campaign-filter-field">
          <span>{copy.department}</span>
          <select
            id="candidate-campaign-department"
            name="campaignDepartment"
            value={department}
            onChange={(event) => {
              setDepartment(event.target.value);
              setCampaignPageIndex(0);
            }}
          >
            <option value="ALL">{copy.allDepartments}</option>
            {departments.map((item) => (
              <option value={item} key={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <RecruiterCompanyFilter
          companies={companyOptions}
          value={companyId}
          onChange={(next) => {
            setCompanyId(next);
            setCampaignPageIndex(0);
          }}
          id="candidate-campaign-company"
          className="campaign-filter-field"
        />
        <div className="campaign-view-toggle" aria-label={copy.campaignView}>
          <button
            type="button"
            className={view === "grid" ? "is-active" : ""}
            onClick={() => setView("grid")}
            aria-label={copy.gridView}
            aria-pressed={view === "grid"}
          >
            <Grid2X2 aria-hidden="true" />
          </button>
          <button
            type="button"
            className={view === "list" ? "is-active" : ""}
            onClick={() => setView("list")}
            aria-label={copy.listView}
            aria-pressed={view === "list"}
          >
            <List aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="campaign-results-toolbar">
        <div>
          <strong>
            {copy.showing(
              filteredJobs.length
                ? currentCampaignPageIndex * campaignPageSize + 1
                : 0,
              filteredJobs.length
                ? Math.min(
                    (currentCampaignPageIndex + 1) * campaignPageSize,
                    filteredJobs.length,
                  )
                : 0,
              filteredJobs.length,
            )}
          </strong>
          <span>
            {hasCampaignFilters ? copy.matchingFilters : copy.readyForReview}
          </span>
        </div>
        <div className="campaign-results-actions">
          {lastUpdatedAt ? (
            <span className="campaign-refresh-confirmation" role="status">
              {copy.updatedJustNow}
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
            {refreshing ? copy.refreshing : copy.refresh}
          </button>
          {hasCampaignFilters ? (
            <button
              type="button"
              className="ai-ranking-clear-button"
              onClick={clearCampaignFilters}
            >
              {copy.clearFilters}
            </button>
          ) : null}
        </div>
      </div>

      {selectableJobs.length === 0 ? (
        <div className="campaign-empty-state recruiter-surface-card">
          <span className="campaign-empty-state__icon" aria-hidden="true">
            <BriefcaseBusiness />
          </span>
          <h2>{copy.emptyReadyTitle}</h2>
          <p>{copy.emptyReadyDescription}</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="campaign-empty-state recruiter-surface-card">
          <span className="campaign-empty-state__icon" aria-hidden="true">
            <Search />
          </span>
          <h2>{copy.emptyFilteredTitle}</h2>
          <p>{copy.emptyFilteredDescription}</p>
          <button
            type="button"
            className="ai-ranking-button ai-ranking-button--secondary"
            onClick={clearCampaignFilters}
          >
            {copy.clearFilters}
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
                copy={copy}
                locale={locale}
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
          copy={copy}
        />
      ) : null}
    </section>
  );
}
