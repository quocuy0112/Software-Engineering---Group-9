import "server-only";

import { prisma } from "@/backend/database/prisma";
import type { Prisma } from "@/backend/generated/prisma/client";
import {
  canonicalAnalyticsStages,
  type AnalyticsGrouping,
  type CanonicalAnalyticsStage,
} from "@/shared/contracts/analytics";
import type { NormalizedReportRange } from "@/backend/analytics/report-time-policy";

type Database = typeof prisma | Prisma.TransactionClient;
type BucketAggregate = {
  bucketKey: string;
  count: bigint | number;
  distinctCandidates?: bigint | number;
  hired?: bigint | number;
};
type FunnelAggregate = {
  stage: string;
  count: bigint | number;
  totalCount: bigint | number;
  withdrawnCount: bigint | number;
};
type LifecycleRow = {
  jobPostingId: string;
  effectiveAt: Date;
  postingVersion: number;
  toStatus: string;
};
export type ExportDatabaseRow = {
  id: string;
  contactSnapshot: unknown;
  stage: string;
  submittedAt: Date;
  finalScore: string | number | null;
  scoringState: string | null;
};

function numberValue(value: bigint | number | null | undefined) {
  return Number(value ?? 0);
}

function dateParts(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const result = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return { year: result.year, month: result.month, day: result.day };
}

function bucketKey(value: Date, timeZone: string, grouping: AnalyticsGrouping) {
  const local = dateParts(value, timeZone);
  const date = new Date(Date.UTC(local.year, local.month - 1, local.day));
  if (grouping === "WEEK") {
    const weekday = date.getUTCDay();
    date.setUTCDate(date.getUTCDate() + (weekday === 0 ? -6 : 1 - weekday));
    return date.toISOString().slice(0, 10);
  }
  if (grouping === "MONTH") {
    return (
      String(local.year).padStart(4, "0") +
      "-" +
      String(local.month).padStart(2, "0") +
      "-01"
    );
  }
  return date.toISOString().slice(0, 10);
}

function bucketUnit(grouping: AnalyticsGrouping) {
  if (grouping === "WEEK") return "week";
  if (grouping === "MONTH") return "month";
  return "day";
}

function safeStage(value: string): CanonicalAnalyticsStage | null {
  return (canonicalAnalyticsStages as readonly string[]).includes(value)
    ? (value as CanonicalAnalyticsStage)
    : null;
}

export type AdminGrowthRepositoryResult = Readonly<{
  newRegistrations: number;
  submittedApplications: number;
  distinctSubmittingCandidates: number;
  hiredApplications: number;
  activePostingsAtEnd: number;
}>;

export type JobPerformanceRepositoryResult = Readonly<{
  qualifiedViews: number;
  submittedApplications: number;
  withdrawnApplications: number;
  funnelCounts: Partial<Record<CanonicalAnalyticsStage, number>>;
}>;

export class PrismaAnalyticsRepository {
  constructor(private readonly db: Database = prisma) {}

  async analyticsAvailableFrom() {
    const first = await this.db.jobPostingLifecycleFact.findFirst({
      orderBy: [{ effectiveAt: "asc" }, { id: "asc" }],
      select: { effectiveAt: true },
    });
    return first?.effectiveAt ?? new Date();
  }

  async adminGrowth(
    range: NormalizedReportRange,
  ): Promise<ReadonlyMap<string, AdminGrowthRepositoryResult>> {
    const unit = bucketUnit(range.grouping);
    const sqlQuote = String.fromCharCode(39);
    const registrationExpression =
      "to_char(date_trunc(" +
      sqlQuote +
      unit +
      sqlQuote +
      ', "createdAt" AT TIME ZONE $3), ' +
      sqlQuote +
      "YYYY-MM-DD" +
      sqlQuote +
      ")";
    const applicationExpression =
      "to_char(date_trunc(" +
      sqlQuote +
      unit +
      sqlQuote +
      ', a."submittedAt" AT TIME ZONE $3), ' +
      sqlQuote +
      "YYYY-MM-DD" +
      sqlQuote +
      ")";
    const cutoff = range.dataCutoff;

    const [registrations, applications, lifecycle] = await Promise.all([
      this.db.$queryRawUnsafe<BucketAggregate[]>(
        "SELECT " +
          registrationExpression +
          ' AS "bucketKey", COUNT(*) AS "count" ' +
          'FROM "user" WHERE "createdAt" >= $1 AND "createdAt" < $2 AND "deletedAt" IS NULL GROUP BY 1',
        range.from,
        cutoff,
        range.timeZone,
      ),
      this.db.$queryRawUnsafe<BucketAggregate[]>(
        'WITH included_applications AS (SELECT * FROM "JobApplication" WHERE "submittedAt" >= $1 AND "submittedAt" < $2 AND "documentDeletedAt" IS NULL), latest_stage AS (' +
          'SELECT DISTINCT ON (e."applicationId") e."applicationId", e."toStage" FROM "ApplicationStageEvent" e JOIN included_applications ia ON ia."id" = e."applicationId" ' +
          'WHERE e."occurredAt" <= $2 ORDER BY e."applicationId", e."occurredAt" DESC, e."id" DESC) ' +
          "SELECT " +
          applicationExpression +
          ' AS "bucketKey", COUNT(*) AS "count", ' +
          'COUNT(DISTINCT a."candidateUserId") AS "distinctCandidates", ' +
          "COUNT(*) FILTER (WHERE COALESCE(ls." +
          '"toStage"::text, a."stage"::text) = ' +
          sqlQuote +
          "HIRED" +
          sqlQuote +
          ') AS "hired" ' +
          'FROM included_applications a LEFT JOIN latest_stage ls ON ls."applicationId" = a."id" GROUP BY 1',
        range.from,
        cutoff,
        range.timeZone,
      ),
      this.db.jobPostingLifecycleFact.findMany({
        where: { effectiveAt: { lte: cutoff } },
        orderBy: [
          { effectiveAt: "asc" },
          { postingVersion: "asc" },
          { id: "asc" },
        ],
        select: {
          jobPostingId: true,
          effectiveAt: true,
          postingVersion: true,
          toStatus: true,
        },
      }),
    ]);

    const registrationMap = new Map(
      registrations.map((row) => [row.bucketKey, numberValue(row.count)]),
    );
    const applicationMap = new Map(
      applications.map((row) => [
        row.bucketKey,
        {
          submittedApplications: numberValue(row.count),
          distinctSubmittingCandidates: numberValue(row.distinctCandidates),
          hiredApplications: numberValue(row.hired),
        },
      ]),
    );
    const statuses = new Map<string, string>();
    const lifecycleRows = lifecycle as LifecycleRow[];
    let lifecycleIndex = 0;
    let activeCount = 0;
    const result = new Map<string, AdminGrowthRepositoryResult>();
    for (const bucket of range.buckets) {
      const boundary = bucket.end < cutoff ? bucket.end : cutoff;
      while (
        lifecycleIndex < lifecycleRows.length &&
        lifecycleRows[lifecycleIndex].effectiveAt <= boundary
      ) {
        const row = lifecycleRows[lifecycleIndex];
        if (statuses.get(row.jobPostingId) === "ACTIVE") activeCount -= 1;
        statuses.set(row.jobPostingId, row.toStatus);
        if (row.toStatus === "ACTIVE") activeCount += 1;
        lifecycleIndex += 1;
      }
      const key = bucketKey(bucket.start, range.timeZone, range.grouping);
      const apps = applicationMap.get(key);
      result.set(bucket.start.toISOString(), {
        newRegistrations: registrationMap.get(key) ?? 0,
        submittedApplications: apps?.submittedApplications ?? 0,
        distinctSubmittingCandidates: apps?.distinctSubmittingCandidates ?? 0,
        hiredApplications: apps?.hiredApplications ?? 0,
        activePostingsAtEnd: activeCount,
      });
    }
    return result;
  }

  async jobPerformance(input: {
    jobPostingId: string;
    from: Date;
    to: Date;
    dataCutoff: Date;
  }): Promise<JobPerformanceRepositoryResult> {
    const cutoff = input.to < input.dataCutoff ? input.to : input.dataCutoff;
    const [views, applications] = await Promise.all([
      this.db.jobPostingViewFact.count({
        where: {
          jobPostingId: input.jobPostingId,
          qualification: "QUALIFIED",
          occurredAt: { gte: input.from, lt: cutoff },
        },
      }),
      this.db.$queryRawUnsafe<FunnelAggregate[]>(
        'WITH included_applications AS (SELECT * FROM "JobApplication" WHERE "jobPostingId" = $1 AND "submittedAt" >= $2 AND "submittedAt" < $3 AND "documentDeletedAt" IS NULL), latest_stage AS (' +
          'SELECT DISTINCT ON (e."applicationId") e."applicationId", e."toStage" FROM "ApplicationStageEvent" e JOIN included_applications ia ON ia."id" = e."applicationId" ' +
          'WHERE e."occurredAt" <= $3 ORDER BY e."applicationId", e."occurredAt" DESC, e."id" DESC) ' +
          'SELECT COALESCE(ls."toStage"::text, a."stage"::text) AS "stage", ' +
          'COUNT(*) FILTER (WHERE a."withdrawnAt" IS NULL OR a."withdrawnAt" > $3) AS "count", ' +
          'COUNT(*) AS "totalCount", ' +
          'COUNT(*) FILTER (WHERE a."withdrawnAt" IS NOT NULL AND a."withdrawnAt" <= $3) AS "withdrawnCount" ' +
          'FROM included_applications a LEFT JOIN latest_stage ls ON ls."applicationId" = a."id" GROUP BY 1',
        input.jobPostingId,
        input.from,
        cutoff,
      ),
    ]);
    const funnelCounts: Partial<Record<CanonicalAnalyticsStage, number>> = {};
    let submittedApplications = 0;
    let withdrawnApplications = 0;
    for (const row of applications) {
      submittedApplications += numberValue(row.totalCount);
      withdrawnApplications += numberValue(row.withdrawnCount);
      const stage = safeStage(row.stage);
      if (stage) funnelCounts[stage] = numberValue(row.count);
    }
    return {
      qualifiedViews: views,
      submittedApplications,
      withdrawnApplications,
      funnelCounts,
    };
  }

  async listCandidateExportRows(input: {
    jobPostingId: string;
    dataCutoff: Date;
    afterId?: string;
    limit: number;
  }): Promise<ExportDatabaseRow[]> {
    return this.db.$queryRawUnsafe<ExportDatabaseRow[]>(
      'SELECT a."id", a."contactSnapshot", COALESCE(stage_at_cutoff."toStage"::text, a."stage"::text) AS "stage", a."submittedAt", ' +
        's."finalScore"::text AS "finalScore", s."state"::text AS "scoringState" ' +
        'FROM "JobApplication" a LEFT JOIN LATERAL (' +
        'SELECT e."toStage" FROM "ApplicationStageEvent" e WHERE e."applicationId" = a."id" AND e."occurredAt" <= $2 ORDER BY e."occurredAt" DESC, e."id" DESC LIMIT 1) stage_at_cutoff ON TRUE ' +
        "LEFT JOIN LATERAL (" +
        'SELECT r."finalScore", r."state" FROM "ApplicationScoringResult" r ' +
        'WHERE r."jobApplicationId" = a."id" AND r."publishedAt" <= $2 ' +
        'AND (r."supersededAt" IS NULL OR r."supersededAt" > $2) ' +
        'ORDER BY r."publishedAt" DESC, r."generation" DESC LIMIT 1) s ON TRUE ' +
        'WHERE a."jobPostingId" = $1 AND a."submittedAt" <= $2 AND a."documentDeletedAt" IS NULL ' +
        'AND ($3::text IS NULL OR a."id" > $3) ORDER BY a."id" ASC LIMIT $4',
      input.jobPostingId,
      input.dataCutoff,
      input.afterId ?? null,
      input.limit,
    );
  }
}

export async function appendJobPostingLifecycleFact(
  tx: Prisma.TransactionClient,
  input: {
    jobPostingId: string;
    companyId: string;
    fromStatus: string | null;
    toStatus: string;
    effectiveAt: Date;
    postingVersion: number;
    actorUserId?: string | null;
    correlationId: string;
  },
) {
  try {
    await tx.jobPostingLifecycleFact.create({
      data: {
        jobPostingId: input.jobPostingId,
        companyId: input.companyId,
        fromStatus: input.fromStatus as never,
        toStatus: input.toStatus as never,
        effectiveAt: input.effectiveAt,
        postingVersion: input.postingVersion,
        actorUserId: input.actorUserId ?? null,
        correlationId: input.correlationId,
      },
    });
  } catch (error) {
    if (
      !error ||
      typeof error !== "object" ||
      !("code" in error) ||
      error.code !== "P2002"
    ) {
      throw error;
    }
  }
}
