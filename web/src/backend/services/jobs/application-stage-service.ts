import "server-only";

import { createHash } from "node:crypto";
import { prisma } from "@/backend/database/prisma";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import { RecruiterApplicationAuthorization } from "@/backend/applications/authorization/recruiter-application-authorization";
import {
  applicationStageSchema,
  applicationStageTransitionOutcomeSchema,
  applicationStageTransitionSchema,
  rejectionReasonCodeSchema,
  stageTransitionCommandSchema,
  stageTransitionOutcomeSchema,
  type ApplicationStage,
  type ApplicationStageTransition,
} from "@/shared/contracts/applications";
import type { CandidateActor } from "./job-types";
import { JobServiceError } from "./job-types";
import {
  canTransitionApplicationStage,
  ordinaryApplicationTransitions,
} from "./application-stage-policy";
import { createInAppNotification } from "@/backend/notifications/notification-service";
import {
  publicOutcomeForCanonicalStage,
  publicStageForCanonicalStage,
} from "@/shared/contracts/candidate-applications";

const consequentialStages = new Set<ApplicationStage>([
  "REJECTED",
  "OFFER_DECLINED",
  "HIRED",
]);

const rejectionLabels: Record<string, string> = {
  REQUIRED_TECHNICAL_EXPERIENCE_NOT_DEMONSTRATED: "Required technical experience not demonstrated",
  INSUFFICIENT_EXPERIENCE: "Insufficient experience",
  REQUIRED_SKILLS_NOT_DEMONSTRATED: "Required skills not demonstrated",
  POSITION_FILLED: "Position filled",
  APPLICATION_WITHDRAWN_BY_CANDIDATE: "Application withdrawn by candidate",
  OTHER_JOB_RELATED_REASON: "Other job-related reason",
};

type PipelineBoundary = Readonly<{
  requestedJobId: string;
  idempotencyKey: string;
  source?: "KANBAN" | "STAGE_ROUTE" | "INTERVIEW_ADAPTER" | "REJECTION_ADAPTER";
}>;

type NormalizedCommand = Readonly<{
  targetStage: ApplicationStage;
  expectedStageVersion: number;
  confirmed: boolean;
  reasonCode: string | null;
  candidateVisibleReason: string | null;
  internalNote: string | null;
}>;

function normalizeText(value: string | null | undefined): string | null {
  const normalized = value?.trim().replace(/\s+/gu, " ") ?? "";
  return normalized || null;
}

function normalizeCommand(raw: ApplicationStageTransition | unknown): NormalizedCommand {
  const pipeline = stageTransitionCommandSchema.safeParse(raw);
  if (pipeline.success) {
    return {
      targetStage: pipeline.data.targetStage,
      expectedStageVersion: pipeline.data.expectedStageVersion,
      confirmed: pipeline.data.confirmed ?? false,
      reasonCode: normalizeText(pipeline.data.reasonCode),
      candidateVisibleReason: null,
      internalNote: normalizeText(pipeline.data.internalNote),
    };
  }
  const legacy = applicationStageTransitionSchema.parse(raw);
  return {
    targetStage: legacy.targetStage,
    expectedStageVersion: legacy.expectedVersion,
    confirmed: false,
    reasonCode: normalizeText(legacy.reasonCode),
    candidateVisibleReason: normalizeText(legacy.candidateVisibleReason),
    internalNote: null,
  };
}

function validateConsequential(command: NormalizedCommand) {
  if (consequentialStages.has(command.targetStage) && !command.confirmed) {
    throw new JobServiceError(400, {
      code: "APPLICATION_STAGE_CONFIRMATION_REQUIRED",
      message: "Confirm this recruitment decision before continuing.",
    });
  }
  if (command.targetStage === "REJECTED") {
    if (!command.reasonCode) {
      throw new JobServiceError(400, {
        code: "APPLICATION_STAGE_REASON_REQUIRED",
        message: "Choose a rejection reason.",
      });
    }
    if (!rejectionReasonCodeSchema.safeParse(command.reasonCode).success) {
      throw new JobServiceError(400, {
        code: "APPLICATION_STAGE_REASON_INVALID",
        message: "Choose a valid rejection reason.",
      });
    }
  }
  if (command.targetStage === "OFFER_DECLINED" && !command.reasonCode) {
    throw new JobServiceError(400, {
      code: "APPLICATION_STAGE_REASON_REQUIRED",
      message: "Record why the offer was declined.",
    });
  }
  if (command.targetStage !== "REJECTED" && command.internalNote) {
    throw new JobServiceError(400, {
      code: "VALIDATION_ERROR",
      message: "Private notes are supported only for rejection decisions.",
    });
  }
}

export function applicationStageCommandDigest(input: {
  actorUserId: string;
  requestedJobId: string;
  canonicalJobId: string;
  applicationId: string;
  command: NormalizedCommand;
  source: string;
}) {
  return createHash("sha256")
    .update(JSON.stringify({ v: 1, ...input }))
    .digest("hex");
}

function eventDigest(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const digest = (metadata as Record<string, unknown>).commandDigest;
  return typeof digest === "string" ? digest : null;
}

export class ApplicationStageService {
  constructor(
    private readonly db: typeof prisma = prisma,
    private readonly authorization = new RecruiterApplicationAuthorization(db),
  ) {}

  async transitionLegacy(
    actor: CandidateActor,
    applicationId: string,
    rawCommand: ApplicationStageTransition | unknown,
    idempotencyKey: string,
    now = new Date(),
  ) {
    const application = await this.db.jobApplication.findUnique({
      where: { id: applicationId },
      select: { jobPostingId: true },
    });
    if (!application) {
      throw new JobServiceError(404, {
        code: "APPLICATION_UNAVAILABLE",
        message: "This application is unavailable.",
      });
    }
    return this.transition(actor, applicationId, rawCommand, now, {
      requestedJobId: application.jobPostingId,
      idempotencyKey,
      source: "STAGE_ROUTE",
    });
  }

  async currentAuthorizedState(
    userId: string,
    requestedJobId: string,
    applicationId: string,
  ) {
    const authorization = await this.authorization.authorizeApplication(
      userId,
      requestedJobId,
      applicationId,
    );
    if (!authorization.authorized) return null;
    return this.db.jobApplication.findFirst({
      where: { id: applicationId, jobPostingId: authorization.jobPostingId },
      select: { stage: true, stageVersion: true },
    });
  }

  async transition(
    actor: CandidateActor,
    applicationId: string,
    rawCommand: ApplicationStageTransition | unknown,
    now = new Date(),
    boundary?: PipelineBoundary,
  ) {
    const command = normalizeCommand(rawCommand);
    if (boundary) validateConsequential(command);
    if (boundary && !boundary.idempotencyKey.trim()) {
      throw new JobServiceError(400, { code: "IDEMPOTENCY_KEY_REQUIRED", message: "An Idempotency-Key is required." });
    }

    const authorized = boundary
      ? await this.authorization.authorizeApplication(actor.userId, boundary.requestedJobId, applicationId)
      : null;
    if (authorized && (!authorized.authorized || !authorized.canMoveStages)) {
      throw new JobServiceError(404, { code: "APPLICATION_UNAVAILABLE", message: "This application is unavailable." });
    }
    const authorizedJobId = authorized?.authorized ? authorized.jobPostingId : null;

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
        if (!application || (authorized && application.jobPostingId !== authorized.jobPostingId)) {
          throw new JobServiceError(404, { code: "APPLICATION_UNAVAILABLE", message: "This application is unavailable." });
        }

        if (!boundary) {
          const membership = await tx.companyMembership.findUnique({
            where: { companyId_userId: { companyId: application.jobPosting.companyId, userId: actor.userId } },
            select: { role: true, status: true },
          });
          if (membership?.status !== "ACTIVE" || membership.role === "OWNER" || !["HR_MANAGER", "RECRUITER", "HIRING_MANAGER"].includes(membership.role)) {
            throw new JobServiceError(404, { code: "APPLICATION_UNAVAILABLE", message: "This application is unavailable." });
          }
        }

        const fromStage = applicationStageSchema.parse(application.stage);
        const source = boundary?.source ?? "STAGE_ROUTE";
        const requestedJobId = boundary?.requestedJobId ?? application.jobPostingId;
        const digest = applicationStageCommandDigest({ actorUserId: actor.userId, requestedJobId, canonicalJobId: application.jobPostingId, applicationId, command, source });
        const idempotencyKey = boundary?.idempotencyKey.trim() || null;

        if (idempotencyKey) {
          const replay = await tx.applicationStageEvent.findFirst({ where: { applicationId, idempotencyKey }, orderBy: { occurredAt: "desc" } });
          if (replay) {
            if (eventDigest(replay.metadata) !== digest) {
              throw new JobServiceError(409, { code: "IDEMPOTENCY_CONFLICT", message: "This Idempotency-Key was used for a different stage decision." });
            }
            return stageTransitionOutcomeSchema.parse({
              applicationId,
              fromStage: replay.fromStage,
              stage: replay.toStage,
              stageVersion: replay.applicationVersion,
              lastStageChangedAt: replay.occurredAt.toISOString(),
              stageEventId: replay.id,
              replayed: true,
              allowedDestinations: ordinaryApplicationTransitions[replay.toStage],
            });
          }
        }

        if (application.stageVersion !== command.expectedStageVersion) {
          throw new JobServiceError(409, { code: "APPLICATION_STAGE_CONFLICT", message: "This application changed. Refresh it and try again." });
        }
        if (application.withdrawalOutcome) {
          throw new JobServiceError(409, {
            code: "APPLICATION_WITHDRAWAL_BLOCKED",
            message: "This application has been withdrawn.",
          });
        }
        if (!canTransitionApplicationStage(fromStage, command.targetStage)) {
          throw new JobServiceError(409, { code: "APPLICATION_STAGE_TRANSITION_INVALID", message: "This stage change is not allowed." });
        }

        const nextVersion = application.stageVersion + 1;
        const updated = await tx.jobApplication.updateMany({
          where: {
            id: application.id,
            jobPostingId: application.jobPostingId,
            stage: fromStage,
            stageVersion: command.expectedStageVersion,
            withdrawalOutcome: null,
          },
          data: {
            stage: command.targetStage,
            stageVersion: { increment: 1 },
            lastStageChangedAt: now,
          },
        });
        if (updated.count !== 1) throw new JobServiceError(409, { code: "APPLICATION_STAGE_CONFLICT", message: "This application changed. Refresh it and try again." });

        const inAppUpdatesEnabled =
          application.notificationPreference?.inAppEnabled ?? true;
        const emailUpdatesEnabled =
          application.notificationPreference?.emailEnabled ??
          application.candidate.user.preferences?.applicationUpdatesEmail ??
          true;
        const emailRequired = command.targetStage === "HIRED" || emailUpdatesEnabled;
        const notificationRequired = inAppUpdatesEnabled || emailRequired;
        const reasonLabelSnapshot = command.targetStage === "REJECTED" && command.reasonCode ? rejectionLabels[command.reasonCode] : command.reasonCode;
        const event = await tx.applicationStageEvent.create({
          data: {
            applicationId: application.id,
            fromStage,
            toStage: command.targetStage,
            actorUserId: actor.userId,
            actorType: "RECRUITER",
            reasonCode: command.reasonCode,
            reasonLabelSnapshot,
            internalNoteEncrypted: command.internalNote,
            candidateVisibleReason: command.candidateVisibleReason,
            candidateVisible: true,
            occurredAt: now,
            applicationVersion: nextVersion,
            notificationRequired,
            notificationStatus: notificationRequired ? "PENDING" : "NOT_REQUIRED",
            idempotencyKey,
            decisionKind: command.targetStage === "REJECTED" ? "REJECT" : command.targetStage === "INTERVIEWING" ? "MOVE_TO_INTERVIEW" : null,
            metadata: { v: 2, source, commandDigest: digest, requestedJobId, canonicalJobId: application.jobPostingId, confirmed: command.confirmed },
          },
        });

        const publicStage = publicStageForCanonicalStage(command.targetStage);
        const publicKind =
          publicStage === "UNDER_REVIEW"
            ? "UNDER_REVIEW"
            : publicStage === "INTERVIEW"
              ? "INTERVIEW"
              : "OUTCOME";
        await tx.applicationPublicUpdate.create({
          data: {
            applicationId: application.id,
            kind: publicKind,
            publicStage,
            publicOutcome: publicOutcomeForCanonicalStage(command.targetStage),
            title:
              publicStage === "UNDER_REVIEW"
                ? "Application under review"
                : publicStage === "INTERVIEW"
                  ? "Interview stage reached"
                  : "Application outcome updated",
            effectiveAt: now,
            deduplicationKey: `application:${application.id}:public:stage:${nextVersion}`,
            sourceEventReference: event.id,
          },
        });

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

        if (emailRequired) {
          await tx.emailOutbox.create({
            data: {
              kind: "APPLICATION_STAGE_CHANGED",
              userId: application.candidateUserId,
              recipientRef: application.candidateUserId,
              templateVersion: "application-stage-changed.v1",
              payloadRef: { v: 1, applicationId: application.id, stage: command.targetStage, jobTitle: application.jobPosting.title, companyName: application.jobPosting.company.displayName },
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
          correlationId: event.id,
          context: {
            fromStage,
            toStage: command.targetStage,
            applicationVersion: nextVersion,
            reason: command.reasonCode ?? undefined,
            notificationWorkCount:
              Number(inAppUpdatesEnabled) + Number(emailRequired),
          },
        });

        if (!boundary) {
          return applicationStageTransitionOutcomeSchema.parse({ applicationId: application.id, fromStage, stage: command.targetStage, stageVersion: nextVersion, lastStageChangedAt: now.toISOString(), eventId: event.id });
        }
        return stageTransitionOutcomeSchema.parse({ applicationId: application.id, fromStage, stage: command.targetStage, stageVersion: nextVersion, lastStageChangedAt: now.toISOString(), stageEventId: event.id, replayed: false, allowedDestinations: ordinaryApplicationTransitions[command.targetStage] });
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      if (error instanceof JobServiceError) throw error;

      const prismaCode =
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : null;
      if (!boundary) {
        if (prismaCode === "P2034") {
          throw new JobServiceError(409, {
            code: "APPLICATION_STAGE_CONFLICT",
            message: "This application changed. Refresh it and try again.",
          });
        }
        throw error;
      }
      if (!["P2002", "P2034"].includes(prismaCode ?? "")) {
        throw error;
      }

      const current = await this.db.jobApplication.findFirst({
        where: {
          id: applicationId,
          ...(authorizedJobId ? { jobPostingId: authorizedJobId } : {}),
        },
        select: { jobPostingId: true, stage: true, stageVersion: true },
      });
      if (!current) {
        throw new JobServiceError(404, {
          code: "APPLICATION_UNAVAILABLE",
          message: "This application is unavailable.",
        });
      }

      const idempotencyKey = boundary.idempotencyKey.trim();
      const source = boundary.source ?? "STAGE_ROUTE";
      const digest = applicationStageCommandDigest({
        actorUserId: actor.userId,
        requestedJobId: boundary.requestedJobId,
        canonicalJobId: current.jobPostingId,
        applicationId,
        command,
        source,
      });
      const replay = idempotencyKey
        ? await this.db.applicationStageEvent.findFirst({
            where: { applicationId, idempotencyKey },
            orderBy: { occurredAt: "desc" },
          })
        : null;
      if (replay) {
        if (eventDigest(replay.metadata) !== digest) {
          throw new JobServiceError(409, {
            code: "IDEMPOTENCY_CONFLICT",
            message: "This Idempotency-Key was used for a different stage decision.",
          });
        }
        return stageTransitionOutcomeSchema.parse({
          applicationId,
          fromStage: replay.fromStage,
          stage: replay.toStage,
          stageVersion: replay.applicationVersion,
          lastStageChangedAt: replay.occurredAt.toISOString(),
          stageEventId: replay.id,
          replayed: true,
          allowedDestinations: ordinaryApplicationTransitions[replay.toStage],
        });
      }

      throw new JobServiceError(409, {
        code: "APPLICATION_STAGE_CONFLICT",
        message: "This application changed. Refresh it and try again.",
      });
    }
  }
}
