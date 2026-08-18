import "server-only";

import { randomUUID } from "node:crypto";
import { prisma } from "@/backend/database/prisma";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import { RecruiterApplicationAuthorization } from "../authorization/recruiter-application-authorization";
import {
  decisionOutcomeSchema,
  interviewDecisionRequestSchema,
  rejectionReasonCodeSchema,
  rejectDecisionRequestSchema,
  type DecisionOutcome,
  type RejectionReasonCode,
} from "@/shared/contracts/scoring";
import {
  applicationStageSchema,
  type ApplicationStage,
} from "@/shared/contracts/jobs/applications";
import { createInAppNotification } from "@/backend/notifications/notification-service";
import {
  publicOutcomeForCanonicalStage,
  publicUpdateKindForCanonicalStage,
  publicUpdateTitleForCanonicalStage,
  publicStageForCanonicalStage,
} from "@/shared/contracts/candidate-applications";

const interviewSources = new Set<ApplicationStage>([
  "VIEWED",
  "SHORTLISTED",
  "WAITLISTED",
]);
const rejectSources = new Set<ApplicationStage>([
  "APPLIED",
  "VIEWED",
  "SHORTLISTED",
  "INTERVIEWING",
  "OFFERED",
  "WAITLISTED",
]);
const rejectionLabels: Record<RejectionReasonCode, string> = {
  REQUIRED_TECHNICAL_EXPERIENCE_NOT_DEMONSTRATED:
    "Required technical experience not demonstrated",
  INSUFFICIENT_EXPERIENCE: "Insufficient experience",
  REQUIRED_SKILLS_NOT_DEMONSTRATED: "Required skills not demonstrated",
  POSITION_FILLED: "Position filled",
  APPLICATION_WITHDRAWN_BY_CANDIDATE: "Application withdrawn by candidate",
  OTHER_JOB_RELATED_REASON: "Other job-related reason",
};

/**
 * A Viewed candidate must leave a durable Shortlisted record before the
 * interview decision is committed. The first event is intentionally separate
 * from the interview event so candidate history and recruiter analytics retain
 * both human stage transitions.
 */
export function interviewStagePath(
  fromStage: ApplicationStage,
): ApplicationStage[] {
  return fromStage === "VIEWED"
    ? ["VIEWED", "SHORTLISTED", "INTERVIEWING"]
    : [fromStage, "INTERVIEWING"];
}

export class RecruiterApplicationDecisionService {
  constructor(
    private readonly db: typeof prisma = prisma,
    private readonly authorization = new RecruiterApplicationAuthorization(db),
  ) {}

  async moveToInterview(input: {
    userId: string;
    sessionId: string;
    applicationId: string;
    idempotencyKey: string;
    raw: unknown;
    now?: Date;
  }): Promise<DecisionOutcome> {
    const command = interviewDecisionRequestSchema.parse(input.raw);
    return this.commit({
      ...input,
      target: "INTERVIEWING",
      decisionKind: "MOVE_TO_INTERVIEW",
      reasonCode: "RECRUITER_CONFIRMED_INTERVIEW",
      reasonLabel: "Recruiter confirmed interview",
      internalNote: null,
      expectedStageVersion: command.expectedStageVersion,
    });
  }

  async reject(input: {
    userId: string;
    sessionId: string;
    applicationId: string;
    idempotencyKey: string;
    raw: unknown;
    now?: Date;
  }): Promise<DecisionOutcome> {
    const command = rejectDecisionRequestSchema.parse(input.raw);
    const reasonCode = rejectionReasonCodeSchema.parse(command.reasonCode);
    return this.commit({
      ...input,
      target: "REJECTED",
      decisionKind: "REJECT",
      reasonCode,
      reasonLabel: rejectionLabels[reasonCode],
      internalNote: command.internalNote?.trim() || null,
      expectedStageVersion: command.expectedStageVersion,
    });
  }

  private async commit(input: {
    userId: string;
    sessionId: string;
    applicationId: string;
    idempotencyKey: string;
    target: "INTERVIEWING" | "REJECTED";
    decisionKind: "MOVE_TO_INTERVIEW" | "REJECT";
    reasonCode: string;
    reasonLabel: string;
    internalNote: string | null;
    expectedStageVersion: number;
    now?: Date;
  }): Promise<DecisionOutcome> {
    if (!input.idempotencyKey.trim())
      throw new Error("IDEMPOTENCY_KEY_REQUIRED");

    const application = await this.db.jobApplication.findUnique({
      where: { id: input.applicationId },
      select: { id: true, jobPostingId: true },
    });
    if (
      !application ||
      !(
        await this.authorization.authorizeApplication(
          input.userId,
          application.jobPostingId,
          application.id,
        )
      ).authorized
    ) {
      throw new Error("APPLICATION_UNAVAILABLE");
    }

    const requestedAt = input.now ?? new Date();
    return this.db.$transaction(
      async (tx) => {
        const replay = await tx.applicationStageEvent.findFirst({
          where: {
            applicationId: input.applicationId,
            idempotencyKey: input.idempotencyKey,
          },
          orderBy: { occurredAt: "desc" },
        });
        if (replay) {
          const replayMetadata =
            replay.metadata &&
            typeof replay.metadata === "object" &&
            !Array.isArray(replay.metadata)
              ? (replay.metadata as Record<string, unknown>)
              : null;
          const replayFromStage =
            replayMetadata?.autoShortlisted === true &&
            typeof replayMetadata.initialFromStage === "string"
              ? applicationStageSchema.parse(replayMetadata.initialFromStage)
              : replay.fromStage;
          return decisionOutcomeSchema.parse({
            applicationId: input.applicationId,
            fromStage: replayFromStage,
            toStage: replay.toStage,
            stageVersion: replay.applicationVersion,
            stageEventId: replay.id,
            auditEventId: replay.id,
            actorUserId: replay.actorUserId ?? input.userId,
            decidedAt: replay.occurredAt.toISOString(),
            reasonCode: replay.reasonCode,
            notification: {
              required: replay.notificationRequired,
              status: replay.notificationStatus,
            },
          });
        }

        const current = await tx.jobApplication.findUnique({
          where: { id: input.applicationId },
          select: {
            id: true,
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
            notificationPreference: {
              select: { emailEnabled: true, inAppEnabled: true },
            },
            jobPosting: {
              select: {
                title: true,
                company: { select: { displayName: true } },
              },
            },
          },
        });
        if (!current) throw new Error("APPLICATION_UNAVAILABLE");
        if (current.withdrawalOutcome)
          throw new Error("APPLICATION_WITHDRAWAL_BLOCKED");

        const fromStage = applicationStageSchema.parse(current.stage);
        const allowed =
          input.target === "INTERVIEWING"
            ? interviewSources.has(fromStage)
            : rejectSources.has(fromStage);
        if (!allowed) throw new Error("INVALID_DECISION_STAGE");
        if (current.stageVersion !== input.expectedStageVersion)
          throw new Error("DECISION_CONFLICT");

        const autoShortlist =
          input.target === "INTERVIEWING" && fromStage === "VIEWED";
        const shortlistAt = requestedAt;
        const interviewAt = autoShortlist
          ? new Date(requestedAt.getTime() + 1)
          : requestedAt;
        const finalVersion =
          input.expectedStageVersion + (autoShortlist ? 2 : 1);

        const updated = await tx.jobApplication.updateMany({
          where: {
            id: current.id,
            stage: fromStage,
            stageVersion: input.expectedStageVersion,
            withdrawalOutcome: null,
          },
          data: {
            stage: input.target,
            stageVersion: { increment: autoShortlist ? 2 : 1 },
            lastStageChangedAt: interviewAt,
          },
        });
        if (updated.count !== 1) throw new Error("DECISION_CONFLICT");

        if (autoShortlist) {
          const shortlistEvent = await tx.applicationStageEvent.create({
            data: {
              applicationId: current.id,
              fromStage: "VIEWED",
              toStage: "SHORTLISTED",
              actorUserId: input.userId,
              actorType: "RECRUITER",
              reasonCode: "RECRUITER_AUTO_SHORTLISTED_FOR_INTERVIEW",
              reasonLabelSnapshot:
                "Recruiter recorded shortlist before interview",
              internalNoteEncrypted: null,
              candidateVisibleReason: "Your application has been shortlisted.",
              candidateVisible: true,
              occurredAt: shortlistAt,
              applicationVersion: input.expectedStageVersion + 1,
              metadata: {
                v: 1,
                source: "recruiter-decision-command",
                autoShortlisted: true,
              },
              decisionKind: null,
              notificationRequired: false,
              notificationStatus: "NOT_REQUIRED",
              idempotencyKey: null,
            },
          });
          await tx.applicationPublicUpdate.create({
            data: {
              applicationId: current.id,
              kind: publicUpdateKindForCanonicalStage("SHORTLISTED"),
              publicStage: publicStageForCanonicalStage("SHORTLISTED"),
              publicOutcome: publicOutcomeForCanonicalStage("SHORTLISTED"),
              title: publicUpdateTitleForCanonicalStage("SHORTLISTED"),
              effectiveAt: shortlistAt,
              deduplicationKey:
                "application:" +
                current.id +
                ":public:stage:" +
                (input.expectedStageVersion + 1),
              sourceEventReference: shortlistEvent.id,
            },
          });
        }

        const event = await tx.applicationStageEvent.create({
          data: {
            applicationId: current.id,
            fromStage: autoShortlist ? "SHORTLISTED" : fromStage,
            toStage: input.target,
            actorUserId: input.userId,
            actorType: "RECRUITER",
            reasonCode: input.reasonCode,
            reasonLabelSnapshot: input.reasonLabel,
            internalNoteEncrypted: input.internalNote,
            notificationRequired: input.target === "INTERVIEWING",
            notificationStatus:
              input.target === "INTERVIEWING" ? "PENDING" : "NOT_REQUIRED",
            idempotencyKey: input.idempotencyKey,
            candidateVisibleReason: null,
            candidateVisible: true,
            occurredAt: interviewAt,
            applicationVersion: finalVersion,
            decisionKind: input.decisionKind,
            metadata: {
              v: 1,
              source: "recruiter-decision-command",
              autoShortlisted: autoShortlist,
              initialFromStage: fromStage,
            },
          },
        });

        const publicStage = publicStageForCanonicalStage(input.target);
        await tx.applicationPublicUpdate.create({
          data: {
            applicationId: current.id,
            kind: publicUpdateKindForCanonicalStage(input.target),
            publicStage,
            publicOutcome: publicOutcomeForCanonicalStage(input.target),
            title: publicUpdateTitleForCanonicalStage(input.target),
            effectiveAt: interviewAt,
            deduplicationKey:
              "application:" + current.id + ":public:stage:" + finalVersion,
            sourceEventReference: event.id,
          },
        });

        if (input.target === "INTERVIEWING") {
          if (current.notificationPreference?.inAppEnabled ?? true) {
            await createInAppNotification(tx, {
              recipientUserId: current.candidateUserId,
              kind: "APPLICATION_STAGE_CHANGED",
              deduplicationKey:
                "application:" +
                current.id +
                ":stage:" +
                finalVersion +
                ":candidate",
              correlationId: event.id,
              occurredAt: interviewAt,
              contextType: "APPLICATION",
              contextId: current.id,
              variables: { stage: "INTERVIEWING" },
            });
          }
          if (
            current.notificationPreference?.emailEnabled ??
            current.candidate.user.preferences?.applicationUpdatesEmail ??
            true
          ) {
            await tx.emailOutbox.create({
              data: {
                kind: "APPLICATION_STAGE_CHANGED",
                userId: current.candidateUserId,
                recipientRef: current.candidateUserId,
                templateVersion: "application-stage-changed.v1",
                payloadRef: {
                  v: 1,
                  applicationId: current.id,
                  stage: "INTERVIEWING",
                  jobTitle: current.jobPosting.title,
                  companyName: current.jobPosting.company.displayName,
                },
                idempotencyKey:
                  "application:" +
                  current.id +
                  ":stage:" +
                  finalVersion +
                  ":email",
              },
            });
          }
        }

        const audit = await new PrismaAuditRepository(tx).append({
          occurredAt: interviewAt,
          actorType: "user",
          actorUserId: input.userId,
          actorSessionId: input.sessionId,
          action:
            input.target === "INTERVIEWING"
              ? "APPLICATION_MOVED_TO_INTERVIEW"
              : "APPLICATION_REJECTED",
          targetType: "job_application",
          targetId: current.id,
          result: "SUCCESS",
          correlationId: randomUUID(),
          context: {
            fromStage,
            toStage: input.target,
            applicationVersion: finalVersion,
          },
        });

        return decisionOutcomeSchema.parse({
          applicationId: current.id,
          fromStage,
          toStage: input.target,
          stageVersion: finalVersion,
          stageEventId: event.id,
          auditEventId: audit,
          actorUserId: input.userId,
          decidedAt: interviewAt.toISOString(),
          reasonCode: input.reasonCode,
          notification: {
            required: input.target === "INTERVIEWING",
            status:
              input.target === "INTERVIEWING" ? "PENDING" : "NOT_REQUIRED",
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  }
}
