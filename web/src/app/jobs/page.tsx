import { headers } from "next/headers";
import Link from "next/link";
import { JobDiscoveryService } from "@/backend/services/jobs/job-discovery-service";
import { JobServiceError } from "@/backend/services/jobs/job-types";
import { optionalJobActor } from "@/backend/security/job-request-boundary";
import { JobCardView } from "@/frontend/features/jobs/components/job-card";
import { JobSearchForm } from "@/frontend/features/jobs/components/job-search-form";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function query(input: Record<string, string | string[] | undefined>) {
  const array = (name: string) => {
    const value = input[name];
    return value === undefined ? [] : Array.isArray(value) ? value : [value];
  };
  return {
    q: Array.isArray(input.q) ? input.q[0] : input.q,
    location: Array.isArray(input.location)
      ? input.location[0]
      : input.location,
    employmentType: array("employmentType").filter(Boolean),
    experienceLevel: array("experienceLevel").filter(Boolean),
    workArrangement: array("workArrangement").filter(Boolean),
    skills: array("skills").filter(Boolean),
    salaryMin: Array.isArray(input.salaryMin)
      ? input.salaryMin[0]
      : input.salaryMin,
    salaryMax: Array.isArray(input.salaryMax)
      ? input.salaryMax[0]
      : input.salaryMax,
    salaryCurrency: Array.isArray(input.salaryCurrency)
      ? input.salaryCurrency[0]
      : input.salaryCurrency,
    salaryPeriod: Array.isArray(input.salaryPeriod)
      ? input.salaryPeriod[0]
      : input.salaryPeriod,
    postedWithinDays: Array.isArray(input.postedWithinDays)
      ? input.postedWithinDays[0]
      : input.postedWithinDays,
    sort: Array.isArray(input.sort) ? input.sort[0] : input.sort,
    cursor: Array.isArray(input.cursor) ? input.cursor[0] : input.cursor,
    limit: Array.isArray(input.limit) ? input.limit[0] : input.limit,
  };
}

const filterLabels: Record<string, string> = {
  q: "Keywords",
  location: "Location",
  employmentType: "Employment type",
  experienceLevel: "Experience level",
  workArrangement: "Work arrangement",
  skills: "Skill",
  salaryMin: "Minimum salary",
  salaryMax: "Maximum salary",
  postedWithinDays: "Posted within",
  sort: "Sort",
};

export default async function JobsPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const actor = await optionalJobActor(await headers());
  let result;
  let error: string | null = null;
  let fieldErrors: Record<string, string[]> = {};
  try {
    result = await new JobDiscoveryService().search(query(raw), actor);
  } catch (caught) {
    if (caught instanceof JobServiceError) {
      error = caught.body.message;
      fieldErrors = caught.body.fieldErrors ?? {};
    } else {
      error = "Jobs could not be loaded. Try again in a moment.";
    }
  }
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    for (const item of Array.isArray(value) ? value : value ? [value] : [])
      next.append(key, item);
  }
  if (result?.nextCursor) next.set("cursor", result.nextCursor);
  return (
    <div className="jobs-page">
      <div className="jobs-fixed-region">
        <header className="page-heading jobs-heading">
          <div>
            <p className="workspace-kicker">SMART HIRE OPPORTUNITIES</p>
            <h1 id="workspace-page-title">Jobs</h1>
            <p className="page-heading-copy">
              Discover verified opportunities and find work that fits your next
              career move.
            </p>
          </div>
          {result ? (
            <span
              className="job-count-badge"
              aria-label={`${result.total} jobs`}
            >
              <strong>{result.total}</strong>
              <span>open roles</span>
            </span>
          ) : null}
        </header>

        <nav className="job-board-tabs" aria-label="Job board">
          <Link href="/jobs" aria-current="page">
            Find jobs
          </Link>
          <span>Verified listings</span>
          <span>Transparent details</span>
        </nav>
      </div>

      <div className="jobs-grid">
        <aside
          className="job-filter-column"
          aria-label="Job filters"
          tabIndex={0}
        >
          <JobSearchForm criteria={raw} />
        </aside>

        <section
          className="job-results"
          aria-labelledby="job-results-heading"
          tabIndex={0}
        >
          <header className="job-results-header">
            <div>
              <p className="panel-kicker">SEARCH RESULTS</p>
              <h2 id="job-results-heading">
                {error
                  ? "Jobs could not be loaded"
                  : `${result?.total ?? 0} opportunities`}
              </h2>
            </div>
            {!error && result ? (
              <p aria-live="polite">
                Showing {result.items.length} of {result.total}
              </p>
            ) : null}
          </header>

          {error ? (
            <div className="job-panel job-feedback" role="alert">
              <h3>Review your filters</h3>
              <p>{error}</p>
              {Object.keys(fieldErrors).length ? (
                <ul className="job-error-list">
                  {Object.entries(fieldErrors).flatMap(([field, messages]) =>
                    messages.map((message) => (
                      <li key={`${field}-${message}`}>
                        <strong>{filterLabels[field] ?? field}:</strong>{" "}
                        {message}
                      </li>
                    )),
                  )}
                </ul>
              ) : null}
              <Link className="job-secondary-link" href="/jobs">
                Clear filters and retry
              </Link>
            </div>
          ) : result && result.items.length ? (
            <>
              <ol className="job-list">
                {result.items.map((job) => (
                  <li key={job.id}>
                    <JobCardView job={job} />
                  </li>
                ))}
              </ol>
              {result.nextCursor ? (
                <div className="job-pagination">
                  <Link href={`/jobs?${next.toString()}`}>Load more jobs</Link>
                </div>
              ) : null}
            </>
          ) : (
            <div className="job-panel job-empty-state">
              <span className="job-empty-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M4 7.5h16v11H4zM8 7.5V5.8A1.8 1.8 0 0 1 9.8 4h4.4A1.8 1.8 0 0 1 16 5.8v1.7M4 12h16" />
                </svg>
              </span>
              <h3>No jobs match these criteria</h3>
              <p>Change or clear one or more filters to broaden the search.</p>
              <Link className="job-secondary-link" href="/jobs">
                Clear all filters
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
