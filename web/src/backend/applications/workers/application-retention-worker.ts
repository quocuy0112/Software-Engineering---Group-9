import "server-only";

import { prisma } from "@/backend/database/prisma";
import { createApplicationDocumentStorage } from "../storage/factory";

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const ORPHAN_DEADLINE = 24 * 60 * 60 * 1000;

export async function runApplicationRetentionCycle(
  now = new Date(),
  limit = 100,
) {
  const storage = createApplicationDocumentStorage();
  await storage.assertReady();

  await prisma.jobApplication.updateMany({
    where: {
      documentAccessDeniedAt: null,
      documentRetentionDueAt: { lte: now },
    },
    data: {
      documentAccessDeniedAt: now,
      documentDeletionDueAt: new Date(now.getTime() + THIRTY_DAYS),
    },
  });
  await prisma.applicationDocument.updateMany({
    where: {
      ordinaryAccessDeniedAt: null,
      application: { documentAccessDeniedAt: { lte: now } },
    },
    data: {
      ordinaryAccessDeniedAt: now,
      deleteAfter: new Date(now.getTime() + THIRTY_DAYS),
    },
  });

  const documents = await prisma.applicationDocument.findMany({
    where: { deleteAfter: { lte: now }, deletedAt: null },
    orderBy: [{ deleteAfter: "asc" }, { id: "asc" }],
    take: limit,
    select: { id: true, jobApplicationId: true, storageKeyEncrypted: true },
  });
  let deleted = 0;
  for (const document of documents) {
    try {
      await storage.delete(document.storageKeyEncrypted);
      await prisma.applicationDocument.update({
        where: { id: document.id },
        data: { deletedAt: now },
      });
      const remaining = await prisma.applicationDocument.count({
        where: { jobApplicationId: document.jobApplicationId, deletedAt: null },
      });
      if (remaining === 0) {
        await prisma.jobApplication.update({
          where: { id: document.jobApplicationId },
          data: { documentDeletedAt: now },
        });
      }
      deleted++;
    } catch {
      await prisma.applicationDocument.update({
        where: { id: document.id },
        data: { ordinaryAccessDeniedAt: { set: now } },
      }).catch(() => undefined);
    }
  }

  const textRows = await prisma.applicationCoverLetterText.findMany({
    where: {
      deletedAt: null,
      OR: [
        { deleteAfter: { lte: now } },
        { application: { documentAccessDeniedAt: { lte: now } } },
      ],
    },
    select: { jobApplicationId: true },
    take: limit,
  });
  if (textRows.length) {
    await prisma.applicationCoverLetterText.updateMany({
      where: { jobApplicationId: { in: textRows.map((row) => row.jobApplicationId) } },
      data: { deletedAt: now, deleteAfter: now },
    });
  }

  const orphanRows = await prisma.applicationArtifactPromotion.findMany({
    where: {
      state: { in: ["PROMOTED", "DELETE_PENDING", "DELETE_FAILED"] },
      orphanDeleteAfter: { lte: now },
      deletedAt: null,
    },
    orderBy: [{ orphanDeleteAfter: "asc" }, { id: "asc" }],
    take: limit,
    select: { id: true, storageKeyEncrypted: true },
  });
  let orphansDeleted = 0;
  for (const orphan of orphanRows) {
    try {
      await storage.delete(orphan.storageKeyEncrypted);
      await prisma.applicationArtifactPromotion.update({
        where: { id: orphan.id },
        data: { state: "DELETED", deletedAt: now },
      });
      orphansDeleted++;
    } catch {
      await prisma.applicationArtifactPromotion.update({
        where: { id: orphan.id },
        data: {
          state: "DELETE_FAILED",
          attemptCount: { increment: 1 },
          lastSafeFailureCode: "APPLICATION_STORAGE_DELETE_FAILED",
        },
      }).catch(() => undefined);
    }
  }
  return { claimed: documents.length, deleted, orphans: orphanRows.length, orphansDeleted };
}

export async function applicationRetentionProbe() {
  return { worker: "application-retention", orphanDeadlineHours: ORPHAN_DEADLINE / 3_600_000, cleanupEnabled: true };
}
