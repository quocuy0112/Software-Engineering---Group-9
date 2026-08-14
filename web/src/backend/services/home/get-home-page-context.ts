import "server-only";

import { headers } from "next/headers";
import { requireSession } from "@/backend/auth/session/require-session";
import { prisma } from "@/backend/database/prisma";
import { csrfProof } from "@/backend/security/csrf/csrf-proof";
import { JobDiscoveryService } from "@/backend/services/jobs/job-discovery-service";
import {
  rankJobsForCandidate,
  type CandidateJobMatch,
} from "@/backend/services/jobs/candidate-job-match";
import { careerPathSlugs } from "@/shared/contracts/jobs/career-paths";
import { GetProfileAggregateService } from "@/backend/services/profile/get-profile-aggregate";
import { getRecruiterHeaderStatusService } from "@/backend/recruiter-header/recruiter-header-status-service-factory";
import {
  PrismaHomePublicCompanyRepository,
  type HomePublicCompanyRow,
} from "@/backend/repositories/home/prisma-home-public-company-repository";
import { illustrativeSmartMatch } from "@/frontend/features/home/home-display-data";
import type {
  EmployerSpotlight,
  HomeCareerPath,
  HomeJob,
  HomeJobMatchBreakdown,
  HomePageModel,
  HomeSectionState,
  SmartMatchInsight,
} from "@/frontend/features/home/home-page-model";
import type { CandidateProfileContract } from "@/shared/contracts/account/profile";
import type { JobCard } from "@/shared/contracts/jobs/discovery";
import type { RecruiterHeaderStatus } from "@/shared/contracts/recruiter-header-status";

type CurrentSession = { userId: string; sessionId: string } | null;
type AccountProjection = {
  name: string;
  image: string | null;
  language: string | null;
} | null;

export type HomeContextDependencies = {
  requestHeaders: () => Promise<Headers>;
  session: (requestHeaders: Headers) => Promise<CurrentSession>;
  searchJobs: (
    actor:
      | { kind: "visitor" }
      | { kind: "user"; userId: string; sessionId: string },
  ) => Promise<readonly JobCard[]>;
  careerPaths?: (
    actor:
      | { kind: "visitor" }
      | { kind: "user"; userId: string; sessionId: string },
  ) => Promise<readonly HomeCareerPath[]>;
  listCompanies: (now: Date) => Promise<readonly HomePublicCompanyRow[]>;
  countCompanies?: (now: Date) => Promise<number>;
  account: (userId: string) => Promise<AccountProjection>;
  profile: (userId: string) => Promise<CandidateProfileContract>;
  recruiterStatus: (userId: string) => Promise<RecruiterHeaderStatus>;
  proof: (sessionId: string) => string;
  now: () => Date;
};

const defaultDependencies = (): HomeContextDependencies => ({
  requestHeaders: headers,
  session: requireSession,
  searchJobs: async (actor) =>
    (
      await new JobDiscoveryService().search(
        { limit: 6, sort: "NEWEST" },
        actor,
      )
    ).items,
  careerPaths: async (actor) => {
    const service = new JobDiscoveryService();
    return Promise.all(
      careerPathSlugs.map(async (slug) => {
        const result = await service.search(
          { careerPath: slug, limit: 1, sort: "NEWEST" },
          actor,
        );
        return { slug, openJobCount: result.total };
      }),
    );
  },
  listCompanies: (now) => new PrismaHomePublicCompanyRepository().list(now, 5),
  countCompanies: (now) => new PrismaHomePublicCompanyRepository().count(now),
  account: async (userId) => {
    const account = await prisma.userAccount.findUnique({
      where: { id: userId },
      select: {
        name: true,
        image: true,
        preferences: { select: { language: true } },
      },
    });
    return account
      ? {
          name: account.name,
          image: account.image,
          language: account.preferences?.language ?? null,
        }
      : null;
  },
  profile: (userId) => new GetProfileAggregateService().execute(userId),
  recruiterStatus: (userId) =>
    getRecruiterHeaderStatusService().resolveForUser(userId),
  proof: csrfProof,
  now: () => new Date(),
});

function section<T>(items: readonly T[]): HomeSectionState<T> {
  return items.length ? { status: "ready", items } : { status: "empty", items };
}

const unavailableCareerPaths = (): readonly HomeCareerPath[] =>
  careerPathSlugs.map((slug) => ({ slug, openJobCount: null }));

function projectJob(
  job: JobCard,
  match?: { score: number; breakdown?: HomeJobMatchBreakdown },
): HomeJob {
  return {
    id: job.id,
    slug: job.slug,
    title: job.title,
    companyName: job.company.displayName,
    companySlug: job.company.slug,
    companyLogoUrl: job.company.logoUrl,
    companyDescription: job.company.publicDescription,
    location: job.location,
    workArrangement: job.workArrangement,
    employmentType: job.employmentType,
    skills: job.skills.slice(0, 5),
    ...(match ? { matchScore: match.score } : {}),
    ...(match?.breakdown ? { matchBreakdown: match.breakdown } : {}),
    salary: job.salary,
    publishedAt: job.publishedAt,
    saved: job.actions.saved,
    canSave: job.actions.canSave,
  };
}

function companyProjection(row: HomePublicCompanyRow): EmployerSpotlight {
  return {
    slug: row.slug,
    name: row.displayName,
    logoUrl: row.logoUrl,
    ...(row.publicDescription ? { publicSummary: row.publicDescription } : {}),
    ...(row.publicLocation ? { publicLocation: row.publicLocation } : {}),
    ...(row.industry ? { industry: row.industry } : {}),
    ...(row.size ? { size: row.size } : {}),
    openPositionCount: row.openPositionCount,
    destination: { kind: "displayOnly" },
  };
}

const experienceMinimum: Record<JobCard["experienceLevel"], number> = {
  ENTRY: 0,
  JUNIOR: 1,
  MID: 3,
  SENIOR: 5,
  LEAD: 6,
  MANAGER: 7,
};

function matchCandidate(job: JobCard) {
  return {
    id: job.id,
    status: "open",
    title: job.title,
    skillTags: [...job.skills],
    city: job.location,
    experienceMinYears: experienceMinimum[job.experienceLevel],
    education: job.education,
    postedAt: job.publishedAt,
    job,
  };
}

function personalMatch(
  profile: CandidateProfileContract,
  jobs: readonly JobCard[],
  now: Date,
): {
  insight: Extract<SmartMatchInsight, { kind: "personal" }>;
  ranked: readonly CandidateJobMatch<ReturnType<typeof matchCandidate>>[];
} | null {
  const ranked = rankJobsForCandidate(profile, jobs.map(matchCandidate), now);
  const best = ranked[0];
  if (!best) return null;
  return {
    insight: {
      kind: "personal",
      jobSlug: best.candidate.job.slug,
      jobTitle: best.candidate.job.title,
      score: best.matchScore,
      matchingSkills: best.matchingSkills,
      improvementAreas: best.improvementAreas,
      limitations: ["profileSignals", "estimate"],
    },
    ranked,
  };
}

export async function getHomePageContext(
  overrides: Partial<HomeContextDependencies> = {},
): Promise<HomePageModel> {
  const defaults = defaultDependencies();
  const dependencies = {
    ...defaults,
    ...overrides,
    countCompanies:
      overrides.countCompanies ?? (overrides.listCompanies ? undefined : defaults.countCompanies),
  };
  const requestHeaders = await dependencies.requestHeaders();
  const current = await dependencies.session(requestHeaders).catch(() => null);
  const now = dependencies.now();
  const actor = current
    ? ({
        kind: "user",
        userId: current.userId,
        sessionId: current.sessionId,
      } as const)
    : ({ kind: "visitor" } as const);

  const [jobResult, companyResult, companyCountResult, careerPathResult] =
    await Promise.allSettled([
    dependencies.searchJobs(actor),
    dependencies.listCompanies(now),
    dependencies.countCompanies
      ? dependencies.countCompanies(now)
      : Promise.resolve(null),
    dependencies.careerPaths
      ? dependencies.careerPaths(actor)
      : Promise.resolve(unavailableCareerPaths()),
    ]);
  const rawJobs = jobResult.status === "fulfilled" ? jobResult.value : [];
  const spotlights: HomeSectionState<EmployerSpotlight> =
    companyResult.status === "fulfilled"
      ? section(companyResult.value.map(companyProjection))
      : { status: "error", items: [], recovery: { kind: "reloadHome" } };
  const companyCount =
    companyCountResult.status === "fulfilled"
      ? companyCountResult.value
      : null;
  const careerPaths =
    careerPathResult.status === "fulfilled"
      ? careerPathResult.value
      : unavailableCareerPaths();
  const failedJobs: HomeSectionState<HomeJob> = {
    status: "error",
    items: [],
    recovery: { kind: "reloadHome" },
  };

  if (!current) {
    return {
      viewer: { kind: "guest" },
      initialLocale: "vi",
      careerPaths,
      jobs:
        jobResult.status === "fulfilled"
          ? section(rawJobs.map((job) => projectJob(job)))
          : failedJobs,
      spotlights,
      companyCount,
      smartMatch: illustrativeSmartMatch(),
    };
  }

  const [accountResult, recruiterResult, profileResult] =
    await Promise.allSettled([
      dependencies.account(current.userId),
      dependencies.recruiterStatus(current.userId),
      dependencies.profile(current.userId),
    ]);
  const account =
    accountResult.status === "fulfilled" ? accountResult.value : null;
  if (!account) {
    return {
      viewer: { kind: "guest" },
      initialLocale: "vi",
      careerPaths,
      jobs:
        jobResult.status === "fulfilled"
          ? section(rawJobs.map((job) => projectJob(job)))
          : failedJobs,
      spotlights,
      companyCount,
      smartMatch: illustrativeSmartMatch(),
    };
  }

  const recruiterStatus =
    recruiterResult.status === "fulfilled" ? recruiterResult.value : null;
  const employer = recruiterStatus?.state === "APPROVED";
  const recommendation =
    !employer && profileResult.status === "fulfilled" && rawJobs.length
      ? personalMatch(profileResult.value, rawJobs, now)
      : null;
  const jobs =
    jobResult.status === "fulfilled"
      ? section(
          recommendation
            ? recommendation.ranked.map((match) =>
                projectJob(match.candidate.job, {
                  score: match.matchScore,
                  ...(match.matchBreakdown
                    ? { breakdown: match.matchBreakdown }
                    : {}),
                }),
              )
            : rawJobs.map((job) => projectJob(job)),
        )
      : failedJobs;
  const base = {
    displayName: account.name.trim(),
    avatarUrl: account.image,
    csrfProof: dependencies.proof(current.sessionId),
    recruiterStatus,
  };

  return {
    viewer:
      employer && recruiterStatus
        ? { kind: "employer", ...base, recruiterStatus }
        : { kind: "candidate", ...base },
    initialLocale: account.language === "VI" ? "vi" : "en",
    careerPaths,
    jobs,
    spotlights,
    companyCount,
    smartMatch: recommendation?.insight ?? illustrativeSmartMatch(),
  };
}
