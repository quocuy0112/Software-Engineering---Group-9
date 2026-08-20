import "server-only";

import { prisma } from "@/backend/database/prisma";
import { RecruiterApplicationAuthorization } from "@/backend/applications/authorization/recruiter-application-authorization";
import { ApplicationStageService } from "@/backend/services/jobs/application-stage-service";
import { JobServiceError } from "@/backend/services/jobs/job-types";
import {
  applicationShortlistOutcomeSchema,
  applicationStageSchema,
  type ApplicationShortlistOutcome,
} from "@/shared/contracts/jobs/applications";

type CurrentApplication = {
  id: string;
  jobPostingId: string;
  stage: string;
  stageVersion: number;
  lastStageChangedAt: Date;
};

function unchangedOutcome(
  application: CurrentApplication,
): ApplicationShortlistOutcome {
  return applicationShortlistOutcomeSchema.parse({
    applicationId: application.id,
    stage: applicationStageSchema.parse(application.stage),
    stageVersion: application.stageVersion,
    lastStageChangedAt: application.lastStageChangedAt.toISOString(),
    changed: false,
  });
}

export class ShortlistApplicationService {
  constructor(
    private readonly db: typeof prisma = prisma,
    private readonly authorization = new RecruiterApplicationAuthorization(db),
    private readonly stageService = new ApplicationStageService(db),
  ) {}

  async execute(input: {
    userId: string;
    sessionId: string;
    applicationId: string;
    now?: Date;
  }): Promise<ApplicationShortlistOutcome> {
    const application = await this.db.jobApplication.findUnique({
      where: { id: input.applicationId },
      select: {
        id: true,
        jobPostingId: true,
        stage: true,
        stageVersion: true,
        lastStageChangedAt: true,
      },
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
      throw new JobServiceError(404, {
        code: "APPLICATION_NOT_FOUND",
        message: "This application is unavailable.",
      });
    }

    const current = application as CurrentApplication;
    const currentStage = applicationStageSchema.parse(current.stage);
    if (currentStage !== "VIEWED") {
      if (currentStage === "APPLIED") {
        throw new JobServiceError(409, {
          code: "APPLICATION_STAGE_TRANSITION_INVALID",
          message: "Open this application before shortlisting it.",
        });
      }
      return unchangedOutcome(current);
    }

    try {
      const authority = this.stageService as unknown as {
        attemptStageTransition?: ApplicationStageService["attemptStageTransition"];
        transition: ApplicationStageService["transition"];
      };
      const transitioned =
        typeof authority.attemptStageTransition === "function"
          ? await authority.attemptStageTransition({
              candidateApplicationId: current.id,
              targetStage: "SHORTLISTED",
              actor: {
                kind: "recruiter_manual",
                userId: input.userId,
                sessionId: input.sessionId,
              },
              requestedJobId: current.jobPostingId,
              expectedStageVersion: current.stageVersion,
              reasonCode: "RECRUITER_SHORTLISTED_CANDIDATE",
              candidateVisibleReason: "Your application has been shortlisted.",
              source: "STAGE_ROUTE",
              now: input.now,
            })
          : await authority.transition(
              { userId: input.userId, sessionId: input.sessionId },
              current.id,
              {
                targetStage: "SHORTLISTED",
                expectedVersion: current.stageVersion,
                reasonCode: "RECRUITER_SHORTLISTED_CANDIDATE",
                candidateVisibleReason: "Your application has been shortlisted.",
              },
              input.now,
            );
      return applicationShortlistOutcomeSchema.parse({
        applicationId: transitioned.applicationId,
        stage: transitioned.stage,
        stageVersion: transitioned.stageVersion,
        lastStageChangedAt: transitioned.lastStageChangedAt,
        changed: true,
      });
    } catch (error) {
      // A second click or another recruiter may win the Viewed -> Shortlisted
      // transition. Once the authoritative row is past Viewed, the action is
      // an idempotent no-op rather than a visible conflict.
      if (!(error instanceof JobServiceError && error.status === 409)) {
        throw error;
      }
      const latest = await this.db.jobApplication.findUnique({
        where: { id: current.id },
        select: {
          id: true,
          jobPostingId: true,
          stage: true,
          stageVersion: true,
          lastStageChangedAt: true,
        },
      });
      if (!latest) throw error;
      const latestApplication = latest as CurrentApplication;
      if (applicationStageSchema.parse(latestApplication.stage) === "VIEWED") {
        throw error;
      }
      return unchangedOutcome(latestApplication);
    }
  }
}
