import "server-only";
import { Prisma } from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";
import type {
  NormalizedJobSearch,
  PublicJobState,
} from "@/backend/services/jobs/job-types";
import { encodeJobCursor } from "@/backend/services/jobs/search-normalization";
import { careerPathSearchTerms } from "@/shared/contracts/jobs/career-paths";

const publicInclude = (actorUserId: string | null) =>
  ({
    company: {
      select: {
        slug: true,
        displayName: true,
        logoUrl: true,
        websiteUrl: true,
        publicDescription: true,
        publicLocation: true,
        size: true,
        industry: true,
        address: true,
      },
    },
    skills: {
      orderBy: { position: "asc" as const },
      select: { displayName: true },
    },
    savedBy: actorUserId
      ? { where: { userId: actorUserId }, select: { userId: true }, take: 1 }
      : { where: { userId: "__visitor__" }, select: { userId: true }, take: 0 },
    applications: actorUserId
      ? {
          where: { candidateUserId: actorUserId },
          select: { id: true, stage: true },
          take: 1,
        }
      : {
          where: { candidateUserId: "__visitor__" },
          select: { id: true, stage: true },
          take: 0,
        },
  }) as const;

export type PublicJobRow = Prisma.JobPostingGetPayload<{
  include: ReturnType<typeof publicInclude>;
}> & { score: number };

type RankedRow = {
  id: string;
  score: number;
  publishedAt: Date;
  salaryMaximum: string | null;
};

export interface PublicJobRepository {
  search(
    input: NormalizedJobSearch,
    actorUserId: string | null,
    now: Date,
  ): Promise<{
    rows: PublicJobRow[];
    total: number;
    nextCursor: string | null;
  }>;
  findPublicBySlug(
    slug: string,
    actorUserId: string | null,
    now: Date,
  ): Promise<PublicJobRow | null>;
  findPublicRelatedCandidates?(
    jobId: string,
    actorUserId: string | null,
    now: Date,
  ): Promise<PublicJobRow[]>;
  findPublicDiscoveryCandidates?(
    jobId: string,
    actorUserId: string | null,
    now: Date,
  ): Promise<PublicJobRow[]>;
  findPublicActionTarget(
    jobId: string,
    now: Date,
  ): Promise<{
    id: string;
    state: PublicJobState;
    acceptsApplications: boolean;
  } | null>;
}

function publicClauses(input: NormalizedJobSearch, now: Date) {
  const clauses: Prisma.Sql[] = [
    Prisma.sql`j."status" = 'ACTIVE'::"JobPostingStatus"`,
    Prisma.sql`j."approvedAt" IS NOT NULL`,
    Prisma.sql`j."publishedAt" IS NOT NULL AND j."publishedAt" <= ${now}`,
    Prisma.sql`(j."applicationDeadline" IS NULL OR j."applicationDeadline" > ${now})`,
    Prisma.sql`EXISTS (SELECT 1 FROM "Company" c WHERE c."id" = j."companyId" AND c."verifiedAt" IS NOT NULL)`,
  ];
  for (const token of input.normalizedQuery.split(" ").filter(Boolean)) {
    if (input.searchBy === "TITLE") {
      clauses.push(Prisma.sql`j."normalizedTitle" LIKE ${`%${token}%`}`);
    } else if (input.searchBy === "COMPANY") {
      clauses.push(Prisma.sql`EXISTS (
        SELECT 1 FROM "Company" c
        WHERE c."id" = j."companyId"
          AND (lower(c."displayName") LIKE ${`%${token}%`} OR lower(c."legalName") LIKE ${`%${token}%`})
      )`);
    } else {
      clauses.push(
        Prisma.sql`j."searchDocumentNormalized" LIKE ${`%${token}%`}`,
      );
    }
  }
  if (input.normalizedLocation) {
    clauses.push(
      Prisma.sql`j."normalizedLocation" LIKE ${`%${input.normalizedLocation}%`}`,
    );
  }
  if (input.employmentType.length) {
    clauses.push(
      Prisma.sql`j."employmentType"::text IN (${Prisma.join(input.employmentType)})`,
    );
  }
  if (input.experienceLevel.length) {
    clauses.push(
      Prisma.sql`j."experienceLevel"::text IN (${Prisma.join(input.experienceLevel)})`,
    );
  }
  if (input.workArrangement.length) {
    clauses.push(
      Prisma.sql`j."workArrangement"::text IN (${Prisma.join(input.workArrangement)})`,
    );
  }
  if (input.careerPath) {
    const terms = careerPathSearchTerms[input.careerPath];
    clauses.push(
      Prisma.sql`(${Prisma.join(
        terms.map(
          (term) =>
            Prisma.sql`j."searchDocumentNormalized" LIKE ${`%${term}%`}`,
        ),
        " OR ",
      )})`,
    );
  }
  for (const skill of input.normalizedSkills) {
    clauses.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "JobPostingSkill" js
      JOIN "Skill" s ON s."id" = js."skillId"
      WHERE js."jobPostingId" = j."id" AND s."normalizedName" = ${skill}
    )`);
  }
  if (input.salaryMin !== undefined || input.salaryMax !== undefined) {
    clauses.push(
      Prisma.sql`j."salaryCurrency" = ${input.salaryCurrency} AND j."salaryPeriod"::text = ${input.salaryPeriod}`,
    );
    if (input.salaryMin !== undefined) {
      clauses.push(Prisma.sql`j."salaryMax" >= ${input.salaryMin}`);
    }
    if (input.salaryMax !== undefined) {
      clauses.push(Prisma.sql`j."salaryMin" <= ${input.salaryMax}`);
    }
  }
  if (input.postedWithinDays !== undefined) {
    const cutoff = new Date(
      now.getTime() - input.postedWithinDays * 86_400_000,
    );
    clauses.push(Prisma.sql`j."publishedAt" >= ${cutoff}`);
  }
  return clauses;
}

function cursorClause(
  input: NormalizedJobSearch,
  scoreExpression: Prisma.Sql,
): Prisma.Sql | null {
  const cursor = input.cursor;
  if (!cursor) return null;
  const publishedAt = new Date(cursor.publishedAt);
  if (input.sort === "RELEVANCE") {
    return Prisma.sql`(
      ${scoreExpression} < ${cursor.score ?? 0} OR
      (${scoreExpression} = ${cursor.score ?? 0} AND (j."publishedAt" < ${publishedAt} OR
        (j."publishedAt" = ${publishedAt} AND j."id" > ${cursor.id})))
    )`;
  }
  if (input.sort === "SALARY_DESC") {
    return cursor.salaryMaximum === null
      ? Prisma.sql`(j."salaryMax" IS NULL AND (j."publishedAt" < ${publishedAt} OR (j."publishedAt" = ${publishedAt} AND j."id" > ${cursor.id})))`
      : Prisma.sql`(
          j."salaryMax" < ${cursor.salaryMaximum}::decimal OR j."salaryMax" IS NULL OR
          (j."salaryMax" = ${cursor.salaryMaximum}::decimal AND
            (j."publishedAt" < ${publishedAt} OR (j."publishedAt" = ${publishedAt} AND j."id" > ${cursor.id})))
        )`;
  }
  return Prisma.sql`(j."publishedAt" < ${publishedAt} OR (j."publishedAt" = ${publishedAt} AND j."id" > ${cursor.id}))`;
}

export class PrismaPublicJobRepository implements PublicJobRepository {
  async search(
    input: NormalizedJobSearch,
    actorUserId: string | null,
    now: Date,
  ) {
    const clauses = publicClauses(input, now);
    const query = input.normalizedQuery;
    const score = query
      ? Prisma.sql`(similarity(j."normalizedTitle", ${query}) * 3 + similarity(j."searchDocumentNormalized", ${query}))`
      : Prisma.sql`0::double precision`;
    const cursor = cursorClause(input, score);
    const offset = cursor
      ? Prisma.empty
      : Prisma.sql`OFFSET ${((input.page ?? 1) - 1) * input.limit}`;
    const where = Prisma.join(clauses, " AND ");
    const order =
      input.sort === "SALARY_DESC"
        ? Prisma.sql`j."salaryMax" DESC NULLS LAST, j."publishedAt" DESC, j."id" ASC`
        : input.sort === "NEWEST"
          ? Prisma.sql`j."publishedAt" DESC, j."id" ASC`
          : Prisma.sql`score DESC, j."publishedAt" DESC, j."id" ASC`;

    const [ranked, counts] = await Promise.all([
      prisma.$queryRaw<RankedRow[]>(Prisma.sql`
        SELECT j."id", ${score} AS score, j."publishedAt" AS "publishedAt",
               j."salaryMax"::text AS "salaryMaximum"
        FROM "JobPosting" j
        WHERE ${where} ${cursor ? Prisma.sql`AND ${cursor}` : Prisma.empty}
        ORDER BY ${order}
        LIMIT ${input.limit + 1}
        ${offset}
      `),
      prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS count FROM "JobPosting" j WHERE ${where}
      `),
    ]);
    const hasMore = ranked.length > input.limit;
    const page = ranked.slice(0, input.limit);
    const entities = await prisma.jobPosting.findMany({
      where: { id: { in: page.map((row) => row.id) } },
      include: publicInclude(actorUserId),
    });
    const byId = new Map(entities.map((entity) => [entity.id, entity]));
    const rows = page
      .map((rank) => {
        const entity = byId.get(rank.id);
        return entity
          ? ({ ...entity, score: Number(rank.score) } as PublicJobRow)
          : null;
      })
      .filter((row): row is PublicJobRow => row !== null);
    const last = hasMore ? page.at(-1) : undefined;
    return {
      rows,
      total: counts[0]?.count ?? 0,
      nextCursor: last
        ? encodeJobCursor({
            v: 1,
            sort: input.sort,
            score: input.sort === "RELEVANCE" ? Number(last.score) : undefined,
            salaryMaximum:
              input.sort === "SALARY_DESC" ? last.salaryMaximum : undefined,
            publishedAt: new Date(last.publishedAt).toISOString(),
            id: last.id,
          })
        : null,
    };
  }

  async findPublicBySlug(slug: string, actorUserId: string | null, now: Date) {
    const row = await prisma.jobPosting.findFirst({
      where: {
        slug,
        status: { in: ["ACTIVE", "CLOSED", "EXPIRED"] },
        approvedAt: { not: null },
        publishedAt: { not: null, lte: now },
        company: { verifiedAt: { not: null } },
      },
      include: publicInclude(actorUserId),
    });
    return row ? ({ ...row, score: 0 } as PublicJobRow) : null;
  }

  async findPublicRelatedCandidates(
    jobId: string,
    actorUserId: string | null,
    now: Date,
  ) {
    const rows = await prisma.jobPosting.findMany({
      where: {
        id: { not: jobId },
        status: "ACTIVE",
        approvedAt: { not: null },
        publishedAt: { not: null, lte: now },
        OR: [
          { applicationDeadline: null },
          { applicationDeadline: { gt: now } },
        ],
        company: { verifiedAt: { not: null } },
      },
      take: 100,
      include: publicInclude(actorUserId),
    });
    return rows.map((row) => ({ ...row, score: 0 }) as PublicJobRow);
  }
  async findPublicDiscoveryCandidates(
    jobId: string,
    actorUserId: string | null,
    now: Date,
  ) {
    const rows = await prisma.jobPosting.findMany({
      where: {
        id: { not: jobId },
        status: "ACTIVE",
        approvedAt: { not: null },
        publishedAt: { not: null, lte: now },
        OR: [
          { applicationDeadline: null },
          { applicationDeadline: { gt: now } },
        ],
        company: { verifiedAt: { not: null } },
      },
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      take: 160,
      include: publicInclude(actorUserId),
    });
    return rows.map((row) => ({ ...row, score: 0 }) as PublicJobRow);
  }

  async findPublicActionTarget(jobId: string, now: Date) {
    const row = await prisma.jobPosting.findFirst({
      where: {
        id: jobId,
        status: { in: ["ACTIVE", "CLOSED", "EXPIRED"] },
        approvedAt: { not: null },
        publishedAt: { not: null, lte: now },
        company: { verifiedAt: { not: null } },
      },
      select: { id: true, status: true, applicationDeadline: true },
    });
    if (!row) return null;
    const expired = Boolean(
      row.applicationDeadline && row.applicationDeadline <= now,
    );
    const state: PublicJobState = expired
      ? "EXPIRED"
      : row.status === "ACTIVE"
        ? "ACTIVE"
        : row.status === "CLOSED"
          ? "CLOSED"
          : "EXPIRED";
    return { id: row.id, state, acceptsApplications: state === "ACTIVE" };
  }
}
