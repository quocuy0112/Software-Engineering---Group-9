import "server-only";

import { prisma } from "@/backend/database/prisma";
import type {
  PrivateSearchArtifactStorage,
  SearchArtifactLocator,
} from "@/backend/image-search/storage/private-search-storage";
import { recordImageSearchOperationalEvidence } from "@/backend/services/image-search/image-search-admission-readiness";

type CleanupClaim = Readonly<{
  id: string;
  queryId: string;
  storageLocator: string;
  deleteBy: Date;
}>;

export class ImageSearchCleanupWorker {
  constructor(
    private readonly dependencies: Readonly<{
      storage: PrivateSearchArtifactStorage;
      owner: string;
      leaseMs?: number;
      heartbeatMs?: number;
    }>,
  ) {}

  private async claim(now: Date, limit: number): Promise<CleanupClaim[]> {
    const leaseExpiresAt = new Date(
      now.getTime() + (this.dependencies.leaseMs ?? 30_000),
    );
    return prisma.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<CleanupClaim[]>`
        SELECT "id", "queryId", "storageLocator", "deleteBy"
          FROM "SearchStoredArtifact"
         WHERE "storageLocator" IS NOT NULL
           AND (
             ("status" IN ('DELETE_PENDING', 'DELETE_FAILED')
               AND COALESCE("deleteAfter", "deleteBy") <= ${now})
             OR "deleteBy" <= ${now}
           )
           AND ("deleteLeaseExpiresAt" IS NULL OR "deleteLeaseExpiresAt" <= ${now})
         ORDER BY "deleteBy", "id"
         FOR UPDATE SKIP LOCKED
         LIMIT ${limit}`;
      if (rows.length)
        await transaction.searchStoredArtifact.updateMany({
          where: { id: { in: rows.map((row) => row.id) } },
          data: {
            status: "DELETING",
            deleteLeaseOwner: this.dependencies.owner,
            deleteLeaseExpiresAt: leaseExpiresAt,
            deleteAttempts: { increment: 1 },
          },
        });
      return rows;
    });
  }

  async runOnce(now = new Date(), limit = 50) {
    const rows = await this.claim(now, limit);
    let failures = 0;
    for (const row of rows) {
      try {
        await this.dependencies.storage.delete(
          row.storageLocator as SearchArtifactLocator,
        );
        await prisma.$transaction(async (transaction) => {
          const scrubbed = await transaction.searchStoredArtifact.updateMany({
            where: {
              id: row.id,
              status: "DELETING",
              deleteLeaseOwner: this.dependencies.owner,
            },
            data: {
              status: "DELETED",
              storageLocator: null,
              encryptionKeyVersion: null,
              encryptionIv: null,
              authenticationTag: null,
              ciphertextBytes: 0,
              contentInaccessibleAt: now,
              deleteAfter: null,
              deleteLeaseOwner: null,
              deleteLeaseExpiresAt: null,
              deleteFailureCode: null,
              deletedAt: now,
            },
          });
          if (scrubbed.count !== 1) return;
          const remaining = await transaction.searchStoredArtifact.count({
            where: { queryId: row.queryId, status: { not: "DELETED" } },
          });
          if (remaining === 0)
            await transaction.searchImageQuery.updateMany({
              where: {
                id: row.queryId,
                contentInaccessibleAt: { not: null },
              },
              data: { status: "DELETED", deletedAt: now },
            });
        });
      } catch {
        failures += 1;
        await prisma.searchStoredArtifact.updateMany({
          where: {
            id: row.id,
            status: "DELETING",
            deleteLeaseOwner: this.dependencies.owner,
          },
          data: {
            status: "DELETE_FAILED",
            deleteAfter: new Date(
              Math.min(now.getTime() + 5_000, row.deleteBy.getTime()),
            ),
            deleteLeaseOwner: null,
            deleteLeaseExpiresAt: null,
            deleteFailureCode: "DELETE_FAILED",
          },
        });
      }
    }
    if (failures === 0) {
      await recordImageSearchOperationalEvidence({
        component: "CLEANUP",
        evidenceVersion: "image-search-cleanup-v1",
        succeededAt: now,
        validForMs: this.dependencies.heartbeatMs ?? 2 * 60_000,
      });
    }
    return { claimed: rows.length, failures };
  }
}
