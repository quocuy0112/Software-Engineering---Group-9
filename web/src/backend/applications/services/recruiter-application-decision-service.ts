import "server-only";

import { prisma } from "@/backend/database/prisma";
import { RecruiterApplicationAuthorization } from "@/backend/applications/authorization/recruiter-application-authorization";
import { ApplicationStageService } from "@/backend/services/jobs/application-stage-service";
import type { ApplicationStage } from "@/shared/contracts/jobs/applications";
import {
  decisionOutcomeSchema,
  interviewDecisionRequestSchema,
  rejectDecisionRequestSchema,
  type DecisionOutcome,
} from "@/shared/contracts/scoring";

type DecisionInput = Readonly<{
  userId: string;
  sessionId: string;
  applicationId: string;
  idempotencyKey: string;
  raw: unknown;
  now?: Date;
}>;

type StageServiceDependency = Pick<ApplicationStageService, "transition">;
type AuthorizationDependency = Pick<
  RecruiterApplicationAuthorization,
  "authorizeApplication"
>;

type StageServiceOutcome = Awaited<
  ReturnType<ApplicationStageService["transition"]>
>;

export function interviewStagePath(
  fromStage: ApplicationStage,
): ApplicationStage[] {
  return fromStage === "VIEWED"
    ? ["VIEWED", "SHORTLISTED", "INTERVIEWING"]
    : [fromStage, "INTERVIEWING"];
}

export class RecruiterApplicationDecisionService {
  private readonly stageService: StageServiceDependency;

  constructor(
    private readonly db: typeof prisma = prisma,
    stageServiceOrAuthorization:
      | StageServiceDependency
      | AuthorizationDependency = new ApplicationStageService(db),
  ) {
    // Keep the old authorization injection seam usable for focused tests and
    // legacy callers while all persistence still goes through the stage
    // authority.
    this.stageService =
      "transition" in stageServiceOrAuthorization
        ? stageServiceOrAuthorization
        : new ApplicationStageService(
            db,
            stageServiceOrAuthorization as never,
          );
  }

  private async canonicalJobId(applicationId: string) {
    const application = await this.db.jobApplication.findUnique({
      where: { id: applicationId },
      select: { jobPostingId: true },
    });
    if (!application) throw new Error("APPLICATION_UNAVAILABLE");
    return application.jobPostingId;
  }

  private toDecisionOutcome(
    input: DecisionInput,
    targetStage: "INTERVIEWING" | "REJECTED",
    reasonCode: string,
    outcome: StageServiceOutcome,
  ): DecisionOutcome {
    const stageEventId =
      "stageEventId" in outcome ? outcome.stageEventId : outcome.eventId;
    const auditEventId =
      "auditEventId" in outcome && typeof outcome.auditEventId === "string"
        ? outcome.auditEventId
        : stageEventId;
    const notificationRequired =
      "notificationRequired" in outcome &&
      typeof outcome.notificationRequired === "boolean"
        ? outcome.notificationRequired
        : targetStage === "INTERVIEWING";
    const notificationStatus =
      "notificationStatus" in outcome &&
      (outcome.notificationStatus === "NOT_REQUIRED" ||
        outcome.notificationStatus === "PENDING" ||
        outcome.notificationStatus === "SENT" ||
        outcome.notificationStatus === "FAILED_RETRYING")
        ? outcome.notificationStatus
        : notificationRequired
          ? "PENDING"
          : "NOT_REQUIRED";

    return decisionOutcomeSchema.parse({
      applicationId: outcome.applicationId,
      fromStage: outcome.fromStage,
      toStage: outcome.stage,
      stageVersion: outcome.stageVersion,
      stageEventId,
      auditEventId,
      actorUserId: input.userId,
      decidedAt: outcome.lastStageChangedAt,
      reasonCode,
      notification: {
        required: notificationRequired,
        status: notificationStatus,
      },
    });
  }

  async moveToInterview(input: DecisionInput): Promise<DecisionOutcome> {
    const command = interviewDecisionRequestSchema.parse(input.raw);
    const jobId = await this.canonicalJobId(input.applicationId);
    const outcome = await this.stageService.transition(
      { userId: input.userId, sessionId: input.sessionId },
      input.applicationId,
      {
        targetStage: "INTERVIEWING",
        expectedStageVersion: command.expectedStageVersion,
        confirmed: command.confirmed,
        reasonCode: "RECRUITER_CONFIRMED_INTERVIEW",
      },
      input.now ?? new Date(),
      {
        requestedJobId: jobId,
        idempotencyKey: input.idempotencyKey,
        source: "INTERVIEW_ADAPTER",
      },
    );
    return this.toDecisionOutcome(
      input,
      "INTERVIEWING",
      "RECRUITER_CONFIRMED_INTERVIEW",
      outcome,
    );
  }

  async reject(input: DecisionInput): Promise<DecisionOutcome> {
    const command = rejectDecisionRequestSchema.parse(input.raw);
    const jobId = await this.canonicalJobId(input.applicationId);
    const outcome = await this.stageService.transition(
      { userId: input.userId, sessionId: input.sessionId },
      input.applicationId,
      {
        targetStage: "REJECTED",
        expectedStageVersion: command.expectedStageVersion,
        confirmed: command.confirmed,
        reasonCode: command.reasonCode,
        internalNote: command.internalNote,
      },
      input.now ?? new Date(),
      {
        requestedJobId: jobId,
        idempotencyKey: input.idempotencyKey,
        source: "REJECTION_ADAPTER",
      },
    );
    return this.toDecisionOutcome(
      input,
      "REJECTED",
      command.reasonCode,
      outcome,
    );
  }
}
