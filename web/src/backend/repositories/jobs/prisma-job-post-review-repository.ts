import "server-only";
import { Prisma } from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";
import type { JobPostReviewState } from "@/shared/contracts/admin/job-post-review";

type ReviewDb = typeof prisma | Prisma.TransactionClient;

const reviewDetailInclude = {
  aggregate: {
    include: {
      company: {
        select: {
          id: true,
          displayName: true,
          verificationState: true,
          verificationInactiveAt: true,
        },
      },
      approvedVersion: { select: { id: true, snapshot: true } },
    },
  },
  submittedBy: { select: { id: true, name: true, state: true } },
  submittedMembership: { select: { id: true, status: true, role: true } },
  history: { orderBy: [{ occurredAt: "asc" }, { id: "asc" }] },
  privateNotes: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
} satisfies Prisma.JobPostReviewVersionInclude;

export type JobPostReviewDetailRow = Prisma.JobPostReviewVersionGetPayload<{
  include: typeof reviewDetailInclude;
}>;

export class PrismaJobPostReviewRepository {
  constructor(private readonly db: ReviewDb = prisma) {}

  withTransaction(transaction: Prisma.TransactionClient) {
    return new PrismaJobPostReviewRepository(transaction);
  }

  findAggregateByJobId(jobId: string) {
    return this.db.jobPostReviewAggregate.findUnique({
      where: { jobId },
      include: {
        pendingVersion: true,
        approvedVersion: true,
        publicJobPosting: true,
      },
    });
  }

  findReviewDetail(reviewId: string): Promise<JobPostReviewDetailRow | null> {
    return this.db.jobPostReviewVersion.findUnique({
      where: { id: reviewId },
      include: reviewDetailInclude,
    });
  }

  findSubmissionReplay(actorUserId: string, idempotencyKey: string) {
    return this.db.jobPostReviewVersion.findUnique({
      where: {
        submittedByUserId_submissionIdempotencyKey: {
          submittedByUserId: actorUserId,
          submissionIdempotencyKey: idempotencyKey,
        },
      },
      include: { aggregate: true },
    });
  }

  listPending(input: {
    assignedAdminUserId?: string | null;
    take: number;
    cursorId?: string;
  }) {
    return this.db.jobPostReviewVersion.findMany({
      where: {
        state: "PENDING_REVIEW",
        ...(input.assignedAdminUserId === undefined
          ? {}
          : { assignedAdminUserId: input.assignedAdminUserId }),
      },
      include: {
        aggregate: {
          include: { company: { select: { id: true, displayName: true } } },
        },
      },
      orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
      take: input.take,
      ...(input.cursorId
        ? { cursor: { id: input.cursorId }, skip: 1 }
        : undefined),
    });
  }

  async listReviewQueue(input: {
    page: number;
    perPage: number;
    state?: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
    companyId?: string;
    assignedAdminUserId?: string | null;
    submittedBefore?: Date;
    sequence?: number;
  }) {
    const where: Prisma.JobPostReviewVersionWhereInput = {
      state: input.state ?? "PENDING_REVIEW",
      ...(input.companyId ? { aggregate: { companyId: input.companyId } } : {}),
      ...(input.assignedAdminUserId !== undefined
        ? { assignedAdminUserId: input.assignedAdminUserId }
        : {}),
      ...(input.submittedBefore
        ? { submittedAt: { lte: input.submittedBefore } }
        : {}),
      ...(input.sequence ? { sequence: input.sequence } : {}),
    };
    const [rows, total] = await Promise.all([
      this.db.jobPostReviewVersion.findMany({
        where,
        include: {
          aggregate: {
            include: { company: { select: { id: true, displayName: true } } },
          },
        },
        orderBy: [
          { assignedAdminUserId: { sort: "asc", nulls: "first" } },
          { submittedAt: "asc" },
          { id: "asc" },
        ],
        skip: (input.page - 1) * input.perPage,
        take: input.perPage,
      }),
      this.db.jobPostReviewVersion.count({ where }),
    ]);
    return { rows, total };
  }

  async createPendingVersion(input: {
    aggregateId: string;
    expectedAggregateVersion: number;
    reviewId: string;
    sequence: number;
    snapshot: Prisma.InputJsonValue;
    snapshotSchemaVersion: string;
    snapshotSha256: string;
    submittedByUserId: string;
    submittedMembershipId: string;
    submissionIdempotencyKey: string;
    submissionRequestHash: string;
    submittedAt: Date;
    correlationId: string;
    historyAction: "SUBMITTED" | "RESUBMITTED";
  }) {
    const version = await this.db.jobPostReviewVersion.create({
      data: {
        id: input.reviewId,
        reviewAggregateId: input.aggregateId,
        sequence: input.sequence,
        snapshot: input.snapshot,
        snapshotSchemaVersion: input.snapshotSchemaVersion,
        snapshotSha256: input.snapshotSha256,
        submittedByUserId: input.submittedByUserId,
        submittedMembershipId: input.submittedMembershipId,
        submissionIdempotencyKey: input.submissionIdempotencyKey,
        submissionRequestHash: input.submissionRequestHash,
        submittedAt: input.submittedAt,
      },
    });
    const aggregateUpdate = await this.db.jobPostReviewAggregate.updateMany({
      where: {
        id: input.aggregateId,
        version: input.expectedAggregateVersion,
        pendingVersionId: null,
      },
      data: {
        pendingVersionId: version.id,
        latestSequence: input.sequence,
        version: { increment: 1 },
      },
    });
    if (aggregateUpdate.count !== 1)
      throw new Error("JOB_POST_REVIEW_CONFLICT");
    await this.db.jobPostReviewHistory.create({
      data: {
        reviewVersionId: version.id,
        action: input.historyAction,
        actorUserId: input.submittedByUserId,
        resultingState: "PENDING_REVIEW",
        resultingAggregateVersion: input.expectedAggregateVersion + 1,
        correlationId: input.correlationId,
        occurredAt: input.submittedAt,
      },
    });
    return version;
  }

  async assignPending(input: {
    reviewId: string;
    expectedAssigneeUserId: string | null;
    targetAdminUserId: string;
    assignedAt: Date;
  }) {
    const result = await this.db.jobPostReviewVersion.updateMany({
      where: {
        id: input.reviewId,
        state: "PENDING_REVIEW",
        assignedAdminUserId: input.expectedAssigneeUserId,
      },
      data: {
        assignedAdminUserId: input.targetAdminUserId,
        assignedAt: input.assignedAt,
      },
    });
    if (result.count !== 1) throw new Error("JOB_POST_REVIEW_CONFLICT");
  }

  async assertState(reviewId: string, state: JobPostReviewState) {
    const row = await this.db.jobPostReviewVersion.findFirst({
      where: { id: reviewId, state },
      select: { id: true },
    });
    if (!row) throw new Error("JOB_POST_REVIEW_UNAVAILABLE");
  }
}
