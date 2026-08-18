import "server-only";

import { randomUUID } from "node:crypto";
import { prisma } from "@/backend/database/prisma";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import { createInAppNotification } from "@/backend/notifications/notification-service";
import {
  offerResponseCommandSchema,
  offerResponseOutcomeSchema,
  publicOutcomeForCanonicalStage,
  publicStageForCanonicalStage,
  publicUpdateKindForCanonicalStage,
  publicUpdateTitleForCanonicalStage,
  type OfferResponseCommand,
  type OfferResponseOutcome,
} from "@/shared/contracts/candidate-applications";
import { applicationStageSchema } from "@/shared/contracts/jobs/applications";
import type { CandidateActor } from "@/backend/services/jobs/job-types";
import { CandidateApplicationError } from "./candidate-application-errors";

function isSerializationConflict(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2034"
  );
}

function targetStage(command: OfferResponseCommand) {
  return command.decision === "ACCEPT" ? "HIRED" : "OFFER_DECLINED";
}

function responseReason(command: OfferResponseCommand) {
  return command.decision === "ACCEPT"
    ? "CANDIDATE_ACCEPTED_OFFER"
    : "CANDIDATE_DECLINED_OFFER";
}

function responseReasonLabel(command: OfferResponseCommand) {
  return command.decision === "ACCEPT"
    ? "Candidate accepted the offer"
    : "Candidate declined the offer";
}

function outcome(row: {
  applicationId: string;
  eventId: string;
  fromStage: string | null;
  toStage: string;
  applicationVersion: number;
  occurredAt: Date;
}) {
  const fromStage = applicationStageSchema.parse(row.fromStage);
  const stage = applicationStageSchema.parse(row.toStage);
  if (fromStage !== "OFFERED" || !["HIRED", "OFFER_DECLINED"].includes(stage)) {
    throw new CandidateApplicationError(
      409,
      "APPLICATION_OFFER_RESPONSE_UNAVAILABLE",
      "This offer response is no longer available.",
    );
  }
  return offerResponseOutcomeSchema.parse({
    applicationId: row.applicationId,
    fromStage,
    stage,
    stageVersion: row.applicationVersion,
    lastStageChangedAt: row.occurredAt.toISOString(),
    eventId: row.eventId,
  });
}

export class CandidateOfferResponseService {
  async respond(
    actor: CandidateActor,
    applicationId: string,
    idempotencyKey: string,
    rawCommand: unknown,
    now = new Date(),
  ): Promise<OfferResponseOutcome> {
    const command = offerResponseCommandSchema.parse(rawCommand);
    if (
      !idempotencyKey ||
      idempotencyKey.length < 16 ||
      idempotencyKey.length > 128
    ) {
      throw new CandidateApplicationError(
        400,
        "APPLICATION_IDEMPOTENCY_KEY_INVALID",
        "Refresh the application and try again.",
      );
    }

    try {
      return await prisma.$transaction(
        async (tx) => {
          const replay = await tx.applicationStageEvent.findFirst({
            where: {
              applicationId,
              idempotencyKey,
              application: { candidateUserId: actor.userId },
            },
            select: {
              id: true,
              fromStage: true,
              toStage: true,
              applicationVersion: true,
              occurredAt: true,
            },
          });
          if (replay) {
            return outcome({
              ...replay,
              applicationId,
              eventId: replay.id,
            });
          }

          const application = await tx.jobApplication.findFirst({
            where: { id: applicationId, candidateUserId: actor.userId },
            select: {
              id: true,
              stage: true,
              stageVersion: true,
              withdrawalOutcome: true,
              candidateUserId: true,
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
          if (application.withdrawalOutcome) {
            throw new CandidateApplicationError(
              409,
              "APPLICATION_OFFER_RESPONSE_BLOCKED",
              "This application has been withdrawn.",
            );
          }
          if (application.stage !== "OFFERED") {
            throw new CandidateApplicationError(
              409,
              "APPLICATION_OFFER_RESPONSE_UNAVAILABLE",
              "This offer response is no longer available.",
            );
          }
          if (application.stageVersion !== command.expectedVersion) {
            throw new CandidateApplicationError(
              409,
              "APPLICATION_STAGE_CONFLICT",
              "This application changed. Refresh it and try again.",
            );
          }

          const nextStage = targetStage(command);
          const nextVersion = application.stageVersion + 1;
          const updated = await tx.jobApplication.updateMany({
            where: {
              id: application.id,
              candidateUserId: actor.userId,
              stage: "OFFERED",
              stageVersion: command.expectedVersion,
              withdrawalOutcome: null,
            },
            data: {
              stage: nextStage,
              stageVersion: { increment: 1 },
              lastStageChangedAt: now,
            },
          });
          if (updated.count !== 1) {
            throw new CandidateApplicationError(
              409,
              "APPLICATION_STAGE_CONFLICT",
              "This application changed. Refresh it and try again.",
            );
          }

          const event = await tx.applicationStageEvent.create({
            data: {
              applicationId: application.id,
              fromStage: "OFFERED",
              toStage: nextStage,
              actorUserId: actor.userId,
              actorType: "CANDIDATE",
              reasonCode: responseReason(command),
              reasonLabelSnapshot: responseReasonLabel(command),
              candidateVisibleReason: responseReasonLabel(command),
              candidateVisible: true,
              occurredAt: now,
              applicationVersion: nextVersion,
              idempotencyKey,
              metadata: {
                v: 1,
                source: "candidate-offer-response",
                decision: command.decision,
              },
            },
          });

          await tx.applicationPublicUpdate.create({
            data: {
              applicationId: application.id,
              kind: publicUpdateKindForCanonicalStage(nextStage),
              publicStage: publicStageForCanonicalStage(nextStage),
              publicOutcome: publicOutcomeForCanonicalStage(nextStage),
              title: publicUpdateTitleForCanonicalStage(nextStage),
              effectiveAt: now,
              deduplicationKey: `application:${application.id}:public:stage:${nextVersion}`,
              sourceEventReference: event.id,
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
                event: "CANDIDATE_OFFER_RESPONSE",
                decision: command.decision,
                applicationId: application.id,
                stage: nextStage,
                jobTitle: application.jobPosting.title,
                companyName: application.jobPosting.company.displayName,
              },
              idempotencyKey: `application:${application.id}:offer-response:${nextVersion}:company`,
            },
          });

          if (application.notificationPreference?.inAppEnabled ?? true) {
            await createInAppNotification(tx, {
              recipientUserId: application.candidateUserId,
              kind: "APPLICATION_STAGE_CHANGED",
              deduplicationKey: `application:${application.id}:stage:${nextVersion}:candidate`,
              correlationId: event.id,
              occurredAt: now,
              contextType: "APPLICATION",
              contextId: application.id,
              variables: { stage: nextStage },
            });
          }

          await new PrismaAuditRepository(tx).append({
            occurredAt: now,
            actorType: "user",
            actorUserId: actor.userId,
            actorSessionId: actor.sessionId,
            action: "job.application.stage_changed",
            targetType: "job_application",
            targetId: application.id,
            result: "SUCCESS",
            correlationId: randomUUID(),
            context: {
              fromStage: "OFFERED",
              toStage: nextStage,
              reason: responseReason(command),
              applicationVersion: nextVersion,
            },
          });

          return offerResponseOutcomeSchema.parse({
            applicationId: application.id,
            fromStage: "OFFERED",
            stage: nextStage,
            stageVersion: nextVersion,
            lastStageChangedAt: now.toISOString(),
            eventId: event.id,
          });
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      if (isSerializationConflict(error)) {
        throw new CandidateApplicationError(
          409,
          "APPLICATION_STAGE_CONFLICT",
          "This application changed. Refresh it and try again.",
        );
      }
      throw error;
    }
  }
}
