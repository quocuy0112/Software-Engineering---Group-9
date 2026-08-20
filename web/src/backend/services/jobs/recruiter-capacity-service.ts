import "server-only";

import { randomUUID } from "node:crypto";
import type { Prisma } from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import { promoteWaitlistedApplicationsInTransaction } from "./application-stage-service";

/**
 * Capacity is an operational recruiter control. It is applied immediately
 * when an existing public job's opening count increases; the rest of the job
 * edit remains in the normal review workflow.
 */
export async function applyRecruiterCapacityIncrease(input: {
  jobId: string;
  companyId: string;
  newCapacity: number;
  actorUserId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const correlationId = randomUUID();

  return prisma.$transaction(async (transaction: Prisma.TransactionClient) => {
    const aggregate = await transaction.jobPostReviewAggregate.findUnique({
      where: { jobId: input.jobId },
      select: { companyId: true, publicJobPostingId: true },
    });
    if (
      !aggregate ||
      aggregate.companyId !== input.companyId ||
      !aggregate.publicJobPostingId
    ) {
      return { changed: false, promoted: [] };
    }

    await transaction.$queryRaw`
      SELECT "id"
      FROM "JobPosting"
      WHERE "id" = ${aggregate.publicJobPostingId}
      FOR UPDATE
    `;
    const publicJob = await transaction.jobPosting.findUnique({
      where: { id: aggregate.publicJobPostingId },
      select: {
        id: true,
        companyId: true,
        status: true,
        numberOfHires: true,
      },
    });
    if (
      !publicJob ||
      publicJob.companyId !== input.companyId ||
      publicJob.status !== "ACTIVE"
    ) {
      return { changed: false, promoted: [] };
    }

    const previousCapacity = publicJob.numberOfHires;
    if (
      input.newCapacity < 1 ||
      (previousCapacity !== null && input.newCapacity <= previousCapacity)
    ) {
      return { changed: false, promoted: [] };
    }

    await transaction.jobPosting.update({
      where: { id: publicJob.id },
      data: {
        numberOfHires: input.newCapacity,
        version: { increment: 1 },
      },
    });
    const promoted = await promoteWaitlistedApplicationsInTransaction({
      db: transaction,
      jobPostingId: publicJob.id,
      previousCapacity,
      newCapacity: input.newCapacity,
      correlationId,
      now,
    });
    await new PrismaAuditRepository(transaction).append({
      occurredAt: now,
      actorType: "user",
      actorUserId: input.actorUserId,
      actorSessionId: null,
      action: "job_posting.capacity_changed",
      targetType: "job_posting",
      targetId: publicJob.id,
      result: "SUCCESS",
      correlationId,
      context: {
        reason: "RECRUITER_CAPACITY_EDIT",
        kind: "IMMEDIATE_OPERATIONAL_CAPACITY",
        capacity: input.newCapacity,
        count: promoted.length,
      },
    });
    return {
      changed: true,
      previousCapacity,
      newCapacity: input.newCapacity,
      promoted,
    };
  });
}
