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

export default async function JobsPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const actor = await optionalJobActor(await headers());
  let result;
  let error: string | null = null;
  try {
    result = await new JobDiscoveryService().search(query(raw), actor);
  } catch (caught) {
    error =
      caught instanceof JobServiceError
        ? caught.body.message
        : "Jobs could not be loaded. Try again in a moment.";
  }
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    for (const item of Array.isArray(value) ? value : value ? [value] : [])
      next.append(key, item);
  }
  if (result?.nextCursor) next.set("cursor", result.nextCursor);
  return (
    <main className="jobs-shell">
      <div className="jobs-container">
        <header>
          <p>SmartHire opportunities</p>
          <h1>Find work that fits</h1>
          <p>
            Search approved opportunities with transparent details and direct
            applications.
          </p>
        </header>
        <div className="jobs-grid">
          <JobSearchForm criteria={raw} />
          <section aria-labelledby="job-results-heading">
            <h2 id="job-results-heading">Job results</h2>
            {error ? (
              <div className="job-panel job-feedback" role="alert">
                <p>{error}</p>
                <Link href="/jobs">Retry</Link>
              </div>
            ) : result && result.items.length ? (
              <>
                <p aria-live="polite">{result.total} matching jobs</p>
                <ol className="job-list">
                  {result.items.map((job) => (
                    <li key={job.id}>
                      <JobCardView job={job} />
                    </li>
                  ))}
                </ol>
                {result.nextCursor ? (
                  <p>
                    <Link href={`/jobs?${next.toString()}`}>More jobs</Link>
                  </p>
                ) : null}
              </>
            ) : (
              <div className="job-panel">
                <h3>No jobs match these criteria</h3>
                <p>
                  Change or clear one or more filters to broaden the search.
                </p>
                <Link href="/jobs">Clear all filters</Link>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
