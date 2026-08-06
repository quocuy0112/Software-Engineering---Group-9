import { headers } from "next/headers";
import Link from "next/link";
import { JobDiscoveryService } from "@/backend/services/jobs/job-discovery-service";
import { JobServiceError } from "@/backend/services/jobs/job-types";
import { optionalJobActor } from "@/backend/security/job-request-boundary";
import { JobBoardExperience } from "@/frontend/features/jobs/components/job-board-experience";
import type { JobSearchResponse } from "@/shared/contracts/jobs/discovery";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function query(input: Record<string, string | string[] | undefined>) {
  const array = (name: string) => {
    const value = input[name];
    return value === undefined ? [] : Array.isArray(value) ? value : [value];
  };
  const first = (name: string) => {
    const value = input[name];
    return Array.isArray(value) ? value[0] : value;
  };

  return {
    q: first("q"),
    searchBy: first("searchBy"),
    location: first("location"),
    employmentType: array("employmentType").filter(Boolean),
    experienceLevel: array("experienceLevel").filter(Boolean),
    workArrangement: array("workArrangement").filter(Boolean),
    skills: array("skills").filter(Boolean),
    salaryMin: first("salaryMin"),
    salaryMax: first("salaryMax"),
    salaryCurrency: first("salaryCurrency"),
    salaryPeriod: first("salaryPeriod"),
    postedWithinDays: first("postedWithinDays"),
    sort: first("sort"),
    cursor: first("cursor"),
    limit: first("limit"),
  };
}

export default async function JobsPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const actor = await optionalJobActor(await headers());
  let result: JobSearchResponse | null = null;
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
    <div className="jobs-page job-redesign-page">
      <header className="page-heading jobs-heading job-redesign-heading">
        <div>
          <p className="workspace-kicker">SMART HIRE OPPORTUNITIES</p>
          <h1 id="workspace-page-title">Find work that fits your next move</h1>
          <p className="page-heading-copy">
            Verified roles, transparent details, and a search that stays in sync
            with you.
          </p>
        </div>
        {result ? (
          <span className="job-count-badge" aria-label={result.total + " jobs"}>
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

      <JobBoardExperience
        result={result}
        error={error}
        fieldErrors={fieldErrors}
        nextHref={result?.nextCursor ? "/jobs?" + next.toString() : null}
      />
    </div>
  );
}
