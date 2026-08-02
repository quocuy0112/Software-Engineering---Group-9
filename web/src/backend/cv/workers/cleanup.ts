import "server-only";

import { prisma } from "@/backend/database/prisma";
import { buildCvLogEvent, buildCvMetricEvent } from "@/backend/cv/telemetry";
import { CvRetentionService } from "@/backend/services/cv-import/cv-retention-service";
import { systemClock, type Clock } from "@/backend/time/clock";

const INCOMPLETE_RETENTION_MS = 24 * 60 * 60_000;

export type CvCleanupObservability = Readonly<{
  emitLog?(event: ReturnType<typeof buildCvLogEvent>): void | Promise<void>;
  emitMetric?(
    event: ReturnType<typeof buildCvMetricEvent>,
  ): void | Promise<void>;
}>;

export type CvCleanupRunResult = Readonly<{
  expired: number;
  abandoned: number;
  artifactsScheduled: number;
  draftsScrubbed: number;
  uploadsFinalized: number;
}>;

function lagBucket(milliseconds: number): string {
  if (milliseconds <= 0) return "lte_0ms";
  if (milliseconds <= 60_000) return "lte_1m";
  if (milliseconds <= 15 * 60_000) return "lte_15m";
  if (milliseconds <= 60 * 60_000) return "lte_1h";
  if (milliseconds <= 24 * 60 * 60_000) return "lte_24h";
  return "gt_24h";
}

export class CvCleanupCoordinator {
  private readonly retention: CvRetentionService;

  constructor(
    private readonly clock: Clock = systemClock,
    private readonly observability: CvCleanupObservability = {},
  ) {
    this.retention = new CvRetentionService(clock);
  }

  private async rejectAbandoned(now: Date, limit: number): Promise<number> {
    const due = await prisma.cvUpload.findMany({
      where: {
        status: "AWAITING_CONTENT",
        createdAt: { lte: new Date(now.getTime() - INCOMPLETE_RETENTION_MS) },
        contentInaccessibleAt: null,
        deletedAt: null,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: limit,
      select: {
        id: true,
        accountId: true,
        createdAt: true,
        quotaReservationRemaining: true,
      },
    });
    let changed = 0;
    for (const candidate of due) {
      const finalized = await prisma.$transaction(async (transaction) => {
        const rows = await transaction.$queryRaw<
          Array<{ quotaReservationRemaining: number }>
        >`
          SELECT "quotaReservationRemaining"
            FROM "CvUpload"
           WHERE "id" = ${candidate.id}
             AND "status" = 'AWAITING_CONTENT'
             AND "contentInaccessibleAt" IS NULL
           FOR UPDATE
        `;
        const upload = rows[0];
        if (!upload) return false;
        await transaction.$queryRaw`
          SELECT "accountId" FROM "CvAccountQuota"
           WHERE "accountId" = ${candidate.accountId} FOR UPDATE
        `;
        if (upload.quotaReservationRemaining > 0) {
          await transaction.$executeRaw`
            UPDATE "CvAccountQuota"
               SET "reservedBytes" = GREATEST(0, "reservedBytes" - ${upload.quotaReservationRemaining}),
                   "updatedAt" = ${now}
             WHERE "accountId" = ${candidate.accountId}
          `;
        }
        const deadline = new Date(
          candidate.createdAt.getTime() + INCOMPLETE_RETENTION_MS,
        );
        await transaction.cvUpload.update({
          where: { id: candidate.id },
          data: {
            status: "VALIDATION_FAILED",
            failureCode: "CONTENT_REQUIRED",
            quotaReservationRemaining: 0,
            contentInaccessibleAt: now,
            deleteAfter: deadline,
          },
          select: { id: true },
        });
        await transaction.auditEvent.createMany({
          data: [
            {
              id: `cv_abandon_${candidate.id}`.slice(0, 80),
              occurredAt: now,
              actorType: "system",
              action: "cv_import.expired",
              targetType: "cv_import",
              targetId: candidate.id,
              result: "SUCCESS",
              correlationId: `cv_abandon_${candidate.id}`.slice(0, 128),
              context: { state: "INCOMPLETE_PURGE_DUE" },
            },
          ],
          skipDuplicates: true,
        });
        return true;
      });
      if (finalized) changed += 1;
    }
    return changed;
  }

  private async scrubDueDrafts(now: Date, limit: number): Promise<number> {
    const rows = await prisma.$queryRaw<
      Array<{ id: string; uploadId: string }>
    >`
      SELECT draft."id", draft."uploadId"
        FROM "CvDraft" draft
       WHERE draft."payloadDeleteAfter" <= ${now}
         AND draft."payloadDeletedAt" IS NULL
       ORDER BY draft."payloadDeleteAfter", draft."id"
       LIMIT ${limit}
    `;
    let scrubbed = 0;
    for (const row of rows) {
      const changed = await prisma.$transaction(async (transaction) => {
        const count = await transaction.$executeRaw`
          UPDATE "CvDraft"
             SET "proposalPayload" = NULL, "reviewPayload" = NULL,
                 "provenancePayload" = NULL, "payloadBytes" = 0,
                 "provenanceBytes" = 0, "payloadDeletedAt" = ${now},
                 "updatedAt" = ${now}
           WHERE "id" = ${row.id}
             AND "payloadDeleteAfter" <= ${now}
             AND "payloadDeletedAt" IS NULL
        `;
        if (count !== 1) return false;
        await transaction.auditEvent.createMany({
          data: [
            {
              id: `cv_scrub_${row.id}`.slice(0, 80),
              occurredAt: now,
              actorType: "system",
              action: "cv_import.content_scrubbed",
              targetType: "cv_draft",
              targetId: row.id,
              result: "SUCCESS",
              correlationId: `cv_scrub_${row.id}`.slice(0, 128),
              context: { state: "PAYLOAD_SCRUBBED" },
            },
          ],
          skipDuplicates: true,
        });
        return true;
      });
      if (changed) scrubbed += 1;
    }
    return scrubbed;
  }

  private async finalizePurgedUploads(
    now: Date,
    limit: number,
  ): Promise<number> {
    const candidates = await prisma.$queryRaw<
      Array<{ id: string; accountId: string; deleteAfter: Date }>
    >`
      SELECT upload."id", upload."accountId", upload."deleteAfter"
        FROM "CvUpload" upload
       WHERE upload."deleteAfter" <= ${now}
         AND upload."deletedAt" IS NULL
         AND upload."contentInaccessibleAt" IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM "CvStoredArtifact" artifact
            WHERE artifact."uploadId" = upload."id"
              AND artifact."status" <> 'DELETED'
         )
         AND NOT EXISTS (
           SELECT 1 FROM "CvDraft" draft
            WHERE draft."uploadId" = upload."id"
              AND draft."payloadDeletedAt" IS NULL
         )
       ORDER BY upload."deleteAfter", upload."id"
       LIMIT ${limit}
    `;
    let finalized = 0;
    for (const candidate of candidates) {
      const result = await prisma.$transaction(async (transaction) => {
        const locks = await transaction.$queryRaw<Array<{ status: string }>>`
          SELECT upload."status"::text AS "status"
            FROM "CvUpload" upload
           WHERE upload."id" = ${candidate.id}
             AND upload."deletedAt" IS NULL
             AND upload."deleteAfter" <= ${now}
           FOR UPDATE OF upload
        `;
        const upload = locks[0];
        if (!upload) return false;
        const blockingArtifact = await transaction.cvStoredArtifact.findFirst({
          where: { uploadId: candidate.id, status: { not: "DELETED" } },
          select: { id: true },
        });
        const blockingDraft = await transaction.cvDraft.findFirst({
          where: { uploadId: candidate.id, payloadDeletedAt: null },
          select: { id: true },
        });
        if (blockingArtifact || blockingDraft) return false;
        await transaction.$queryRaw`
          SELECT "accountId" FROM "CvAccountQuota"
           WHERE "accountId" = ${candidate.accountId} FOR UPDATE
        `;
        const retained = await transaction.cvStoredArtifact.aggregate({
          where: { uploadId: candidate.id },
          _sum: { plaintextBytes: true },
        });
        const retainedBytes = retained._sum.plaintextBytes ?? 0;
        if (retainedBytes > 0) {
          await transaction.$executeRaw`
            UPDATE "CvAccountQuota"
               SET "retainedBytes" = GREATEST(0, "retainedBytes" - ${retainedBytes}),
                   "updatedAt" = ${now}
             WHERE "accountId" = ${candidate.accountId}
          `;
        }
        await transaction.$executeRaw`
          UPDATE "CvStoredArtifact"
             SET "storageLocator" = CONCAT('deleted_', "id"),
                 "encryptionIv" = decode(repeat('00', 12), 'hex'),
                 "authenticationTag" = decode(repeat('00', 16), 'hex'),
                 "plaintextSha256" = decode(repeat('00', 32), 'hex'),
                 "plaintextBytes" = 0, "ciphertextBytes" = 0,
                 "updatedAt" = ${now}
           WHERE "uploadId" = ${candidate.id} AND "status" = 'DELETED'
        `;
        await transaction.$executeRaw`
          UPDATE "CvUpload"
             SET "status" = CASE WHEN "status" = 'CANCELLED'
                                 THEN 'DELETED'::"CvUploadStatus" ELSE "status" END,
                 "displayFilenameCiphertext" = NULL, "actualBytes" = NULL,
                 "sourceSha256" = NULL, "contentReceivedAt" = NULL,
                 "quotaReservationRemaining" = 0, "deletedAt" = ${now},
                 "updatedAt" = ${now}
           WHERE "id" = ${candidate.id} AND "deletedAt" IS NULL
        `;
        await transaction.auditEvent.createMany({
          data: [
            {
              id: `cv_cleanup_${candidate.id}`.slice(0, 80),
              occurredAt: now,
              actorType: "system",
              action: "cv_import.cleanup_completed",
              targetType: "cv_import",
              targetId: candidate.id,
              result: "SUCCESS",
              correlationId: `cv_cleanup_${candidate.id}`.slice(0, 128),
              context: {
                state: upload.status === "CANCELLED" ? "DELETED" : "SCRUBBED",
                lagBucket: lagBucket(
                  now.getTime() - candidate.deleteAfter.getTime(),
                ),
              },
            },
          ],
          skipDuplicates: true,
        });
        return true;
      });
      if (result) {
        finalized += 1;
        const lag = Math.max(
          0,
          now.getTime() - candidate.deleteAfter.getTime(),
        );
        await Promise.allSettled([
          this.observability.emitLog?.(
            buildCvLogEvent({
              event: "cv.cleanup.completed",
              stage: "DELETE",
              state: "CONTENT_ABSENT",
              queueLagBucket: lagBucket(lag),
            }),
          ),
          this.observability.emitMetric?.(
            buildCvMetricEvent({
              metric: "cv_cleanup_lag_ms",
              value: lag,
              dimensions: { stage: "DELETE", queueLagBucket: lagBucket(lag) },
            }),
          ),
        ]);
      }
    }
    return finalized;
  }

  async runOnce(
    input: { now?: Date; limit?: number } = {},
  ): Promise<CvCleanupRunResult> {
    const now = input.now ?? this.clock.now();
    const limit = input.limit ?? 50;
    if (
      Number.isNaN(now.getTime()) ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100
    )
      throw new Error("CV_CLEANUP_RUN_INVALID");
    const expired = await this.retention.expireDue({ now, limit });
    const abandoned = await this.rejectAbandoned(now, limit);
    const artifacts = await prisma.cvStoredArtifact.updateMany({
      where: {
        deleteAfter: { lte: now },
        status: { in: ["QUARANTINED", "AVAILABLE", "DELETE_FAILED"] },
        deletedAt: null,
        deleteAttempts: { lt: 100 },
      },
      data: { status: "DELETE_PENDING", deleteFailureCode: null },
    });
    const draftsScrubbed = await this.scrubDueDrafts(now, limit);
    const uploadsFinalized = await this.finalizePurgedUploads(now, limit);
    return Object.freeze({
      expired,
      abandoned,
      artifactsScheduled: artifacts.count,
      draftsScrubbed,
      uploadsFinalized,
    });
  }
}
