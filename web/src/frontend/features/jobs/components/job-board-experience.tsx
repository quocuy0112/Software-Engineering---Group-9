"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import type {
  JobCard,
  JobSearchResponse,
} from "@/shared/contracts/jobs/discovery";
import { FilterBar, sortModeFromParams } from "./filter-bar";
import type { JobSortMode } from "./filter-bar";
import { JobCardView } from "./job-card";
import { useOptionalJobInteraction } from "./job-interaction-provider";
import { useSearchParams } from "next/navigation";
import { QuickViewPanel } from "./quick-view-panel";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { jobCopy } from "./job-copy";

function salaryValue(job: JobCard, key: "minimum" | "maximum") {
  return job.salary?.[key] ?? -1;
}

/**
 * Keep the browser-side result guard aligned with the repository search.
 *
 * The API already applies the authoritative candidate-visible predicates. We
 * still filter the hydrated page locally for URL-driven controls, so this
 * normalizer deliberately mirrors the server's accent-insensitive token
 * matching without importing server-only modules into a client component.
 */
function normalizeClientSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[đĐ]/gu, "d")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

function sortJobs(jobs: JobCard[], mode: JobSortMode) {
  return [...jobs].sort((left, right) => {
    if (mode === "salary-high")
      return salaryValue(right, "maximum") - salaryValue(left, "maximum");
    if (mode === "salary-low")
      return salaryValue(left, "minimum") - salaryValue(right, "minimum");
    if (mode === "urgent") {
      const urgentDifference =
        Number(Boolean(right.isUrgent)) - Number(Boolean(left.isUrgent));
      if (urgentDifference) return urgentDifference;
      return (
        new Date(left.applicationDeadline ?? "9999-12-31").getTime() -
        new Date(right.applicationDeadline ?? "9999-12-31").getTime()
      );
    }
    if (mode === "recently-updated") {
      return (
        new Date(right.updatedAt ?? right.publishedAt).getTime() -
        new Date(left.updatedAt ?? left.publishedAt).getTime()
      );
    }
    return (
      new Date(right.publishedAt).getTime() -
      new Date(left.publishedAt).getTime()
    );
  });
}

function fieldErrorList(fieldErrors: Record<string, string[]>) {
  return Object.entries(fieldErrors).flatMap(([field, messages]) =>
    messages.map((message) => (
      <li key={field + "-" + message}>
        <strong>{field}:</strong> {message}
      </li>
    )),
  );
}

export function JobBoardExperience({
  result,
  error,
  fieldErrors,
  nextHref,
}: {
  result: JobSearchResponse | null;
  error: string | null;
  fieldErrors: Record<string, string[]>;
  nextHref: string | null;
}) {
  const shared = useOptionalJobInteraction();
  const locale = useWorkspaceLocale();
  const copy = jobCopy(locale);
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const sortMode: JobSortMode = sortModeFromParams(searchParams);

  const allJobs = useMemo(() => result?.items ?? [], [result]);
  const clientFilteredJobs = useMemo(() => {
    const query = normalizeClientSearchText(searchParams.get("q") ?? "");
    const queryWords = query.split(" ").filter(Boolean);
    const searchBy = searchParams.get("searchBy") ?? "BOTH";
    const minimumYears = Number(searchParams.get("experienceMinYears") ?? "");
    const categoryFamily = (
      searchParams.get("categoryFamily") ?? ""
    ).toLowerCase();
    const saturdayOnly = searchParams.get("workOnSaturday") === "true";
    return allJobs.filter((job) => {
      const target =
        searchBy === "TITLE"
          ? job.title
          : searchBy === "COMPANY"
            ? job.company.displayName
            : [job.title, job.company.displayName, ...job.skills].join(" ");
      const normalizedTarget = normalizeClientSearchText(target);
      const matchesQuery = queryWords.every((word) =>
        normalizedTarget.includes(word),
      );
      const matchesExperience =
        !Number.isFinite(minimumYears) ||
        !minimumYears ||
        (job.experienceMinYears ?? 0) >= minimumYears;
      const matchesCategory =
        !categoryFamily ||
        (job.categoryFamily ?? "").toLowerCase().includes(categoryFamily) ||
        ((categoryFamily === "r29" || categoryFamily === "other") &&
          ["r29", "other"].includes((job.categoryFamily ?? "").toLowerCase()));
      const matchesSaturday = !saturdayOnly || job.workOnSaturday === true;
      return (
        matchesQuery && matchesExperience && matchesCategory && matchesSaturday
      );
    });
  }, [allJobs, searchParams]);
  const visibleJobs = useMemo(
    () => clientFilteredJobs.filter((job) => !shared?.records[job.id]?.hidden),
    [clientFilteredJobs, shared?.records],
  );
  const displayJobs = useMemo(
    () => sortJobs(visibleJobs, sortMode),
    [sortMode, visibleJobs],
  );

  const activeQuickViewId =
    quickViewId && displayJobs.some((job) => job.id === quickViewId)
      ? quickViewId
      : null;

  const openQuickView = useCallback((jobId: string) => {
    setQuickViewId(jobId);
  }, []);

  const displayResult = result
    ? { ...result, total: visibleJobs.length }
    : null;

  return (
    <>
      <FilterBar result={displayResult}>
        {error ? (
          <div className="job-panel job-feedback" role="alert">
            <h3>{copy.searchLoadError}</h3>
            <p>{copy.searchResultsDescription}</p>
            {Object.keys(fieldErrors).length ? (
              <ul className="job-error-list">{fieldErrorList(fieldErrors)}</ul>
            ) : null}
            <Link className="job-secondary-link" href="/jobs">
              {copy.clearFiltersRetry}
            </Link>
          </div>
        ) : displayJobs.length ? (
          <>
            <header className="job-results-heading">
              <div>
                <p className="panel-kicker">{copy.searchResultsKicker}</p>
                <h2 id="job-results-heading">
                  {visibleJobs.length} {copy.matchingJobs}
                </h2>
              </div>
              <p>{copy.searchResultsDescription}</p>
            </header>
            <ol className="job-list" aria-label={copy.matchingJobs}>
              {displayJobs.map((job) => (
                <li key={job.id}>
                  <JobCardView
                    job={job}
                    onQuickView={() => openQuickView(job.id)}
                  />
                </li>
              ))}
            </ol>
            {nextHref ? (
              <div className="job-pagination">
                <Link href={nextHref}>{copy.loadMoreJobs}</Link>
              </div>
            ) : null}
          </>
        ) : (
          <div className="job-panel job-empty-state" role="status">
            <span className="job-empty-icon" aria-hidden="true">
              ⌕
            </span>
            <h3>{copy.noMatchingJobs}</h3>
            <p>
              {locale === "vi"
                ? "Hãy thử mở rộng phạm vi địa điểm, mức lương hoặc kinh nghiệm để xem thêm cơ hội."
                : "Try widening the location, salary, or experience range to see more opportunities."}
            </p>
            <Link className="job-secondary-link" href="/jobs">
              {copy.clearAllFilters}
            </Link>
          </div>
        )}
      </FilterBar>

      <QuickViewPanel
        jobs={displayJobs}
        jobId={activeQuickViewId}
        onClose={() => setQuickViewId(null)}
        onJobChange={setQuickViewId}
      />
    </>
  );
}
