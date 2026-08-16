import "server-only";
import {
  Prisma,
  type Prisma as PrismaTypes,
} from "@/backend/generated/prisma/client";
import { FEATURED_PLACEMENT_CAPACITY } from "@/backend/jobs/management/job-post-management-policy";

type Transaction = PrismaTypes.TransactionClient;

export async function findManagedJobPostForCommand(
  tx: Transaction,
  jobId: string,
) {
  return tx.jobPostReviewAggregate.findUnique({
    where: { jobId },
    include: {
      publicJobPosting: {
        select: { id: true, applicationDeadline: true },
      },
      approvedVersion: { select: { submittedByUserId: true } },
    },
  });
}

export async function syncManagedJobPublicProjection(
  tx: Transaction,
  input: {
    publicJobPostingId: string;
    visibility: "PUBLISHED" | "HIDDEN" | "ARCHIVED";
    applicationState: "OPEN" | "CLOSED";
    now: Date;
  },
) {
  const status =
    input.visibility === "PUBLISHED"
      ? input.applicationState === "OPEN"
        ? "ACTIVE"
        : "CLOSED"
      : "REMOVED";
  return tx.jobPosting.update({
    where: { id: input.publicJobPostingId },
    data: {
      status,
      closedAt: input.applicationState === "CLOSED" ? input.now : null,
      removedAt: input.visibility === "PUBLISHED" ? null : input.now,
      version: { increment: 1 },
    },
  });
}

export async function reserveManagedJobFeaturePlacement(
  tx: Transaction,
  input: {
    aggregateId: string;
    featureId?: string;
    placement: "HOME_FEATURED" | "SEARCH_FEATURED";
    startsAt: Date;
    endsAt: Date;
    priority: number;
    reason: string;
    createdByAdminUserId: string;
    now: Date;
  },
) {
  await tx.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${input.placement}))`,
  );
  const booked = await tx.jobPostFeaturedPlacement.count({
    where: {
      placement: input.placement,
      state: { in: ["SCHEDULED", "ACTIVE"] },
      startsAt: { lt: input.endsAt },
      endsAt: { gt: input.startsAt },
      ...(input.featureId ? { id: { not: input.featureId } } : {}),
    },
  });
  if (booked >= FEATURED_PLACEMENT_CAPACITY) {
    throw new Error("FEATURE_CAPACITY_CONFLICT");
  }
  const state = input.startsAt <= input.now ? "ACTIVE" : "SCHEDULED";
  if (!input.featureId) {
    return tx.jobPostFeaturedPlacement.create({
      data: {
        aggregateId: input.aggregateId,
        placement: input.placement,
        priority: input.priority,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        state,
        reason: input.reason,
        createdByAdminUserId: input.createdByAdminUserId,
      },
    });
  }
  const changed = await tx.jobPostFeaturedPlacement.updateMany({
    where: {
      id: input.featureId,
      aggregateId: input.aggregateId,
      state: { in: ["SCHEDULED", "ACTIVE"] },
    },
    data: {
      placement: input.placement,
      priority: input.priority,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      state,
      reason: input.reason,
      version: { increment: 1 },
    },
  });
  if (changed.count !== 1) throw new Error("TARGET_UNAVAILABLE");
  return changed;
}
