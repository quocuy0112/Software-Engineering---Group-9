import "server-only";
import { PrismaJobPostReviewRepository } from "@/backend/repositories/jobs/prisma-job-post-review-repository";
import { prisma } from "@/backend/database/prisma";
import { randomUUID } from "node:crypto";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";

/**
 * Application boundary for the review lifecycle. User-story orchestration is
 * added here so Route Handlers never depend on Prisma or JSON persistence.
 */
export class JobPostReviewService {
  constructor(
    readonly reviews: PrismaJobPostReviewRepository = new PrismaJobPostReviewRepository(),
  ) {}
}

export async function closeManagedJobPost(input: {
  jobId: string;
  companyId: string;
  actorUserId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return prisma.$transaction(async (transaction) => {
    const aggregate = await transaction.jobPostReviewAggregate.findUnique({
      where: { jobId: input.jobId },
    });
    if (!aggregate) return false;
    if (aggregate.companyId !== input.companyId)
      throw new Error("JOB_POST_REVIEW_UNAVAILABLE");
    if (aggregate.closedAt) return true;
    const correlationId = randomUUID();
    const closed = await transaction.jobPostReviewAggregate.update({
      where: { id: aggregate.id, version: aggregate.version },
      data: {
        closedAt: now,
        closedByUserId: input.actorUserId,
        version: { increment: 1 },
      },
    });
    if (aggregate.publicJobPostingId)
      await transaction.jobPosting.update({
        where: { id: aggregate.publicJobPostingId },
        data: { status: "CLOSED", closedAt: now, version: { increment: 1 } },
      });
    const reviewVersionId =
      aggregate.pendingVersionId ?? aggregate.approvedVersionId;
    if (reviewVersionId) {
      const review = await transaction.jobPostReviewVersion.findUniqueOrThrow({
        where: { id: reviewVersionId },
        select: { state: true, assignedAdminUserId: true },
      });
      await transaction.jobPostReviewHistory.create({
        data: {
          reviewVersionId,
          action: "CLOSED",
          actorUserId: input.actorUserId,
          priorState: review.state,
          resultingState: review.state,
          priorAssigneeUserId: review.assignedAdminUserId,
          resultingAssigneeUserId: review.assignedAdminUserId,
          resultingAggregateVersion: closed.version,
          correlationId,
          occurredAt: now,
        },
      });
    }
    await new PrismaAuditRepository(transaction).append({
      occurredAt: now,
      actorType: "user",
      actorUserId: input.actorUserId,
      actorSessionId: null,
      action: "job_post_review.closed",
      targetType: "job_post_review",
      targetId: reviewVersionId ?? aggregate.id,
      result: "SUCCESS",
      correlationId,
      context: { resultingState: "CLOSED", targetVersion: closed.version },
    });
    return true;
  });
}
