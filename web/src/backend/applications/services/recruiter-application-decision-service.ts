import "server-only";

import { prisma } from "@/backend/database/prisma";
import { ApplicationStageService } from "@/backend/services/jobs/application-stage-service";
import {
  decisionOutcomeSchema,
  interviewDecisionRequestSchema,
  rejectDecisionRequestSchema,
  type DecisionOutcome,
} from "@/shared/contracts/scoring";

export class RecruiterApplicationDecisionService {
  constructor(
    private readonly db: typeof prisma = prisma,
    private readonly stageService = new ApplicationStageService(db),
  ) {}

  private async canonicalJobId(applicationId: string) {
    const application = await this.db.jobApplication.findUnique({ where: { id: applicationId }, select: { jobPostingId: true } });
    if (!application) throw new Error("APPLICATION_UNAVAILABLE");
    return application.jobPostingId;
  }

  async moveToInterview(input: { userId: string; sessionId: string; applicationId: string; idempotencyKey: string; raw: unknown; now?: Date }): Promise<DecisionOutcome> {
    const command = interviewDecisionRequestSchema.parse(input.raw);
    const jobId = await this.canonicalJobId(input.applicationId);
    const outcome = await this.stageService.transition(
      { userId: input.userId, sessionId: input.sessionId },
      input.applicationId,
      { targetStage: "INTERVIEWING", expectedStageVersion: command.expectedStageVersion, confirmed: command.confirmed },
      input.now ?? new Date(),
      { requestedJobId: jobId, idempotencyKey: input.idempotencyKey, source: "INTERVIEW_ADAPTER" },
    );
    const stageEventId = "stageEventId" in outcome ? outcome.stageEventId : outcome.eventId;
    return decisionOutcomeSchema.parse({ applicationId: outcome.applicationId, fromStage: outcome.fromStage, toStage: outcome.stage, stageVersion: outcome.stageVersion, stageEventId, auditEventId: stageEventId, actorUserId: input.userId, decidedAt: outcome.lastStageChangedAt, reasonCode: "RECRUITER_CONFIRMED_INTERVIEW", notification: { required: true, status: "PENDING" } });
  }

  async reject(input: { userId: string; sessionId: string; applicationId: string; idempotencyKey: string; raw: unknown; now?: Date }): Promise<DecisionOutcome> {
    const command = rejectDecisionRequestSchema.parse(input.raw);
    const jobId = await this.canonicalJobId(input.applicationId);
    const outcome = await this.stageService.transition(
      { userId: input.userId, sessionId: input.sessionId },
      input.applicationId,
      { targetStage: "REJECTED", expectedStageVersion: command.expectedStageVersion, confirmed: command.confirmed, reasonCode: command.reasonCode, internalNote: command.internalNote },
      input.now ?? new Date(),
      { requestedJobId: jobId, idempotencyKey: input.idempotencyKey, source: "REJECTION_ADAPTER" },
    );
    const stageEventId = "stageEventId" in outcome ? outcome.stageEventId : outcome.eventId;
    return decisionOutcomeSchema.parse({ applicationId: outcome.applicationId, fromStage: outcome.fromStage, toStage: outcome.stage, stageVersion: outcome.stageVersion, stageEventId, auditEventId: stageEventId, actorUserId: input.userId, decidedAt: outcome.lastStageChangedAt, reasonCode: command.reasonCode, notification: { required: true, status: "PENDING" } });
  }
}
