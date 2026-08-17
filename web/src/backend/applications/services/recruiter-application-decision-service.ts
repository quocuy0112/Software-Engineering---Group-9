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
import { createInAppNotification } from "@/backend/notifications/notification-service";
import {
  publicOutcomeForCanonicalStage,
  publicStageForCanonicalStage,
} from "@/shared/contracts/candidate-applications";

const interviewSources = new Set(["APPLIED", "VIEWED", "SHORTLISTED", "WAITLISTED"]);
const rejectSources = new Set(["APPLIED", "VIEWED", "SHORTLISTED", "INTERVIEWING", "OFFERED", "WAITLISTED"]);
const rejectionLabels: Record<RejectionReasonCode, string> = {
  REQUIRED_TECHNICAL_EXPERIENCE_NOT_DEMONSTRATED: "Required technical experience not demonstrated",
  INSUFFICIENT_EXPERIENCE: "Insufficient experience",
  REQUIRED_SKILLS_NOT_DEMONSTRATED: "Required skills not demonstrated",
  POSITION_FILLED: "Position filled",
  APPLICATION_WITHDRAWN_BY_CANDIDATE: "Application withdrawn by candidate",
  OTHER_JOB_RELATED_REASON: "Other job-related reason",
};

export class RecruiterApplicationDecisionService {
  constructor(
    private readonly db: typeof prisma = prisma,
    private readonly authorization = new RecruiterApplicationAuthorization(),
  ) {}

  async moveToInterview(input: { userId: string; sessionId: string; applicationId: string; idempotencyKey: string; raw: unknown; now?: Date }): Promise<DecisionOutcome> {
    const command = interviewDecisionRequestSchema.parse(input.raw);
    return this.commit({ ...input, target: "INTERVIEWING", decisionKind: "MOVE_TO_INTERVIEW", reasonCode: "RECRUITER_CONFIRMED_INTERVIEW", reasonLabel: "Recruiter confirmed interview", internalNote: null, expectedStageVersion: command.expectedStageVersion });
  }

  async reject(input: { userId: string; sessionId: string; applicationId: string; idempotencyKey: string; raw: unknown; now?: Date }): Promise<DecisionOutcome> {
    const command = rejectDecisionRequestSchema.parse(input.raw);
    const reasonCode = rejectionReasonCodeSchema.parse(command.reasonCode);
    return this.commit({ ...input, target: "REJECTED", decisionKind: "REJECT", reasonCode, reasonLabel: rejectionLabels[reasonCode], internalNote: command.internalNote?.trim() || null, expectedStageVersion: command.expectedStageVersion });
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
  }) {
    if (!input.idempotencyKey.trim()) throw new Error("IDEMPOTENCY_KEY_REQUIRED");
    const application = await this.db.jobApplication.findUnique({ where: { id: input.applicationId }, select: { id: true, jobPostingId: true } });
    if (!application || !(await this.authorization.authorizeApplication(input.userId, application.jobPostingId, application.id)).authorized) throw new Error("APPLICATION_UNAVAILABLE");
    const now = input.now ?? new Date();
    return this.db.$transaction(async (tx) => {
      const replay = await tx.applicationStageEvent.findFirst({ where: { applicationId: input.applicationId, idempotencyKey: input.idempotencyKey }, orderBy: { occurredAt: "desc" } });
      if (replay) {
        return decisionOutcomeSchema.parse({ applicationId: input.applicationId, fromStage: replay.fromStage, toStage: replay.toStage, stageVersion: replay.applicationVersion, stageEventId: replay.id, auditEventId: replay.id, actorUserId: replay.actorUserId ?? input.userId, decidedAt: replay.occurredAt.toISOString(), reasonCode: replay.reasonCode, notification: { required: replay.notificationRequired, status: replay.notificationStatus } });
      }
      const current = await tx.jobApplication.findUnique({ where: { id: input.applicationId }, select: { id: true, stage: true, stageVersion: true, withdrawalOutcome: true, candidateUserId: true, candidate: { select: { user: { select: { preferences: { select: { applicationUpdatesEmail: true } } } } } }, notificationPreference: { select: { emailEnabled: true, inAppEnabled: true } }, jobPosting: { select: { title: true, company: { select: { displayName: true } } } } } });
      if (!current) throw new Error("APPLICATION_UNAVAILABLE");
      if (current.withdrawalOutcome) throw new Error("APPLICATION_WITHDRAWAL_BLOCKED");
      const allowed = input.target === "INTERVIEWING" ? interviewSources.has(current.stage) : rejectSources.has(current.stage);
      if (!allowed) throw new Error("INVALID_DECISION_STAGE");
      if (current.stageVersion !== input.expectedStageVersion) throw new Error("DECISION_CONFLICT");
      const updated = await tx.jobApplication.updateMany({ where: { id: current.id, stage: current.stage, stageVersion: input.expectedStageVersion, withdrawalOutcome: null }, data: { stage: input.target, stageVersion: { increment: 1 }, lastStageChangedAt: now } });
      if (updated.count !== 1) throw new Error("DECISION_CONFLICT");
      const nextVersion = input.expectedStageVersion + 1;
      const event = await tx.applicationStageEvent.create({ data: { applicationId: current.id, fromStage: current.stage, toStage: input.target, actorUserId: input.userId, actorType: "RECRUITER", reasonCode: input.reasonCode, reasonLabelSnapshot: input.reasonLabel, internalNoteEncrypted: input.internalNote, notificationRequired: input.target === "INTERVIEWING", notificationStatus: input.target === "INTERVIEWING" ? "PENDING" : "NOT_REQUIRED", idempotencyKey: input.idempotencyKey, candidateVisibleReason: null, candidateVisible: true, occurredAt: now, applicationVersion: nextVersion, decisionKind: input.decisionKind, metadata: { v: 1, source: "recruiter-decision-command" } } });
      const publicStage = publicStageForCanonicalStage(input.target);
      await tx.applicationPublicUpdate.create({ data: { applicationId: current.id, kind: publicStage === "INTERVIEW" ? "INTERVIEW" : "OUTCOME", publicStage, publicOutcome: publicOutcomeForCanonicalStage(input.target), title: publicStage === "INTERVIEW" ? "Interview stage reached" : "Application outcome updated", effectiveAt: now, deduplicationKey: `application:${current.id}:public:stage:${nextVersion}`, sourceEventReference: event.id } });
      if (input.target === "INTERVIEWING") {
        if (current.notificationPreference?.inAppEnabled ?? true) {
          await createInAppNotification(tx, { recipientUserId: current.candidateUserId, kind: "APPLICATION_STAGE_CHANGED", deduplicationKey: `application:${current.id}:stage:${nextVersion}:candidate`, correlationId: event.id, occurredAt: now, contextType: "APPLICATION", contextId: current.id, variables: { stage: "INTERVIEWING" } });
        }
        if (current.notificationPreference?.emailEnabled ?? current.candidate.user.preferences?.applicationUpdatesEmail ?? true) {
          await tx.emailOutbox.create({ data: { kind: "APPLICATION_STAGE_CHANGED", userId: current.candidateUserId, recipientRef: current.candidateUserId, templateVersion: "application-stage-changed.v1", payloadRef: { v: 1, applicationId: current.id, stage: "INTERVIEWING", jobTitle: current.jobPosting.title, companyName: current.jobPosting.company.displayName }, idempotencyKey: `application:${current.id}:stage:${nextVersion}:email` } });
        }
      }
      const audit = await new PrismaAuditRepository(tx).append({ occurredAt: now, actorType: "user", actorUserId: input.userId, actorSessionId: input.sessionId, action: input.target === "INTERVIEWING" ? "APPLICATION_MOVED_TO_INTERVIEW" : "APPLICATION_REJECTED", targetType: "job_application", targetId: current.id, result: "SUCCESS", correlationId: randomUUID(), context: { fromStage: current.stage, toStage: input.target, reason: input.reasonCode, applicationVersion: nextVersion } });
      return decisionOutcomeSchema.parse({ applicationId: current.id, fromStage: current.stage, toStage: input.target, stageVersion: nextVersion, stageEventId: event.id, auditEventId: audit, actorUserId: input.userId, decidedAt: now.toISOString(), reasonCode: input.reasonCode, notification: { required: input.target === "INTERVIEWING", status: input.target === "INTERVIEWING" ? "PENDING" : "NOT_REQUIRED" } });
    }, { isolationLevel: "Serializable" });
  }
}
