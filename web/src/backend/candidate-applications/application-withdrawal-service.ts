import "server-only";

import { randomUUID } from "node:crypto";
import { prisma } from "@/backend/database/prisma";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import { createInAppNotification } from "@/backend/notifications/notification-service";
import {
  publicStageForCanonicalStage,
  withdrawalCommandSchema,
  withdrawalOutcomeSchema,
  type WithdrawalOutcome,
} from "@/shared/contracts/candidate-applications";
import { applicationStageSchema } from "@/shared/contracts/jobs/applications";
import type { CandidateActor } from "@/backend/services/jobs/job-types";
import { CandidateApplicationError } from "./candidate-application-errors";

const withdrawableStages = new Set([
  "APPLIED",
  "VIEWED",
  "SHORTLISTED",
  "WAITLISTED",
] as const);
type WithdrawableStage =
  | "APPLIED"
  | "VIEWED"
  | "SHORTLISTED"
  | "WAITLISTED";

function isSerializationConflict(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2034"
  );
}

function outcome(row: {
  id: string;
  stage: string;
  stageVersion: number;
  withdrawalOutcome: "CANDIDATE_WITHDRAWN" | null;
  withdrawnAt: Date | null;
}): WithdrawalOutcome {
  if (row.withdrawalOutcome !== "CANDIDATE_WITHDRAWN" || !row.withdrawnAt) {
    throw new CandidateApplicationError(
      409,
      "APPLICATION_WITHDRAWAL_UNAVAILABLE",
      "This application can no longer be withdrawn.",
    );
  }
  const preservedStage = applicationStageSchema.parse(row.stage);
  if (!withdrawableStages.has(preservedStage as WithdrawableStage)) {
    throw new CandidateApplicationError(
      409,
      "APPLICATION_WITHDRAWAL_UNAVAILABLE",
      "This application can no longer be withdrawn.",
    );
  }
  return withdrawalOutcomeSchema.parse({
    applicationId: row.id,
    outcome: "WITHDRAWN",
    withdrawnAt: row.withdrawnAt.toISOString(),
    preservedStage,
    version: row.stageVersion,
  });
}

export class ApplicationWithdrawalService {
  async withdraw(
    actor: CandidateActor,
    applicationId: string,
    idempotencyKey: string,
    rawCommand: unknown,
    now = new Date(),
  ) {
    const command = withdrawalCommandSchema.parse(rawCommand);
    if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
      throw new CandidateApplicationError(
        400,
        "APPLICATION_IDEMPOTENCY_KEY_INVALID",
        "Refresh the application and try again.",
      );
    }

    try {
      return await prisma.$transaction(
      async (tx) => {
        const application = await tx.jobApplication.findFirst({
          where: { id: applicationId, candidateUserId: actor.userId },
          select: {
            id: true,
            stage: true,
            stageVersion: true,
            withdrawalOutcome: true,
            withdrawnAt: true,
            jobPosting: {
              select: {
                companyId: true,
                title: true,
                company: { select: { displayName: true } },
              },
            },
            notificationPreference: {
              select: { inAppEnabled: true },
            },
          },
        });
        if (!application) {
          throw new CandidateApplicationError(
            404,
            "APPLICATION_UNAVAILABLE",
            "This application is unavailable.",
          );
        }

        const deduplicationKey = `application:${application.id}:withdrawal:${idempotencyKey}`;
        const replay = await tx.applicationPublicUpdate.findUnique({
          where: { deduplicationKey },
          select: { id: true },
        });
        if (replay) return outcome(application);
        if (application.withdrawalOutcome) return outcome(application);

        const stage = applicationStageSchema.parse(application.stage);
        if (!withdrawableStages.has(stage as WithdrawableStage)) {
          throw new CandidateApplicationError(
            409,
            "APPLICATION_WITHDRAWAL_BLOCKED",
            "You can withdraw only before the interview stage.",
          );
        }
        if (application.stageVersion !== command.expectedVersion) {
          throw new CandidateApplicationError(
            409,
            "APPLICATION_STAGE_CONFLICT",
            "This application changed. Refresh and try again.",
          );
        }

        const updated = await tx.jobApplication.updateMany({
          where: {
            id: application.id,
            candidateUserId: actor.userId,
            stage,
            stageVersion: command.expectedVersion,
            withdrawalOutcome: null,
          },
          data: {
            withdrawalOutcome: "CANDIDATE_WITHDRAWN",
            withdrawnAt: now,
            withdrawnByUserId: actor.userId,
            withdrawalVersion: application.stageVersion,
            activeProcessingStoppedAt: now,
          },
        });
        if (updated.count !== 1) {
          throw new CandidateApplicationError(
            409,
            "APPLICATION_STAGE_CONFLICT",
            "This application changed. Refresh and try again.",
          );
        }

        await tx.applicationPublicUpdate.create({
          data: {
            applicationId: application.id,
            kind: "WITHDRAWN",
            publicStage: publicStageForCanonicalStage(stage),
            publicOutcome: "WITHDRAWN",
            title: "Application withdrawn",
            effectiveAt: now,
            deduplicationKey,
            sourceEventReference: null,
          },
        });
        await tx.recruitmentNotificationWork.create({
          data: {
            applicationId: application.id,
            audience: "COMPANY",
            kind: "APPLICATION_STAGE_CHANGED",
            targetReference: application.jobPosting.companyId,
            payloadRef: {
              v: 1,
              event: "CANDIDATE_WITHDRAWN",
              applicationId: application.id,
              jobTitle: application.jobPosting.title,
              companyName: application.jobPosting.company.displayName,
            },
            idempotencyKey: `application:${application.id}:withdrawal:recruiter`,
          },
        });
        if (application.notificationPreference?.inAppEnabled ?? true) {
          await createInAppNotification(tx, {
            recipientUserId: actor.userId,
            kind: "APPLICATION_STAGE_CHANGED",
            deduplicationKey: `application:${application.id}:withdrawal:candidate`,
            correlationId: randomUUID(),
            occurredAt: now,
            contextType: "APPLICATION",
            contextId: application.id,
            variables: { stage: "WITHDRAWN" },
          });
        }
        await new PrismaAuditRepository(tx).append({
          occurredAt: now,
          actorType: "user",
          actorUserId: actor.userId,
          actorSessionId: actor.sessionId,
          action: "job.application.withdrawn",
          targetType: "job_application",
          targetId: application.id,
          result: "SUCCESS",
          correlationId: randomUUID(),
          context: {
            preservedStage: stage,
            applicationVersion: application.stageVersion,
            outcome: "CANDIDATE_WITHDRAWN",
          },
        });
        return outcome({
          ...application,
          withdrawalOutcome: "CANDIDATE_WITHDRAWN" as const,
          withdrawnAt: now,
        });
      },
      { isolationLevel: "Serializable" },
      );
    } catch (error) {
      if (isSerializationConflict(error)) {
        throw new CandidateApplicationError(
          409,
          "APPLICATION_STAGE_CONFLICT",
          "This application changed. Refresh and try again.",
        );
      }
      throw error;
    }
  }
}
