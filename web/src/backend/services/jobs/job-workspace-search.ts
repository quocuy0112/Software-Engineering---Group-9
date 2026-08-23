import "server-only";

import type {
  JobCard,
  JobSearchQuery,
} from "@/shared/contracts/jobs/discovery";
import { normalizeSearchText } from "./search-normalization";

export type WorkspaceJobSearchCriteria = Pick<
  JobSearchQuery,
  "q" | "location" | "district"
>;

export function workspaceJobSearchCriteria(
  input: Record<string, string | string[] | undefined>,
): WorkspaceJobSearchCriteria {
  const first = (name: string, maximum: number) => {
    const value = input[name];
    const item = Array.isArray(value) ? value[0] : value;
    return item?.slice(0, maximum) ?? "";
  };
  const districts = input.district;
  return {
    q: first("q", 200),
    location: first("location", 160),
    district: (Array.isArray(districts)
      ? districts
      : districts
        ? [districts]
        : []
    )
      .filter(Boolean)
      .slice(0, 20)
      .map((district) => district.slice(0, 160)),
  };
}

/** Filters an already scoped workspace list (saved or suggested jobs). */
export function filterWorkspaceJobs<T extends JobCard>(
  jobs: readonly T[],
  criteria: WorkspaceJobSearchCriteria,
): T[] {
  const queryTerms = normalizeSearchText(criteria.q).split(" ").filter(Boolean);
  const normalizedLocation = normalizeSearchText(criteria.location, 160);
  const normalizedDistricts = criteria.district.map((district) =>
    normalizeSearchText(district, 160),
  );

  return jobs.filter((job) => {
    const jobLocation = normalizeSearchText(job.location, 160);
    if (normalizedLocation && !jobLocation.includes(normalizedLocation)) {
      return false;
    }
    if (
      normalizedDistricts.length &&
      !normalizedDistricts.some((district) => jobLocation.includes(district))
    ) {
      return false;
    }
    if (!queryTerms.length) return true;
    const searchableText = normalizeSearchText(
      [job.title, job.company.displayName, ...job.skills].join(" "),
      6_000,
    );
    return queryTerms.every((term) => searchableText.includes(term));
  });
}
