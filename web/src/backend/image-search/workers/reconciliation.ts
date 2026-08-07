import "server-only";

import { prisma } from "@/backend/database/prisma";
import { Prisma } from "@/backend/generated/prisma/client";
import { recordImageSearchOperationalEvidence } from "@/backend/services/image-search/image-search-admission-readiness";

export class ImageSearchReconciliationWorker {
  constructor(private readonly heartbeatMs = 2 * 60_000) {}

  async runOnce(now = new Date()) {
    await prisma.$transaction(async (transaction) => {
      const overdue = await transaction.searchImageQuery.findMany({
        where: {
          deleteBy: { lte: now },
          contentInaccessibleAt: null,
        },
        select: { id: true },
        take: 500,
      });
      const overdueIds = overdue.map((row) => row.id);
      if (overdueIds.length) {
        await transaction.searchImageQuery.updateMany({
          where: { id: { in: overdueIds } },
          data: {
            status: "EXPIRED",
            failureCode: "QUERY_EXPIRED",
            contentInaccessibleAt: now,
          },
        });
        await transaction.$executeRaw(
          Prisma.sql`
            UPDATE "SearchStoredArtifact" AS artifact
               SET "status" = 'DELETE_PENDING',
                   "contentInaccessibleAt" = ${now},
                   "deleteAfter" = LEAST(
                     COALESCE(artifact."deleteAfter", ${now}),
                     ${now},
                     artifact."deleteBy"
                   ),
                   "deleteLeaseOwner" = NULL,
                   "deleteLeaseExpiresAt" = NULL,
                   "updatedAt" = ${now}
             WHERE artifact."queryId" IN (${Prisma.join(overdueIds)})
               AND artifact."status" <> 'DELETED'
          `,
        );
      }
      await transaction.$executeRaw`
        UPDATE "SearchStoredArtifact" AS artifact
           SET "status" = 'DELETE_PENDING',
               "contentInaccessibleAt" = ${now},
               "deleteAfter" = LEAST(
                 COALESCE(artifact."deleteAfter", ${now}),
                 ${now},
                 artifact."deleteBy"
               ),
               "updatedAt" = ${now}
          FROM "SearchImageQuery" AS query
         WHERE artifact."queryId" = query."id"
           AND query."contentInaccessibleAt" IS NOT NULL
           AND artifact."status" IN ('QUARANTINED', 'AVAILABLE')
      `;
      await transaction.searchScanAssessment.updateMany({
        where: {
          status: "PROCESSING",
          leaseExpiresAt: { lte: now },
          query: { contentInaccessibleAt: { not: null } },
        },
        data: {
          status: "CANCELLED",
          leaseOwner: null,
          leaseExpiresAt: null,
          completedAt: now,
        },
      });
      await transaction.searchImageDecodeAttempt.updateMany({
        where: {
          status: "PROCESSING",
          leaseExpiresAt: { lte: now },
          query: { contentInaccessibleAt: { not: null } },
        },
        data: {
          status: "CANCELLED",
          leaseOwner: null,
          leaseExpiresAt: null,
          completedAt: now,
        },
      });
      await transaction.ocrProcessingAttempt.updateMany({
        where: {
          purpose: "JOB_IMAGE_SEARCH",
          status: "PROCESSING",
          leaseExpiresAt: { lte: now },
          searchQuery: { contentInaccessibleAt: { not: null } },
        },
        data: {
          status: "CANCELLED",
          leaseOwner: null,
          leaseExpiresAt: null,
          completedAt: now,
        },
      });
      await transaction.searchIntentAttempt.updateMany({
        where: {
          status: "PROCESSING",
          leaseExpiresAt: { lte: now },
          query: { contentInaccessibleAt: { not: null } },
        },
        data: {
          status: "CANCELLED",
          leaseOwner: null,
          leaseExpiresAt: null,
          completedAt: now,
        },
      });
      await transaction.imageSearchAdmissionEvent.deleteMany({
        where: { expiresAt: { lte: now } },
      });
      const artifactFree = await transaction.searchImageQuery.findMany({
        where: {
          contentInaccessibleAt: { not: null },
          deletedAt: null,
          artifacts: { none: {} },
        },
        select: { id: true },
        take: 500,
      });
      if (artifactFree.length)
        await transaction.searchImageQuery.updateMany({
          where: { id: { in: artifactFree.map((row) => row.id) } },
          data: { status: "DELETED", deletedAt: now },
        });
    });
    await recordImageSearchOperationalEvidence({
      component: "RECONCILIATION",
      evidenceVersion: "image-search-reconciliation-v1",
      succeededAt: now,
      validForMs: this.heartbeatMs,
    });
  }
}
