import "server-only";
import { randomUUID } from "node:crypto";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import { prisma } from "@/backend/database/prisma";

/** Archives expired managed jobs in small idempotent batches. */
export async function runJobPostLifecycleCycle(now: Date) {
  const rows = await prisma.jobPostReviewAggregate.findMany({
    where: {
      approvedVersionId: { not: null },
      visibilityState: "PUBLISHED",
      publicJobPosting: { is: { applicationDeadline: { lte: now } } },
    },
    select: { id: true, jobId: true, version: true, publicJobPostingId: true },
    orderBy: { updatedAt: "asc" },
    take: 100,
  });
  let archived = 0;
  for (const row of rows) {
    const result = await prisma.$transaction(async (tx) => {
      const correlationId = `job-post-auto-archive:${row.id}:${randomUUID()}`;
      const changed = await tx.jobPostReviewAggregate.updateMany({
        where: {
          id: row.id,
          version: row.version,
          visibilityState: "PUBLISHED",
        },
        data: {
          visibilityState: "ARCHIVED",
          applicationState: "CLOSED",
          archivedAt: now,
          operationalVersion: { increment: 1 },
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) return false;
      if (row.publicJobPostingId)
        await tx.jobPosting.update({
          where: { id: row.publicJobPostingId },
          data: {
            status: "REMOVED",
            closedAt: now,
            removedAt: now,
            version: { increment: 1 },
          },
        });
      await tx.jobPostOperationalHistory.create({
        data: {
          aggregateId: row.id,
          action: "AUTO_ARCHIVE",
          actorUserId: null,
          correlationId,
          priorState: { visibility: "PUBLISHED", applicationState: "OPEN" },
          resultingState: {
            visibility: "ARCHIVED",
            applicationState: "CLOSED",
          },
          reason: "APPLICATION_DEADLINE_EXPIRED",
          version: row.version + 1,
          occurredAt: now,
        },
      });
      await new PrismaAuditRepository(tx).append({
        occurredAt: now,
        actorType: "system",
        actorUserId: null,
        actorSessionId: null,
        action: "job_post_management.archive",
        targetType: "job_posting",
        targetId: row.jobId,
        result: "SUCCESS",
        correlationId,
        context: {
          reason: "APPLICATION_DEADLINE_EXPIRED",
          targetVersion: row.version + 1,
          visibility: "ARCHIVED",
          applicationState: "CLOSED",
        },
      });
      return true;
    });
    if (result) archived++;
  }
  return { scanned: rows.length, archived };
}
