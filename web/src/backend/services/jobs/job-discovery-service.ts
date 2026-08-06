import "server-only";

import { z } from "zod";
import type {
  PublicJobRepository,
  PublicJobRow,
} from "@/backend/repositories/jobs/prisma-public-job-repository";
import { decodeJobCursor, normalizeSearchText } from "./search-normalization";
import {
  JobServiceError,
  type JobActor,
  type NormalizedJobSearch,
  type PublicJobState,
} from "./job-types";
import {
  jobSearchQuerySchema,
  type JobCard,
} from "@/shared/contracts/jobs/discovery";
import {
  computeDiscoveryJobs,
  computeMatchScore,
  computeRelatedJobs,
  type CandidateJobProfile,
  type JobSimilarityInput,
} from "@/shared/utils/jobs/similarity";
import { GetProfileAggregateService } from "@/backend/services/profile/get-profile-aggregate";
import type { CandidateProfileContract } from "@/shared/contracts/account/profile";

const experienceYears: Record<string, number> = {
  ENTRY: 0,
  JUNIOR: 1,
  MID: 3,
  SENIOR: 5,
  LEAD: 6,
  MANAGER: 7,
};

const yearMilliseconds = 365.25 * 24 * 60 * 60 * 1000;

type CandidateSignal = JobSimilarityInput & { row: PublicJobRow };

function candidateExperienceYears(
  profile: CandidateProfileContract,
  now: Date,
) {
  const starts = profile.experience
    .map((item) => Date.parse(item.startDate))
    .filter(Number.isFinite);
  if (!starts.length) return null;

  const ends = profile.experience.map((item) =>
    item.current || !item.endDate ? now.getTime() : Date.parse(item.endDate),
  );
  const earliestStart = Math.min(...starts);
  const latestEnd = Math.max(...ends.filter((value) => Number.isFinite(value)));
  return Math.max(0, (latestEnd - earliestStart) / yearMilliseconds);
}

function candidateProfileSignals(
  profile: CandidateProfileContract,
  now: Date,
): CandidateJobProfile {
  return {
    skillTags: profile.skills.map((skill) => skill.label),
    city: profile.basics.location ?? undefined,
    experienceMinYears: candidateExperienceYears(profile, now),
  };
}

function rankForCandidateProfile(
  profile: CandidateProfileContract,
  candidates: readonly CandidateSignal[],
  now: Date,
  limit = 3,
) {
  const profileSignals = candidateProfileSignals(profile, now);
  return candidates
    .filter(
      (candidate) =>
        !candidate.status || candidate.status.toLowerCase() === "open",
    )
    .map((candidate, index) => ({
      candidate,
      matchScore: computeMatchScore(profileSignals, candidate),
      index,
    }))
    .sort((left, right) => {
      if (right.matchScore !== left.matchScore)
        return right.matchScore - left.matchScore;
      const rightDate = right.candidate.postedAt ?? "";
      const leftDate = left.candidate.postedAt ?? "";
      return rightDate.localeCompare(leftDate) || left.index - right.index;
    })
    .slice(0, Math.max(0, limit));
}

function validationError(error: z.ZodError) {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "query";
    fieldErrors[key] = [
      ...new Set([...(fieldErrors[key] ?? []), issue.message]),
    ];
  }
  return new JobServiceError(400, {
    code: "JOB_SEARCH_INVALID",
    message: "Review the search criteria.",
    fieldErrors,
  });
}

export function parseJobSearchCriteria(raw: unknown): NormalizedJobSearch {
  const parsed = jobSearchQuerySchema.parse(raw);
  return {
    normalizedQuery: normalizeSearchText(parsed.q),
    searchBy: parsed.searchBy,
    normalizedLocation: normalizeSearchText(parsed.location, 160),
    normalizedSkills: parsed.skills.map((skill) =>
      normalizeSearchText(skill, 80),
    ),
    employmentType: parsed.employmentType,
    experienceLevel: parsed.experienceLevel,
    workArrangement: parsed.workArrangement,
    salaryMin: parsed.salaryMin,
    salaryMax: parsed.salaryMax,
    salaryCurrency: parsed.salaryCurrency,
    salaryPeriod: parsed.salaryPeriod,
    postedWithinDays: parsed.postedWithinDays,
    sort: parsed.sort,
    cursor: parsed.cursor
      ? decodeJobCursor(parsed.cursor, parsed.sort)
      : undefined,
    limit: parsed.limit,
  };
}

function salary(row: PublicJobRow): JobCard["salary"] {
  if (
    row.salaryMin === null ||
    row.salaryMax === null ||
    row.salaryCurrency === null ||
    row.salaryPeriod === null
  )
    return null;
  return {
    minimum: Number(row.salaryMin),
    maximum: Number(row.salaryMax),
    currency: row.salaryCurrency,
    period: row.salaryPeriod,
  };
}

function similarityInput(row: PublicJobRow): JobSimilarityInput {
  // The Prisma projection currently exposes normalized skill/location fields.
  // Keep the adapter tolerant of richer API/mock projections so categoryIds,
  // categoryFamily, skillTags, and location.city can participate whenever
  // those signals are available without weakening the repository contract.
  const signals = row as unknown as {
    categoryIds?: unknown;
    categoryFamily?: unknown;
    skillTags?: unknown;
    location?: unknown;
  };
  const skillTags = Array.isArray(signals.skillTags)
    ? signals.skillTags.filter(
        (skill): skill is string => typeof skill === "string",
      )
    : row.skills.map((skill) => skill.displayName);
  const location =
    signals.location && typeof signals.location === "object"
      ? (signals.location as { city?: unknown }).city
      : signals.location;

  return {
    id: row.id,
    title: row.title,
    companyId: row.companyId,
    industry: row.company.industry ?? undefined,
    status: row.status === "ACTIVE" ? "open" : row.status.toLowerCase(),
    categoryIds: Array.isArray(signals.categoryIds)
      ? signals.categoryIds.filter(
          (category): category is string => typeof category === "string",
        )
      : undefined,
    categoryFamily:
      typeof signals.categoryFamily === "string"
        ? signals.categoryFamily
        : undefined,
    skillTags,
    city: typeof location === "string" ? location : row.location,
    salaryMin: row.salaryMin === null ? null : Number(row.salaryMin),
    salaryMax: row.salaryMax === null ? null : Number(row.salaryMax),
    experienceMinYears: experienceYears[row.experienceLevel] ?? null,
    postedAt: row.publishedAt?.toISOString(),
  };
}

function textBullets(value: string | null, maximum = 4) {
  return (value ?? "")
    .split(/\r?\n+/u)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maximum);
}
function card(
  row: PublicJobRow,
  actor: JobActor,
  now: Date,
  matchScore?: number,
): JobCard {
  const signals = row as unknown as {
    categoryIds?: unknown;
    categoryFamily?: unknown;
  };
  const authenticated = actor.kind === "user";
  const urgent =
    row.applicationDeadline !== null &&
    row.applicationDeadline.getTime() - now.getTime() <= 14 * 86_400_000 &&
    row.applicationDeadline > now;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    company: {
      ...row.company,
      size: row.company.size ?? undefined,
      industry: row.company.industry ?? undefined,
      address: row.company.address ?? undefined,
    },
    location: row.location,
    employmentType: row.employmentType,
    experienceLevel: row.experienceLevel,
    workArrangement: row.workArrangement,
    salary: salary(row),
    summary: row.summary,
    education: row.education ?? undefined,
    numberOfHires: row.numberOfHires ?? undefined,
    age: row.age ?? undefined,
    skills: row.skills.map((skill) => skill.displayName),
    requirementHighlights: textBullets(row.requirements),
    benefitHighlights: textBullets(row.benefits),
    benefitItems: textBullets(row.benefits).map((label) => ({
      icon: "spark",
      label,
    })),
    publishedAt: row.publishedAt!.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    applicationDeadline: row.applicationDeadline?.toISOString() ?? null,
    isUrgent: urgent,
    workOnSaturday: false,
    isVerified: true,
    categoryIds: Array.isArray(signals.categoryIds)
      ? signals.categoryIds.filter(
          (category): category is string => typeof category === "string",
        )
      : undefined,
    categoryFamily:
      typeof signals.categoryFamily === "string"
        ? signals.categoryFamily
        : undefined,
    experienceMinYears: experienceYears[row.experienceLevel] ?? undefined,
    matchScore,
    actions: {
      authenticated,
      saved: row.savedBy.length > 0,
      applied: row.applications.length > 0,
      canSave: authenticated,
      canReport: authenticated,
      canApply: true,
    },
  };
}

export function projectPublicJobState(
  status: "ACTIVE" | "CLOSED" | "EXPIRED",
  applicationDeadline: Date | null,
  now: Date,
): PublicJobState {
  if (applicationDeadline && applicationDeadline <= now) return "EXPIRED";
  return status;
}

export class JobDiscoveryService {
  constructor(
    private readonly repository?: PublicJobRepository,
    private readonly profileService = new GetProfileAggregateService(),
  ) {}

  async search(raw: unknown, actor: JobActor, now = new Date()) {
    let criteria: NormalizedJobSearch;
    try {
      criteria = parseJobSearchCriteria(raw);
    } catch (error) {
      if (error instanceof z.ZodError) throw validationError(error);
      if (error instanceof JobServiceError) throw error;
      throw new JobServiceError(400, {
        code: "JOB_SEARCH_INVALID",
        message: "Review the search criteria.",
      });
    }
    const repository =
      this.repository ??
      new (
        await import("@/backend/repositories/jobs/prisma-public-job-repository")
      ).PrismaPublicJobRepository();
    const result = await repository.search(
      criteria,
      actor.kind === "user" ? actor.userId : null,
      now,
    );
    return {
      items: result.rows.map((row) => card(row, actor, now)),
      total: result.total,
      nextCursor: result.nextCursor,
      criteria: {
        q: criteria.normalizedQuery,
        searchBy: criteria.searchBy,
        location: criteria.normalizedLocation,
        employmentType: criteria.employmentType,
        experienceLevel: criteria.experienceLevel,
        workArrangement: criteria.workArrangement,
        skills: criteria.normalizedSkills,
        salaryMin: criteria.salaryMin,
        salaryMax: criteria.salaryMax,
        salaryCurrency: criteria.salaryCurrency,
        salaryPeriod: criteria.salaryPeriod,
        postedWithinDays: criteria.postedWithinDays,
        sort: criteria.sort,
        limit: criteria.limit,
      },
    };
  }

  async detail(
    rawSlug: unknown,
    actor: JobActor,
    now = new Date(),
    canonicalOrigin = "http://localhost:3001",
  ) {
    const slug = z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)
      .max(220)
      .parse(rawSlug);
    const repository =
      this.repository ??
      new (
        await import("@/backend/repositories/jobs/prisma-public-job-repository")
      ).PrismaPublicJobRepository();
    const row = await repository.findPublicBySlug(
      slug,
      actor.kind === "user" ? actor.userId : null,
      now,
    );
    if (!row) {
      throw new JobServiceError(404, {
        code: "JOB_UNAVAILABLE",
        message: "This job is not available.",
      });
    }
    const state = projectPublicJobState(
      row.status === "CLOSED"
        ? "CLOSED"
        : row.status === "EXPIRED"
          ? "EXPIRED"
          : "ACTIVE",
      row.applicationDeadline,
      now,
    );
    const summary = card(row, actor, now);
    const relatedCandidateRows = repository.findPublicRelatedCandidates
      ? await repository.findPublicRelatedCandidates(
          row.id,
          actor.kind === "user" ? actor.userId : null,
          now,
        )
      : [];
    const discoveryCandidateRows = repository.findPublicDiscoveryCandidates
      ? await repository.findPublicDiscoveryCandidates(
          row.id,
          actor.kind === "user" ? actor.userId : null,
          now,
        )
      : relatedCandidateRows;
    const candidateSignals: CandidateSignal[] = relatedCandidateRows.map(
      (candidate) => ({
        ...similarityInput(candidate),
        row: candidate,
      }),
    );
    const discoveryCandidateSignals: CandidateSignal[] =
      discoveryCandidateRows.map((candidate) => ({
        ...similarityInput(candidate),
        row: candidate,
      }));
    const currentSignals = similarityInput(row);
    const relatedJobs = computeRelatedJobs(
      currentSignals,
      candidateSignals,
      6,
    ).map(({ row: candidate, matchScore }) =>
      card(candidate, actor, now, matchScore),
    );
    const relatedJobIds = new Set(relatedJobs.map((item) => item.id));
    const discoveryRanked = computeDiscoveryJobs(
      currentSignals,
      discoveryCandidateSignals,
      relatedJobIds,
      5,
    );
    let recommendedJobs = discoveryRanked.map(
      ({ row: candidate, matchScore }) =>
        card(candidate, actor, now, matchScore),
    );
    if (actor.kind === "user") {
      try {
        const profile = await this.profileService.execute(actor.userId);
        const personalized = rankForCandidateProfile(
          profile,
          discoveryCandidateSignals.filter(
            (candidate) => !relatedJobIds.has(candidate.id),
          ),
          now,
          5,
        );
        if (personalized.length) {
          recommendedJobs = personalized.map(({ candidate, matchScore }) =>
            card(candidate.row, actor, now, matchScore),
          );
        }
      } catch {
        // A missing or temporarily unavailable profile should not break the
        // detail page; broad discovery recommendations remain available.
      }
    }

    return {
      ...summary,
      actions: {
        ...summary.actions,
        canApply: state === "ACTIVE" && !summary.actions.applied,
      },
      state,
      description: row.description,
      responsibilities: row.responsibilities,
      requirements: row.requirements,
      benefits: row.benefits,
      canonicalUrl: new URL("/jobs/" + row.slug, canonicalOrigin).toString(),
      relatedJobs,
      recommendedJobs,
    };
  }
}
