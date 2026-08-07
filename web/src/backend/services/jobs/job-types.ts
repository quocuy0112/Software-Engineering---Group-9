import type {
  ApplicationOutcome,
  JobProblem,
} from "@/shared/contracts/jobs/actions";
import type {
  JobCard,
  JobDetail,
  JobSearchResponse,
} from "@/shared/contracts/jobs/discovery";

export type CandidateActor = { userId: string; sessionId: string };
export type JobActor =
  | { kind: "visitor" }
  | ({ kind: "user" } & CandidateActor);
export type PublicJobState = "ACTIVE" | "CLOSED" | "EXPIRED";

export type NormalizedJobSearch = {
  normalizedQuery: string;
  searchBy?: "TITLE" | "COMPANY" | "BOTH";
  normalizedLocation: string;
  normalizedSkills: string[];
  employmentType: Array<
    "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP" | "TEMPORARY"
  >;
  experienceLevel: Array<
    "ENTRY" | "JUNIOR" | "MID" | "SENIOR" | "LEAD" | "MANAGER"
  >;
  workArrangement: Array<"ONSITE" | "HYBRID" | "REMOTE">;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency: string;
  salaryPeriod: "HOUR" | "MONTH" | "YEAR";
  postedWithinDays?: number;
  sort: "RELEVANCE" | "NEWEST" | "SALARY_DESC";
  cursor?: import("./search-normalization").JobSearchCursor;
  limit: number;
};
export type {
  ApplicationOutcome,
  JobCard,
  JobDetail,
  JobProblem,
  JobSearchResponse,
};

export type JobServiceStatus = 400 | 401 | 403 | 404 | 409 | 413 | 429 | 503;

export class JobServiceError extends Error {
  constructor(
    readonly status: JobServiceStatus,
    readonly body: JobProblem,
  ) {
    super(body.code);
  }
}
