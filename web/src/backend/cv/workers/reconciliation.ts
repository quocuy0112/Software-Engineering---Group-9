import "server-only";

import { randomUUID } from "node:crypto";

import { prisma } from "@/backend/database/prisma";
import {
  CvStorageError,
  type PrivateCvStorage,
} from "@/backend/cv/storage/private-cv-storage";
import { systemClock, type Clock } from "@/backend/time/clock";
import { createCvWorkerStorage } from "./cv-worker-resources";

export const CV_RECONCILIATION_ORPHAN_GRACE_MS = 60 * 60_000;

export type CvReconciliationResult = Readonly<{
  referencesChecked: number;
  missingScheduled: number;
  inventoryChecked: number;
  orphansDeleted: number;
  nextCursor?: string;
}>;

function isMissing(error: unknown): boolean {
  return (
    error instanceof CvStorageError &&
    error.code === "CV_STORAGE_OBJECT_NOT_FOUND"
  );
}

export class CvStorageReconciliation {
  constructor(
    private readonly storage: PrivateCvStorage = createCvWorkerStorage(),
    private readonly clock: Clock = systemClock,
  ) {}

  async runOnce(
    input: {
      now?: Date;
      limit?: number;
      cursor?: string;
    } = {},
  ): Promise<CvReconciliationResult> {
    const now = input.now ?? this.clock.now();
    const limit = input.limit ?? 25;
    if (
      Number.isNaN(now.getTime()) ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      throw new Error("CV_RECONCILIATION_RUN_INVALID");
    }
    await this.storage.assertReady();
    const references = await prisma.cvStoredArtifact.findMany({
      where: {
        status: { in: ["QUARANTINED", "AVAILABLE"] },
        contentInaccessibleAt: null,
        deletedAt: null,
        createdAt: {
          lte: new Date(now.getTime() - CV_RECONCILIATION_ORPHAN_GRACE_MS),
        },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: Math.min(limit, 5),
      select: {
        id: true,
        uploadId: true,
        accountId: true,
        storageLocator: true,
        ciphertextBytes: true,
      },
    });
    let missingScheduled = 0;
    for (const reference of references) {
      try {
        for await (const chunk of this.storage.open(
          reference.storageLocator,
          reference.ciphertextBytes,
        )) {
          // Presence and exact byte count are validated by the adapter.
          void chunk;
        }
      } catch (error) {
        if (!isMissing(error)) continue;
        const changed = await prisma.$transaction(async (transaction) => {
          const artifact = await transaction.cvStoredArtifact.updateMany({
            where: {
              id: reference.id,
              uploadId: reference.uploadId,
              accountId: reference.accountId,
              status: { in: ["QUARANTINED", "AVAILABLE"] },
              contentInaccessibleAt: null,
              deletedAt: null,
            },
            data: {
              status: "DELETE_PENDING",
              contentInaccessibleAt: now,
              deleteAfter: now,
              deleteFailureCode: "STORAGE_OBJECT_MISSING",
            },
          });
          if (artifact.count !== 1) return false;
          await transaction.cvUpload.updateMany({
            where: {
              id: reference.uploadId,
              accountId: reference.accountId,
              contentInaccessibleAt: null,
              deletedAt: null,
            },
            data: {
              status: "VALIDATION_FAILED",
              failureCode: "ARTIFACT_INTEGRITY_FAILED",
              contentInaccessibleAt: now,
              deleteAfter: now,
            },
          });
          await transaction.auditEvent.createMany({
            data: [
              {
                id: `cv_missing_${reference.id}`.slice(0, 80),
                occurredAt: now,
                actorType: "system",
                action: "cv_import.reconciled",
                targetType: "cv_import",
                targetId: reference.uploadId,
                result: "FAILURE",
                correlationId: `cv_missing_${reference.id}`.slice(0, 128),
                context: {
                  state: "MISSING_REFERENCE",
                  failureCode: "STORAGE_OBJECT_MISSING",
                },
              },
            ],
            skipDuplicates: true,
          });
          return true;
        });
        if (changed) missingScheduled += 1;
      }
    }

    const inventory = await this.storage.inventory({
      limit,
      ...(input.cursor ? { cursor: input.cursor } : {}),
    });
    const locators = inventory.items.map((item) => String(item.locator));
    // The local CV storage adapter is also used by the application-document
    // promotion path.  Reconciliation must treat both namespaces as owned
    // objects; otherwise a valid application CV is classified as an
    // untracked CV artifact and deleted after the orphan grace period.
    const [trackedCvArtifacts, trackedApplicationDocuments, trackedPromotions] =
      locators.length
        ? await Promise.all([
            prisma.cvStoredArtifact.findMany({
              where: { storageLocator: { in: locators } },
              select: { storageLocator: true },
            }),
            prisma.applicationDocument.findMany({
              where: { storageKeyEncrypted: { in: locators }, deletedAt: null },
              select: { storageKeyEncrypted: true },
            }),
            prisma.applicationArtifactPromotion.findMany({
              where: { storageKeyEncrypted: { in: locators }, deletedAt: null },
              select: { storageKeyEncrypted: true },
            }),
          ])
        : [[], [], []];
    const trackedLocators = new Set([
      ...trackedCvArtifacts.map((item) => item.storageLocator),
      ...trackedApplicationDocuments.map((item) => item.storageKeyEncrypted),
      ...trackedPromotions.map((item) => item.storageKeyEncrypted),
    ]);
    let orphansDeleted = 0;
    for (const item of inventory.items) {
      if (
        trackedLocators.has(String(item.locator)) ||
        !item.createdAt ||
        item.createdAt.getTime() >
          now.getTime() - CV_RECONCILIATION_ORPHAN_GRACE_MS
      ) {
        continue;
      }
      const outcome = await this.storage.delete(String(item.locator));
      if (!outcome.deleted) continue;
      orphansDeleted += 1;
      await prisma.auditEvent.create({
        data: {
          occurredAt: now,
          actorType: "system",
          action: "cv_import.reconciled",
          targetType: "cv_import",
          targetId: null,
          result: "SUCCESS",
          correlationId: `cv_reconcile_${randomUUID()}`.slice(0, 128),
          context: { state: "GRACE_AGED_ORPHAN_DELETED", count: 1 },
        },
      });
    }
    return Object.freeze({
      referencesChecked: references.length,
      missingScheduled,
      inventoryChecked: inventory.items.length,
      orphansDeleted,
      ...(inventory.nextCursor ? { nextCursor: inventory.nextCursor } : {}),
    });
  }
}
