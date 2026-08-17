"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  jobSearchResponseSchema,
  type JobSearchResponse,
} from "@/shared/contracts/jobs/discovery";
import {
  JobSearchForm,
  type JobFilterTrigger,
  type JobSearchCriteria,
} from "./job-search-form";
import { JobResultsList } from "./job-results-list";
import { JobsWorkspaceNav } from "./jobs-workspace";

const scalarCriteriaNames = [
  "q",
  "searchBy",
  "location",
  "careerPath",
  "salaryMin",
  "salaryMax",
  "salaryCurrency",
  "salaryPeriod",
  "postedWithinDays",
  "sort",
  "limit",
] as const;

const arrayCriteriaNames = [
  "employmentType",
  "experienceLevel",
  "workArrangement",
  "skills",
] as const;

type HistoryMode = "none" | "replace" | "push";

export type JobsLiveCopy = Readonly<{
  kicker: string;
  title: string;
  intro: string;
  jobs: string;
  openRoles: string;
  filters: string;
  results: string;
  loadFailed: string;
  opportunities: string;
  showing: string;
  of: string;
  tryAgain: string;
  retry: string;
  firstPage: string;
  previousPage: string;
  nextPage: string;
  lastPage: string;
  page: string;
  empty: string;
  emptyCopy: string;
  clear: string;
}>;

function one(value: string | string[] | number | undefined) {
  return Array.isArray(value) ? value[0] : value?.toString();
}

export function criteriaFromSearchParams(
  params: URLSearchParams,
): JobSearchCriteria {
  const criteria: JobSearchCriteria = {};
  for (const name of scalarCriteriaNames) {
    const value = params.get(name);
    if (value) criteria[name] = value;
  }
  for (const name of arrayCriteriaNames) {
    const values = params.getAll(name).filter(Boolean);
    if (values.length) criteria[name] = values;
  }
  return criteria;
}

function criteriaFromInitial(
  initialCriteria: Record<string, string | string[] | undefined>,
) {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(initialCriteria)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(name, item);
    } else if (value) {
      params.append(name, value);
    }
  }
  return criteriaFromSearchParams(params);
}

export function jobSearchParams(criteria: JobSearchCriteria, page: number) {
  const params = new URLSearchParams();
  for (const name of scalarCriteriaNames) {
    const value = one(criteria[name]);
    if (!value || (name === "sort" && value === "RELEVANCE")) continue;
    params.set(name, value);
  }
  for (const name of arrayCriteriaNames) {
    const values = criteria[name];
    for (const value of Array.isArray(values)
      ? values
      : values
        ? [values]
        : []) {
      if (value) params.append(name, String(value));
    }
  }
  if (page > 1) params.set("page", String(page));
  return params;
}

function pageFromSearchParams(params: URLSearchParams) {
  const value = Number(params.get("page") ?? "1");
  return Number.isInteger(value) && value > 0 ? value : 1;
}

function pageNumbers(currentPage: number, totalPages: number) {
  const first = Math.max(1, currentPage - 1);
  const last = Math.min(totalPages, currentPage + 1);
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

function urlFor(criteria: JobSearchCriteria, page: number) {
  const search = jobSearchParams(criteria, page).toString();
  return search ? `/jobs?${search}` : "/jobs";
}

export function LiveJobSearchExperience({
  initialCriteria,
  initialResult,
  initialError,
  copy,
}: Readonly<{
  initialCriteria: Record<string, string | string[] | undefined>;
  initialResult: JobSearchResponse | null;
  initialError: string | null;
  copy: JobsLiveCopy;
}>) {
  const [criteria, setCriteria] = useState<JobSearchCriteria>(() =>
    criteriaFromInitial(initialCriteria),
  );
  const [page, setPage] = useState(() => {
    return initialResult?.page ?? pageFromSearchParams(new URLSearchParams());
  });
  const [result, setResult] = useState<JobSearchResponse | null>(initialResult);
  const [error, setError] = useState<string | null>(
    initialError ? copy.tryAgain : null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const requestId = useRef(0);
  const abortController = useRef<AbortController | null>(null);
  const debounceTimer = useRef<number | null>(null);

  const updateUrl = useCallback(
    (nextCriteria: JobSearchCriteria, nextPage: number, mode: HistoryMode) => {
      if (mode === "none") return;
      const url = urlFor(nextCriteria, nextPage);
      window.history[mode === "push" ? "pushState" : "replaceState"](
        null,
        "",
        url,
      );
    },
    [],
  );

  const cancelPendingRequest = useCallback(() => {
    if (debounceTimer.current !== null) {
      window.clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    requestId.current += 1;
    abortController.current?.abort();
    abortController.current = null;
    setIsLoading(false);
  }, []);

  const fetchJobs = useCallback(
    async (
      nextCriteria: JobSearchCriteria,
      nextPage: number,
      historyMode: HistoryMode,
    ) => {
      abortController.current?.abort();
      const controller = new AbortController();
      abortController.current = controller;
      const currentRequestId = ++requestId.current;

      setIsLoading(true);
      setError(null);
      setPage(nextPage);
      updateUrl(nextCriteria, nextPage, historyMode);

      try {
        const response = await fetch(
          `/api/jobs?${jobSearchParams(nextCriteria, nextPage)}`,
          {
            signal: controller.signal,
            headers: { Accept: "application/json" },
          },
        );
        const payload: unknown = await response.json();
        const parsed = jobSearchResponseSchema.safeParse(payload);
        if (!response.ok || !parsed.success)
          throw new Error("Job search failed");
        if (currentRequestId !== requestId.current) return;
        setResult(parsed.data);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError")
          return;
        if (currentRequestId !== requestId.current) return;
        setError(copy.tryAgain);
      } finally {
        if (currentRequestId === requestId.current) {
          abortController.current = null;
          setIsLoading(false);
        }
      }
    },
    [copy.tryAgain, updateUrl],
  );

  const runCriteriaChange = useCallback(
    (nextCriteria: JobSearchCriteria, trigger: JobFilterTrigger) => {
      cancelPendingRequest();
      setCriteria(nextCriteria);
      setPage(1);
      setError(null);
      updateUrl(nextCriteria, 1, "replace");

      if (trigger === "debounced") {
        debounceTimer.current = window.setTimeout(() => {
          debounceTimer.current = null;
          void fetchJobs(nextCriteria, 1, "none");
        }, 400);
        return;
      }
      void fetchJobs(nextCriteria, 1, "none");
    },
    [cancelPendingRequest, fetchJobs, updateUrl],
  );

  const clearFilters = useCallback(() => {
    runCriteriaChange({}, "immediate");
  }, [runCriteriaChange]);

  const goToPage = useCallback(
    (nextPage: number) => {
      if (nextPage === page || nextPage < 1) return;
      cancelPendingRequest();
      void fetchJobs(criteria, nextPage, "push");
    },
    [cancelPendingRequest, criteria, fetchJobs, page],
  );

  const retry = useCallback(() => {
    cancelPendingRequest();
    void fetchJobs(criteria, page, "none");
  }, [cancelPendingRequest, criteria, fetchJobs, page]);

  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const nextCriteria = criteriaFromSearchParams(params);
      const nextPage = pageFromSearchParams(params);
      cancelPendingRequest();
      setCriteria(nextCriteria);
      setPage(nextPage);
      setError(null);
      void fetchJobs(nextCriteria, nextPage, "none");
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      cancelPendingRequest();
    };
  }, [cancelPendingRequest, fetchJobs]);

  const hasResults = Boolean(result?.items.length);
  const total = result?.total;
  const resultSummary =
    total === undefined ? "" : `${total} ${copy.opportunities}`;

  return (
    <>
      <div className="jobs-fixed-region">
        <JobsWorkspaceNav activeTab="search" />
        <header className="jobs-workspace-heading jobs-workspace-heading--wide">
          <div>
            <p className="workspace-kicker">{copy.kicker}</p>
            <h1 id="workspace-page-title">{copy.title}</h1>
            <p className="page-heading-copy">{copy.intro}</p>
          </div>
          {total !== undefined ? (
            <span
              className="job-count-badge"
              aria-label={`${total} ${copy.jobs}`}
              aria-live="polite"
              aria-atomic="true"
            >
              <strong>{total}</strong>
              <span>{isLoading ? copy.results : copy.openRoles}</span>
            </span>
          ) : null}
        </header>
      </div>

      <div className="jobs-grid">
        <aside className="job-filter-column" aria-label={copy.filters}>
          <JobSearchForm
            criteria={criteria}
            onCriteriaChange={runCriteriaChange}
            onClear={clearFilters}
            resultCount={total}
            isLoading={isLoading}
          />
        </aside>

        <section
          className="job-results"
          aria-labelledby="job-results-heading"
          aria-busy={isLoading}
        >
          <header className="job-results-header">
            <p className="panel-kicker" id="job-results-heading">
              {error ? copy.loadFailed : copy.results}
            </p>
            {resultSummary ? (
              <p
                className="job-results-summary"
                aria-live="polite"
                aria-atomic="true"
              >
                {isLoading
                  ? `${resultSummary} · ${copy.results}`
                  : resultSummary}
              </p>
            ) : null}
          </header>

          <div
            className={`job-results-live-content${isLoading ? "is-refreshing" : ""}`}
          >
            {isLoading ? (
              <div className="job-results-loading" aria-hidden="true">
                <span />
              </div>
            ) : null}

            {error ? (
              <div className="job-panel job-feedback" role="alert">
                <h3>{copy.loadFailed}</h3>
                <p>{error}</p>
                <button
                  className="job-secondary-link"
                  type="button"
                  onClick={retry}
                >
                  {copy.retry}
                </button>
              </div>
            ) : null}

            {hasResults && result ? (
              <>
                <JobResultsList jobs={result.items} />
                {result.totalPages > 1 ? (
                  <nav className="job-pagination" aria-label="Job result pages">
                    <button
                      className="job-pagination-control"
                      type="button"
                      disabled={result.page === 1}
                      aria-label={copy.firstPage}
                      title={copy.firstPage}
                      onClick={() => goToPage(1)}
                    >
                      <span aria-hidden="true">«</span>
                      <span className="job-pagination-control-label">
                        {copy.firstPage}
                      </span>
                    </button>
                    <button
                      className="job-pagination-control"
                      type="button"
                      disabled={result.page === 1}
                      aria-label={copy.previousPage}
                      title={copy.previousPage}
                      onClick={() => goToPage(result.page - 1)}
                    >
                      <span aria-hidden="true">‹</span>
                      <span className="job-pagination-control-label">
                        {copy.previousPage}
                      </span>
                    </button>
                    <div className="job-pagination-pages">
                      <ol>
                        {pageNumbers(result.page, result.totalPages).map(
                          (number) => (
                            <li key={number}>
                              <button
                                className={`job-pagination-page${
                                  number === result.page ? "is-current" : ""
                                }`}
                                type="button"
                                aria-current={
                                  number === result.page ? "page" : undefined
                                }
                                aria-label={`${copy.page} ${number}`}
                                onClick={() => goToPage(number)}
                              >
                                {number}
                              </button>
                            </li>
                          ),
                        )}
                      </ol>
                    </div>
                    <button
                      className="job-pagination-control"
                      type="button"
                      disabled={result.page === result.totalPages}
                      aria-label={copy.nextPage}
                      title={copy.nextPage}
                      onClick={() => goToPage(result.page + 1)}
                    >
                      <span className="job-pagination-control-label">
                        {copy.nextPage}
                      </span>
                      <span aria-hidden="true">›</span>
                    </button>
                    <button
                      className="job-pagination-control"
                      type="button"
                      disabled={result.page === result.totalPages}
                      aria-label={copy.lastPage}
                      title={copy.lastPage}
                      onClick={() => goToPage(result.totalPages)}
                    >
                      <span className="job-pagination-control-label">
                        {copy.lastPage}
                      </span>
                      <span aria-hidden="true">»</span>
                    </button>
                    <p className="job-pagination-progress" aria-live="polite">
                      {copy.page} {result.page} / {result.totalPages}
                    </p>
                  </nav>
                ) : null}
              </>
            ) : !error && !isLoading ? (
              <div className="job-panel job-empty-state">
                <span className="job-empty-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M4 7.5h16v11H4zM8 7.5V5.8A1.8 1.8 0 0 1 9.8 4h4.4A1.8 1.8 0 0 1 16 5.8v1.7M4 12h16" />
                  </svg>
                </span>
                <h3>{copy.empty}</h3>
                <p>{copy.emptyCopy}</p>
                <div className="job-empty-actions">
                  <button
                    className="job-secondary-link"
                    type="button"
                    onClick={clearFilters}
                  >
                    {copy.clear}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </>
  );
}
