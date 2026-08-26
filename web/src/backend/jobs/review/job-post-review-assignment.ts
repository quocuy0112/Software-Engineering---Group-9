import "server-only";

import type { Prisma, PrismaClient } from "@/backend/generated/prisma/client";

type ReviewAssignmentDb = PrismaClient | Prisma.TransactionClient;

async function activeReviewAdministrators(db: ReviewAssignmentDb, now: Date) {
  const grants = await db.platformAdministratorGrant.findMany({
    where: {
      state: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      user: { state: "ACTIVE", deletedAt: null },
      scopes: { some: { scope: "JOB_POST_MODERATE" } },
    },
    select: {
      userId: true,
      user: {
        select: {
          _count: {
            select: {
              assignedJobPostReviews: {
                where: { state: "PENDING_REVIEW" },
              },
            },
          },
        },
      },
    },
    orderBy: { userId: "asc" },
  });

  return grants.map((grant) => ({
    userId: grant.userId,
    pendingCount: grant.user._count.assignedJobPostReviews,
  }));
}

export async function leastLoadedReviewAdministrator(
  db: ReviewAssignmentDb,
  now: Date,
) {
  const administrators = await activeReviewAdministrators(db, now);
  return (
    administrators.sort(
      (left, right) =>
        left.pendingCount - right.pendingCount ||
        left.userId.localeCompare(right.userId),
    )[0]?.userId ?? null
  );
}

/**
 * Distributes every currently unassigned pending review across eligible
 * administrators. Conditional updates preserve a concurrent manual claim.
 */
export async function distributeUnassignedPendingReviews(
  db: ReviewAssignmentDb,
  now: Date,
) {
  const [administrators, reviews] = await Promise.all([
    activeReviewAdministrators(db, now),
    db.jobPostReviewVersion.findMany({
      where: { state: "PENDING_REVIEW", assignedAdminUserId: null },
      select: { id: true },
      orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
    }),
  ]);
  if (administrators.length === 0 || reviews.length === 0) return 0;

  const buckets = new Map<string, string[]>();
  for (const review of reviews) {
    administrators.sort(
      (left, right) =>
        left.pendingCount - right.pendingCount ||
        left.userId.localeCompare(right.userId),
    );
    const administrator = administrators[0];
    administrator.pendingCount += 1;
    const bucket = buckets.get(administrator.userId) ?? [];
    bucket.push(review.id);
    buckets.set(administrator.userId, bucket);
  }

  const assignments = await Promise.all(
    [...buckets].map(([assignedAdminUserId, ids]) =>
      db.jobPostReviewVersion.updateMany({
        where: {
          id: { in: ids },
          state: "PENDING_REVIEW",
          assignedAdminUserId: null,
        },
        data: { assignedAdminUserId, assignedAt: now },
      }),
    ),
  );
  return assignments.reduce((total, result) => total + result.count, 0);
}
