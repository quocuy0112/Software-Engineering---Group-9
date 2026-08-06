import "server-only";

import { prisma } from "@/backend/database/prisma";
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
        await transaction.searchStoredArtifact.updateMany({
          where: { queryId: { in: overdueIds }, status: { not: "DELETED" } },
          data: {
            status: "DELETE_PENDING",
            contentInaccessibleAt: now,
            deleteAfter: now,
            deleteLeaseOwner: null,
            deleteLeaseExpiresAt: null,
          },
        });
      }
      await transaction.searchStoredArtifact.updateMany({
        where: {
          query: { contentInaccessibleAt: { not: null } },
          status: { in: ["QUARANTINED", "AVAILABLE"] },
        },
        data: {
          status: "DELETE_PENDING",
          contentInaccessibleAt: now,
          deleteAfter: now,
        },
      });
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
