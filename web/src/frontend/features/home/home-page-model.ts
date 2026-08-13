import type { RecruiterHeaderStatus } from "@/shared/contracts/recruiter-header-status";

export type HomeLocale = "vi" | "en";

export type HomeRecovery =
  | { kind: "reloadHome" }
  | { kind: "scoped"; source: "jobs" | "companies" };

export type HomeSectionState<T> =
  | { status: "ready"; items: readonly T[] }
  | { status: "loading"; items: readonly T[] }
  | { status: "empty"; items: readonly T[] }
  | { status: "error"; items: readonly T[]; recovery: HomeRecovery };

export type HomeViewer =
  | { kind: "guest" }
  | {
      kind: "candidate";
      displayName: string;
      avatarUrl: string | null;
      csrfProof: string;
      recruiterStatus: RecruiterHeaderStatus | null;
    }
  | {
      kind: "employer";
      displayName: string;
      avatarUrl: string | null;
      csrfProof: string;
      recruiterStatus: RecruiterHeaderStatus;
    };

export type HomeJob = Readonly<{
  id: string;
  slug: string;
  title: string;
  companyName: string;
  companySlug: string;
  companyLogoUrl: string | null;
  companyDescription: string | null;
  location: string;
  workArrangement: "ONSITE" | "HYBRID" | "REMOTE";
  employmentType: string;
  skills: readonly string[];
  matchScore?: number;
  saved: boolean;
  canSave: boolean;
}>;

export type EmployerSpotlight = Readonly<{
  slug: string;
  name: string;
  logoUrl: string | null;
  publicSummary?: string;
  publicLocation?: string;
  industry?: string;
  size?: string;
  openPositionCount?: number;
  destination: { kind: "displayOnly" };
}>;

export type SmartMatchInsight =
  | Readonly<{
      kind: "personal";
      jobSlug: string;
      jobTitle: string;
      score: number;
      matchingSkills: readonly string[];
      improvementAreas: readonly string[];
      limitations: readonly ("profileSignals" | "estimate")[];
    }>
  | Readonly<{
      kind: "illustrative";
      score: number;
    }>;

export type HomePageModel = Readonly<{
  viewer: HomeViewer;
  initialLocale: HomeLocale;
  jobs: HomeSectionState<HomeJob>;
  spotlights: HomeSectionState<EmployerSpotlight>;
  smartMatch: SmartMatchInsight;
}>;

function hasOnlyKeys(value: object, allowed: readonly string[]) {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function validScore(score: number) {
  return Number.isInteger(score) && score >= 0 && score <= 100;
}

export function validateHomePageModel(model: HomePageModel) {
  if (model.jobs.items.length > 6 || model.spotlights.items.length > 6)
    throw new Error("HOME_SECTION_LIMIT");
  const viewerKeys =
    model.viewer.kind === "guest"
      ? ["kind"]
      : [
          "kind",
          "displayName",
          "avatarUrl",
          "csrfProof",
          "recruiterStatus",
        ];
  if (!hasOnlyKeys(model.viewer, viewerKeys))
    throw new Error("HOME_VIEWER_PRIVATE_FIELD");
  if (model.smartMatch.kind === "personal" && model.viewer.kind !== "candidate")
    throw new Error("HOME_PERSONAL_MATCH_AUTHORITY");
  if (!validScore(model.smartMatch.score))
    throw new Error("HOME_MATCH_SCORE_INVALID");
  if (
    model.smartMatch.kind !== "personal" &&
    model.jobs.items.some((job) => job.matchScore !== undefined)
  )
    throw new Error("HOME_JOB_SCORE_AUTHORITY");
  if (model.smartMatch.kind === "personal") {
    const personal = model.smartMatch;
    if (
      model.jobs.items.some(
        (job) =>
          job.matchScore !== undefined &&
          (job.slug !== personal.jobSlug ||
            job.matchScore !== personal.score ||
            !validScore(job.matchScore)),
      )
    )
      throw new Error("HOME_JOB_SCORE_ASSOCIATION");
  }
  if (
    model.spotlights.items.some(
      (company) =>
        company.destination.kind !== "displayOnly" ||
        !hasOnlyKeys(company, [
          "slug",
          "name",
          "logoUrl",
          "publicSummary",
          "publicLocation",
          "industry",
          "size",
          "openPositionCount",
          "destination",
        ]) ||
        !hasOnlyKeys(company.destination, ["kind"]),
    )
  )
    throw new Error("HOME_COMPANY_DESTINATION");
  for (const [source, state] of [
    ["jobs", model.jobs],
    ["companies", model.spotlights],
  ] as const) {
    if (
      state.status === "error" &&
      state.recovery.kind === "scoped" &&
      state.recovery.source !== source
    )
      throw new Error("HOME_RECOVERY_SCOPE");
    if (state.status !== "error" && "recovery" in state)
      throw new Error("HOME_RECOVERY_STATE");
  }
  return model;
}
