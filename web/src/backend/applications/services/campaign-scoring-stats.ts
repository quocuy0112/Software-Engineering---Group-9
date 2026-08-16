import "server-only";

import { Prisma } from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";
import {
  campaignScoringStatsResponseSchema,
  type CampaignScoringStats,
} from "@/shared/contracts/scoring";
import { RecruiterApplicationAuthorization } from "../authorization/recruiter-application-authorization";

function emptyStats(): CampaignScoringStats {
  return { total: 0, strong: 0, review: 0, low: 0, processing: 0 };
}

export class CampaignScoringStatsService {
  constructor(
    private readonly db: typeof prisma = prisma,
    private readonly authorization = new RecruiterApplicationAuthorization(db),
  ) {}

  async execute(input: { userId: string; jobIds: string[] }) {
    const requestedJobIds = [
      ...new Set(input.jobIds.map((jobId) => jobId.trim()).filter(Boolean)),
    ].slice(0, 100);

    if (requestedJobIds.length === 0) {
      return campaignScoringStatsResponseSchema.parse({ stats: {} });
    }

    const authorizationResults = await this.authorization.authorizeJobs(
      input.userId,
      requestedJobIds,
    );
    const authorizedJobIdSet = new Set(
      authorizationResults
        .filter((result) => result.authorized)
        .map((result) => result.jobId),
    );
    const authorizedJobIds = requestedJobIds.filter((jobId) =>
      authorizedJobIdSet.has(jobId),
    );
    const stats = Object.fromEntries(
      authorizedJobIds.map((jobId) => [jobId, emptyStats()]),
    ) as Record<string, CampaignScoringStats>;

    if (authorizedJobIds.length === 0) {
      return campaignScoringStatsResponseSchema.parse({ stats });
    }

    const rows = await this.db.$queryRaw<
      Array<{
        jobPostingId: string;
        total: number | bigint;
        strong: number | bigint;
        review: number | bigint;
        low: number | bigint;
        processing: number | bigint;
      }>
    >(Prisma.sql`
      SELECT
        application."jobPostingId" AS "jobPostingId",
        COUNT(*)::int AS "total",
        COUNT(*) FILTER (
          WHERE result."state"::text = 'SCORED'
            AND result."finalScore" >= 80
        )::int AS "strong",
        COUNT(*) FILTER (
          WHERE result."state"::text = 'SCORED'
            AND result."finalScore" >= 60
            AND result."finalScore" < 80
        )::int AS "review",
        COUNT(*) FILTER (
          WHERE result."state"::text = 'SCORED'
            AND result."finalScore" < 60
        )::int AS "low",
        COUNT(*) FILTER (
          WHERE application."scoringStatus"::text = 'PENDING'
             OR (
               application."currentScoringResultId" IS NULL
               AND application."scoringStatus"::text <> 'NOT_REQUESTED'
             )
        )::int AS "processing"
      FROM "JobApplication" AS application
      INNER JOIN "CandidateIdentity" AS candidate
        ON candidate."userId" = application."candidateUserId"
      INNER JOIN "user" AS account
        ON account."id" = candidate."userId"
      LEFT JOIN "ApplicationScoringResult" AS result
        ON result."id" = application."currentScoringResultId"
      WHERE application."jobPostingId" IN (${Prisma.join(authorizedJobIds)})
        AND application."documentDeletedAt" IS NULL
        AND application."stage"::text <> 'REJECTED'
        AND account."emailVerified" = TRUE
      GROUP BY application."jobPostingId"
    `);

    for (const row of rows) {
      const current = stats[row.jobPostingId];
      if (!current) continue;

      current.total = Number(row.total);
      current.strong = Number(row.strong);
      current.review = Number(row.review);
      current.low = Number(row.low);
      current.processing = Number(row.processing);
    }

    return campaignScoringStatsResponseSchema.parse({ stats });
  }
}
