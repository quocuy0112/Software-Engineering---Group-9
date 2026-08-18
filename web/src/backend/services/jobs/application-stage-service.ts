import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/backend/database/prisma";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import { RecruiterApplicationAuthorization } from "@/backend/applications/authorization/recruiter-application-authorization";
import {
  applicationStageSchema,
  applicationStageTransitionOutcomeSchema,
  applicationStageTransitionSchema,
  type ApplicationStageTransition,
} from "@/shared/contracts/jobs/applications";
import type { CandidateActor } from "./job-types";
import { JobServiceError } from "./job-types";
import { canTransitionApplicationStage } from "./application-stage-policy";
import { createInAppNotification } from "@/backend/notifications/notification-service";
import {
  publicOutcomeForCanonicalStage,
  publicUpdateKindForCanonicalStage,
  publicUpdateTitleForCanonicalStage,
  publicStageForCanonicalStage,
} from "@/shared/contracts/candidate-applications";

const allowedRoles = new Set([
  "OWNER",
  "HR_MANAGER",
  "RECRUITER",
  "HIRING_MANAGER",
]);

function isSerializationConflict(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2034"
  );
}

export class ApplicationStageService {
  constructor(
    private readonly db: typeof prisma = prisma,
    private readonly recruiterAuthorization = new RecruiterApplicationAuthorization(
      db,
    ),
  ) {}

  async transition(
    actor: CandidateActor,
    applicationId: string,
    rawCommand: ApplicationStageTransition,
    now = new Date(),
  ) {
    const command = applicationStageTransitionSchema.parse(rawCommand);
    if (
      (command.targetStage === "REJECTED" ||
        command.targetStage === "OFFER_DECLINED") &&
      !command.reasonCode
    ) {
      throw new JobServiceError(400, {
        code: "APPLICATION_STAGE_REASON_REQUIRED",
        message: "Choose a reason for this stage change.",
      });
    }

    try {
      return await this.db.$transaction(
      async (tx) => {
        const application = await tx.jobApplication.findUnique({
          where: { id: applicationId },
          select: {
            id: true,
            jobPostingId: true,
            stage: true,
            stageVersion: true,
            withdrawalOutcome: true,
            candidateUserId: true,
            candidate: {
              select: {
                user: {
                  select: {
                    preferences: {
                      select: { applicationUpdatesEmail: true },
                    },
                  },
                },
              },
            },
            jobPosting: {
              select: {
                companyId: true,
                title: true,
                company: { select: { displayName: true } },
              },
            },
            notificationPreference: {
              select: { emailEnabled: true, inAppEnabled: true },
            },
          },
        });
        if (!application) {
          throw new JobServiceError(404, {
            code: "APPLICATION_NOT_FOUND",
            message: "This application is unavailable.",
          });
        }

        const membership = await tx.companyMembership.findUnique({
          where: {
            companyId_userId: {
              companyId: application.jobPosting.companyId,
              userId: actor.userId,
            },
          },
          select: { role: true, status: true },
        });
        const hasDatabaseRecruiterMembership =
          membership?.status === "ACTIVE" && allowedRoles.has(membership.role);
        // Legacy catalog-backed jobs are authorized through the same bridge
        // used by recruiter candidate/scoring reads. Keep the canonical stage
        // writer aligned with that authorization path when the migrated
        // CompanyMembership row has not been created yet.
        const hasCompatibleRecruiterAuthorization =
          hasDatabaseRecruiterMembership ||
          (
            await this.recruiterAuthorization.authorizeApplication(
              actor.userId,
              application.jobPostingId,
              application.id,
            )
          ).authorized;
        if (!hasCompatibleRecruiterAuthorization) {
          throw new JobServiceError(404, {
            code: "APPLICATION_NOT_FOUND",
            message: "This application is unavailable.",
          });
        }

        const fromStage = applicationStageSchema.parse(application.stage);
        if (application.stageVersion !== command.expectedVersion) {
          throw new JobServiceError(409, {
            code: "APPLICATION_STAGE_CONFLICT",
            message: "This application changed. Refresh it and try again.",
          });
        }
        if (application.withdrawalOutcome) {
          throw new JobServiceError(409, {
            code: "APPLICATION_WITHDRAWAL_BLOCKED",
            message: "This application has been withdrawn.",
          });
        }
        if (!canTransitionApplicationStage(fromStage, command.targetStage)) {
          throw new JobServiceError(409, {
            code: "APPLICATION_STAGE_TRANSITION_INVALID",
            message: "This stage change is not allowed.",
          });
        }

        const nextVersion = application.stageVersion + 1;
        const updated = await tx.jobApplication.updateMany({
          where: {
            id: application.id,
            stage: fromStage,
            stageVersion: command.expectedVersion,
            withdrawalOutcome: null,
          },
          data: {
            stage: command.targetStage,
            stageVersion: { increment: 1 },
            lastStageChangedAt: now,
          },
        });
        if (updated.count !== 1) {
          throw new JobServiceError(409, {
            code: "APPLICATION_STAGE_CONFLICT",
            message: "This application changed. Refresh it and try again.",
          });
        }

        const event = await tx.applicationStageEvent.create({
          data: {
            applicationId: application.id,
            fromStage,
            toStage: command.targetStage,
            actorUserId: actor.userId,
            actorType: "RECRUITER",
            reasonCode: command.reasonCode ?? null,
            candidateVisibleReason: command.candidateVisibleReason ?? null,
            candidateVisible: true,
            occurredAt: now,
            applicationVersion: nextVersion,
            metadata: { v: 1, source: "recruiter-stage-command" },
          },
        });

        const publicStage = publicStageForCanonicalStage(command.targetStage);
        await tx.applicationPublicUpdate.create({
          data: {
            applicationId: application.id,
            kind: publicUpdateKindForCanonicalStage(command.targetStage),
            publicStage,
            publicOutcome: publicOutcomeForCanonicalStage(command.targetStage),
            title: publicUpdateTitleForCanonicalStage(command.targetStage),
            effectiveAt: now,
            deduplicationKey: `application:${application.id}:public:stage:${nextVersion}`,
            sourceEventReference: event.id,
          },
        });

        const inAppUpdatesEnabled =
          application.notificationPreference?.inAppEnabled ?? true;
        if (inAppUpdatesEnabled) {
          await createInAppNotification(tx, {
            recipientUserId: application.candidateUserId,
            kind: "APPLICATION_STAGE_CHANGED",
            deduplicationKey: `application:${application.id}:stage:${nextVersion}:candidate`,
            correlationId: event.id,
            occurredAt: now,
            contextType: "APPLICATION",
            contextId: application.id,
            variables: { stage: command.targetStage },
          });
        }

        const emailUpdatesEnabled =
          application.notificationPreference?.emailEnabled ??
          application.candidate.user.preferences?.applicationUpdatesEmail ??
          true;
        if (emailUpdatesEnabled) {
          await tx.emailOutbox.create({
            data: {
              kind: "APPLICATION_STAGE_CHANGED",
              userId: application.candidateUserId,
              recipientRef: application.candidateUserId,
              templateVersion: "application-stage-changed.v1",
              payloadRef: {
                v: 1,
                applicationId: application.id,
                stage: command.targetStage,
                jobTitle: application.jobPosting.title,
                companyName: application.jobPosting.company.displayName,
              },
              idempotencyKey: `application:${application.id}:stage:${nextVersion}:email`,
            },
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
            fromStage,
            toStage: command.targetStage,
            applicationVersion: nextVersion,
            notificationWorkCount:
              Number(inAppUpdatesEnabled) + Number(emailUpdatesEnabled),
          },
        });

        return applicationStageTransitionOutcomeSchema.parse({
          applicationId: application.id,
          fromStage,
          stage: command.targetStage,
          stageVersion: nextVersion,
          lastStageChangedAt: now.toISOString(),
          eventId: event.id,
        });
      },
      { isolationLevel: "Serializable" },
      );
    } catch (error) {
      if (isSerializationConflict(error)) {
        throw new JobServiceError(409, {
          code: "APPLICATION_STAGE_CONFLICT",
          message: "This application changed. Refresh it and try again.",
        });
      }
      throw error;
    }
  }
}
