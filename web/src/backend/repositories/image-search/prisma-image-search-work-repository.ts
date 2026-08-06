import "server-only";

import { prisma } from "@/backend/database/prisma";

export type ImageSearchWorkStage = "SCAN" | "DECODE" | "OCR" | "INTERPRET";

export type ImageSearchWorkClaim = Readonly<{
  stage: ImageSearchWorkStage;
  id: string;
  queryId: string;
  leaseOwner: string;
  leaseExpiresAt: Date;
  attemptNumber: number;
}>;

type RawClaim = Readonly<{
  id: string;
  queryId: string;
  attemptNumber: number;
}>;

export class PrismaImageSearchWorkRepository {
  async claimStage(input: {
    stage: ImageSearchWorkStage;
    owner: string;
    now: Date;
    leaseMs: number;
    limit: number;
  }): Promise<ImageSearchWorkClaim[]> {
    const leaseExpiresAt = new Date(input.now.getTime() + input.leaseMs);
    return prisma.$transaction(async (transaction) => {
      let rows: RawClaim[];
      if (input.stage === "SCAN")
        rows = await transaction.$queryRaw<RawClaim[]>`
          SELECT work."id", work."queryId", work."attemptNumber"
            FROM "SearchScanAssessment" work
            JOIN "SearchImageQuery" query ON query."id" = work."queryId"
           WHERE (work."status" = 'QUEUED' OR
                  (work."status" = 'PROCESSING' AND work."leaseExpiresAt" <= ${input.now}))
             AND query."status" IN ('SCAN_QUEUED', 'SCANNING')
             AND query."contentInaccessibleAt" IS NULL
             AND query."deleteBy" > ${input.now}
           ORDER BY work."createdAt", work."id"
           FOR UPDATE OF work SKIP LOCKED
           LIMIT ${input.limit}`;
      else if (input.stage === "DECODE")
        rows = await transaction.$queryRaw<RawClaim[]>`
          SELECT work."id", work."queryId", work."attemptNumber"
            FROM "SearchImageDecodeAttempt" work
            JOIN "SearchImageQuery" query ON query."id" = work."queryId"
           WHERE (work."status" = 'QUEUED' OR
                  (work."status" = 'PROCESSING' AND work."leaseExpiresAt" <= ${input.now}))
             AND query."status" IN ('DECODE_QUEUED', 'DECODING')
             AND query."contentInaccessibleAt" IS NULL
             AND query."deleteBy" > ${input.now}
           ORDER BY work."createdAt", work."id"
           FOR UPDATE OF work SKIP LOCKED
           LIMIT ${input.limit}`;
      else if (input.stage === "OCR")
        rows = await transaction.$queryRaw<RawClaim[]>`
          SELECT work."id", work."searchQueryId" AS "queryId", 1 AS "attemptNumber"
            FROM "OcrProcessingAttempt" work
            JOIN "SearchImageQuery" query ON query."id" = work."searchQueryId"
           WHERE work."purpose" = 'JOB_IMAGE_SEARCH'
             AND (work."status" = 'QUEUED' OR
                  (work."status" = 'PROCESSING' AND work."leaseExpiresAt" <= ${input.now}))
             AND query."status" IN ('OCR_QUEUED', 'OCR_PROCESSING')
             AND query."contentInaccessibleAt" IS NULL
             AND query."deleteBy" > ${input.now}
           ORDER BY work."createdAt", work."id"
           FOR UPDATE OF work SKIP LOCKED
           LIMIT ${input.limit}`;
      else
        rows = await transaction.$queryRaw<RawClaim[]>`
          SELECT work."id", work."queryId", work."attemptNumber"
            FROM "SearchIntentAttempt" work
            JOIN "SearchImageQuery" query ON query."id" = work."queryId"
           WHERE (work."status" = 'QUEUED' OR
                  (work."status" = 'PROCESSING' AND work."leaseExpiresAt" <= ${input.now}))
             AND query."status" IN ('INTERPRET_QUEUED', 'INTERPRETING')
             AND query."contentInaccessibleAt" IS NULL
             AND query."deleteBy" > ${input.now}
           ORDER BY work."createdAt", work."id"
           FOR UPDATE OF work SKIP LOCKED
           LIMIT ${input.limit}`;

      const ids = rows.map((row) => row.id);
      if (!ids.length) return [];
      if (input.stage === "SCAN") {
        await transaction.searchScanAssessment.updateMany({
          where: { id: { in: ids } },
          data: {
            status: "PROCESSING",
            leaseOwner: input.owner,
            leaseExpiresAt,
          },
        });
        await Promise.all(
          ids.map((id) =>
            transaction.searchScanAssessment.updateMany({
              where: { id, startedAt: null },
              data: { startedAt: input.now },
            }),
          ),
        );
        await transaction.searchImageQuery.updateMany({
          where: { id: { in: rows.map((row) => row.queryId) } },
          data: { status: "SCANNING" },
        });
      } else if (input.stage === "DECODE") {
        await transaction.searchImageDecodeAttempt.updateMany({
          where: { id: { in: ids } },
          data: {
            status: "PROCESSING",
            leaseOwner: input.owner,
            leaseExpiresAt,
          },
        });
        await Promise.all(
          ids.map((id) =>
            transaction.searchImageDecodeAttempt.updateMany({
              where: { id, startedAt: null },
              data: { startedAt: input.now },
            }),
          ),
        );
        await transaction.searchImageQuery.updateMany({
          where: { id: { in: rows.map((row) => row.queryId) } },
          data: { status: "DECODING" },
        });
      } else if (input.stage === "OCR") {
        await transaction.ocrProcessingAttempt.updateMany({
          where: { id: { in: ids } },
          data: {
            status: "PROCESSING",
            leaseOwner: input.owner,
            leaseExpiresAt,
          },
        });
        await Promise.all(
          ids.map((id) =>
            transaction.ocrProcessingAttempt.updateMany({
              where: { id, startedAt: null },
              data: { startedAt: input.now },
            }),
          ),
        );
        await transaction.searchImageQuery.updateMany({
          where: { id: { in: rows.map((row) => row.queryId) } },
          data: { status: "OCR_PROCESSING" },
        });
      } else {
        await transaction.searchIntentAttempt.updateMany({
          where: { id: { in: ids } },
          data: {
            status: "PROCESSING",
            leaseOwner: input.owner,
            leaseExpiresAt,
          },
        });
        await Promise.all(
          ids.map((id) =>
            transaction.searchIntentAttempt.updateMany({
              where: { id, startedAt: null },
              data: { startedAt: input.now },
            }),
          ),
        );
        await transaction.searchImageQuery.updateMany({
          where: { id: { in: rows.map((row) => row.queryId) } },
          data: { status: "INTERPRETING" },
        });
      }
      return rows.map((row) => ({
        stage: input.stage,
        id: row.id,
        queryId: row.queryId,
        leaseOwner: input.owner,
        leaseExpiresAt,
        attemptNumber: Number(row.attemptNumber),
      }));
    });
  }

  async assertCommitAllowed(input: { claim: ImageSearchWorkClaim; now: Date }) {
    const common = {
      id: input.claim.id,
      status: "PROCESSING" as const,
      leaseOwner: input.claim.leaseOwner,
      leaseExpiresAt: { gt: input.now },
      query: {
        id: input.claim.queryId,
        contentInaccessibleAt: null,
        deleteBy: { gt: input.now },
      },
    };
    const row =
      input.claim.stage === "SCAN"
        ? await prisma.searchScanAssessment.findFirst({
            where: {
              ...common,
              query: { ...common.query, status: "SCANNING" },
            },
            select: { id: true },
          })
        : input.claim.stage === "DECODE"
          ? await prisma.searchImageDecodeAttempt.findFirst({
              where: {
                ...common,
                query: { ...common.query, status: "DECODING" },
              },
              select: { id: true },
            })
          : input.claim.stage === "OCR"
            ? await prisma.ocrProcessingAttempt.findFirst({
                where: {
                  id: common.id,
                  purpose: "JOB_IMAGE_SEARCH",
                  status: "PROCESSING",
                  leaseOwner: common.leaseOwner,
                  leaseExpiresAt: common.leaseExpiresAt,
                  searchQuery: {
                    ...common.query,
                    status: "OCR_PROCESSING",
                  },
                },
                select: { id: true },
              })
            : await prisma.searchIntentAttempt.findFirst({
                where: {
                  ...common,
                  query: { ...common.query, status: "INTERPRETING" },
                },
                select: { id: true },
              });
    if (!row) throw new Error("STAGE_RESULT_DISCARDED");
  }

  async releaseOwner(owner: string, now: Date) {
    await prisma.$transaction([
      prisma.searchScanAssessment.updateMany({
        where: { status: "PROCESSING", leaseOwner: owner },
        data: { leaseExpiresAt: now },
      }),
      prisma.searchImageDecodeAttempt.updateMany({
        where: { status: "PROCESSING", leaseOwner: owner },
        data: { leaseExpiresAt: now },
      }),
      prisma.ocrProcessingAttempt.updateMany({
        where: {
          purpose: "JOB_IMAGE_SEARCH",
          status: "PROCESSING",
          leaseOwner: owner,
        },
        data: { leaseExpiresAt: now },
      }),
      prisma.searchIntentAttempt.updateMany({
        where: { status: "PROCESSING", leaseOwner: owner },
        data: { leaseExpiresAt: now },
      }),
    ]);
  }
}
