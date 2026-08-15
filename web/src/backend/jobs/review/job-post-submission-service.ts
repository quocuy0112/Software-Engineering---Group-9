import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/backend/database/prisma";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import { PrismaJobPostReviewRepository } from "@/backend/repositories/jobs/prisma-job-post-review-repository";
import { notifyActionableAdministrators } from "@/backend/notifications/admin-notification-fanout";
import { readRecruiterJobReviewSource } from "@/backend/services/jobs/recruiter-job-posting-data";
import {
  JOB_REVIEW_SNAPSHOT_SCHEMA_VERSION,
  jobReviewSnapshotFromCatalog,
  jobReviewSnapshotSha256,
} from "./job-post-review-policy";
import { projectJobReviewSnapshot } from "./job-post-publication-projector";
import { JobPostReviewError } from "./job-post-review-errors";

const requestHash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export class JobPostSubmissionService {
  async submit(input: {
    actorUserId: string;
    actorSessionId: string;
    jobId: string;
    expectedWorkingUpdatedAt: string;
    idempotencyKey: string;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    const { job, membership } = await readRecruiterJobReviewSource(
      input.actorUserId,
      input.jobId,
    ).catch(() => {
      throw new JobPostReviewError(
        "JOB_POST_REVIEW_UNAVAILABLE",
        "Review unavailable.",
      );
    });
    if (job.updatedAt !== input.expectedWorkingUpdatedAt)
      throw new JobPostReviewError(
        "JOB_POST_REVIEW_CONFLICT",
        "The working job changed. Reload and try again.",
      );
    if (job.status !== "draft" && job.status !== "rejected")
      throw new JobPostReviewError(
        "JOB_POST_REVIEW_CONFLICT",
        "The job cannot be submitted in its current state.",
      );

    const snapshot = jobReviewSnapshotFromCatalog(job, membership.companyId);
    projectJobReviewSnapshot(snapshot);
    const snapshotSha256 = jobReviewSnapshotSha256(snapshot);
    const submissionRequestHash = requestHash(
      JSON.stringify({
        jobId: input.jobId,
        expectedWorkingUpdatedAt: input.expectedWorkingUpdatedAt,
        snapshotSha256,
      }),
    );
    const correlationId = randomUUID();

    return prisma.$transaction(async (transaction) => {
      const reviews = new PrismaJobPostReviewRepository(transaction);
      const replay = await reviews.findSubmissionReplay(
        input.actorUserId,
        input.idempotencyKey,
      );
      if (replay) {
        if (
          replay.submissionRequestHash !== submissionRequestHash ||
          replay.aggregate.jobId !== input.jobId
        )
          throw new JobPostReviewError(
            "JOB_POST_REVIEW_CONFLICT",
            "Idempotency key already belongs to another request.",
          );
        return {
          reviewId: replay.id,
          jobId: replay.aggregate.jobId,
          sequence: replay.sequence,
          state: replay.state,
          readOnly: replay.state === "PENDING_REVIEW",
          submittedAt: replay.submittedAt.toISOString(),
          version: replay.aggregate.version,
        };
      }

      const eligible = await transaction.companyMembership.findFirst({
        where: {
          id: membership.id,
          userId: input.actorUserId,
          companyId: membership.companyId,
          status: "ACTIVE",
          user: { state: "ACTIVE", deletedAt: null },
          company: {
            verificationState: "ACTIVE",
            verifiedAt: { not: null },
            verificationInactiveAt: null,
          },
        },
        select: { id: true },
      });
      if (!eligible)
        throw new JobPostReviewError(
          "JOB_POST_REVIEW_UNAVAILABLE",
          "Review unavailable.",
        );

      let aggregate = await transaction.jobPostReviewAggregate.findUnique({
        where: { jobId: input.jobId },
      });
      let sequence: number;
      if (!aggregate) {
        aggregate = await transaction.jobPostReviewAggregate.create({
          data: {
            jobId: input.jobId,
            companyId: membership.companyId,
            latestSequence: 1,
            adoptedAt: now,
          },
        });
        sequence = 1;
      } else {
        if (
          aggregate.companyId !== membership.companyId ||
          aggregate.pendingVersionId
        )
          throw new JobPostReviewError(
            "JOB_POST_REVIEW_CONFLICT",
            "A review is already pending.",
            aggregate.version,
          );
        sequence = aggregate.latestSequence + 1;
      }

      const reviewId = randomUUID();
      await reviews.createPendingVersion({
        aggregateId: aggregate.id,
        expectedAggregateVersion: aggregate.version,
        reviewId,
        sequence,
        snapshot,
        snapshotSchemaVersion: JOB_REVIEW_SNAPSHOT_SCHEMA_VERSION,
        snapshotSha256,
        submittedByUserId: input.actorUserId,
        submittedMembershipId: membership.id,
        submissionIdempotencyKey: input.idempotencyKey,
        submissionRequestHash,
        submittedAt: now,
        correlationId,
        historyAction: sequence === 1 ? "SUBMITTED" : "RESUBMITTED",
      });
      await new PrismaAuditRepository(transaction).append({
        occurredAt: now,
        actorType: "user",
        actorUserId: input.actorUserId,
        actorSessionId: input.actorSessionId,
        action: "job_post_review.submitted",
        targetType: "job_post_review",
        targetId: reviewId,
        result: "SUCCESS",
        correlationId,
        context: {
          resultingState: "PENDING_REVIEW",
          targetVersion: aggregate.version + 1,
        },
      });
      await notifyActionableAdministrators(transaction, {
        kind: "JOB_POST_REVIEW_REQUESTED_ADMIN",
        eventKey: reviewId,
        correlationId,
        occurredAt: now,
        contextType: "JOB_POST_REVIEW",
        contextId: reviewId,
        state: "PENDING_REVIEW",
      });
      return {
        reviewId,
        jobId: input.jobId,
        sequence,
        state: "PENDING_REVIEW" as const,
        readOnly: true,
        submittedAt: now.toISOString(),
        version: aggregate.version + 1,
      };
    });
  }
}
