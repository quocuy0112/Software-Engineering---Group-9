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

function card(row: PublicJobRow, actor: JobActor): JobCard {
  const authenticated = actor.kind === "user";
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    company: row.company,
    location: row.location,
    employmentType: row.employmentType,
    experienceLevel: row.experienceLevel,
    workArrangement: row.workArrangement,
    salary: salary(row),
    summary: row.summary,
    skills: row.skills.map((skill) => skill.displayName),
    publishedAt: row.publishedAt!.toISOString(),
    applicationDeadline: row.applicationDeadline?.toISOString() ?? null,
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
  constructor(private readonly repository?: PublicJobRepository) {}

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
      items: result.rows.map((row) => card(row, actor)),
      total: result.total,
      nextCursor: result.nextCursor,
      criteria: {
        q: criteria.normalizedQuery,
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
    const summary = card(row, actor);
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
      canonicalUrl: new URL(`/jobs/${row.slug}`, canonicalOrigin).toString(),
    };
  }
}
