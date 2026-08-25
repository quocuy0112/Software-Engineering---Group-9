import "server-only";
import { prisma } from "@/backend/database/prisma";
import { serverEnvironment } from "@/backend/env/runtime";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import { randomUUID } from "node:crypto";

const DAY_MS = 86_400_000;

const purgeableDeletedReviewWhere = (cutoff: Date) =>
  ({
    softDeletedAt: { lte: cutoff },
    pendingVersionId: null,
    approvedVersionId: null,
    publicJobPostingId: null,
    correctionRequests: { none: {} },
    featuredPlacements: { none: {} },
    enforcementTargets: { none: {} },
  }) as const;

/**
 * Purges review payloads only for deleted drafts that were never published.
 * AuditEvent rows are intentionally independent and remain as the minimal
 * immutable record of submission, withdrawal, and recruiter deletion.
 */
export async function runDeletedJobReviewRetentionCycle(
  now = new Date(),
  limit = 50,
) {
  const boundedLimit = Math.min(100, Math.max(1, limit));
  const cutoff = new Date(
    now.getTime() -
      serverEnvironment.JOB_REVIEW_DELETED_RETENTION_DAYS * DAY_MS,
  );
  const candidates = await prisma.jobPostReviewAggregate.findMany({
    where: purgeableDeletedReviewWhere(cutoff),
    select: { id: true },
    orderBy: [{ softDeletedAt: "asc" }, { id: "asc" }],
    take: boundedLimit,
  });

  let purged = 0;
  let skipped = 0;
  for (const candidate of candidates) {
    const removed = await prisma
      .$transaction(async (transaction) => {
        const current = await transaction.jobPostReviewAggregate.findFirst({
          where: {
            id: candidate.id,
            ...purgeableDeletedReviewWhere(cutoff),
          },
          select: { jobId: true, versions: { select: { id: true } } },
        });
        if (!current) return false;

        const reviewVersionIds = current.versions.map(({ id }) => id);
        if (reviewVersionIds.length) {
          await transaction.jobPostReviewPrivateNote.deleteMany({
            where: { reviewVersionId: { in: reviewVersionIds } },
          });
          await transaction.jobPostReviewHistory.deleteMany({
            where: { reviewVersionId: { in: reviewVersionIds } },
          });
          await transaction.jobPostReviewVersion.deleteMany({
            where: { id: { in: reviewVersionIds } },
          });
        }
        await transaction.jobPostOperationalHistory.deleteMany({
          where: { aggregateId: candidate.id },
        });
        const aggregate = await transaction.jobPostReviewAggregate.deleteMany({
          where: {
            id: candidate.id,
            ...purgeableDeletedReviewWhere(cutoff),
          },
        });
        if (aggregate.count !== 1)
          throw new Error("JOB_REVIEW_RETENTION_CONFLICT");
        await new PrismaAuditRepository(transaction).append({
          occurredAt: now,
          actorType: "system",
          actorUserId: null,
          actorSessionId: null,
          action: "job_post_review.retention_purged",
          targetType: "job_post_review",
          targetId: current.jobId,
          result: "SUCCESS",
          correlationId: randomUUID(),
          context: {
            reason: "DELETED_DRAFT_RETENTION",
            status: "PURGED",
          },
        });
        return true;
      })
      .catch((error) => {
        if (
          error instanceof Error &&
          error.message === "JOB_REVIEW_RETENTION_CONFLICT"
        )
          return false;
        throw error;
      });
    if (removed) purged++;
    else skipped++;
  }
  return { scanned: candidates.length, purged, skipped };
}
