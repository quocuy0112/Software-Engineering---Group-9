import "server-only";
import { PrismaApplicationTrackingRepository } from "@/backend/repositories/jobs/prisma-application-tracking-repository";
import {
  applicationStageGroupSchema,
  applicationStageSchema,
  type ApplicationStage,
  type ApplicationStageGroup,
} from "@/shared/contracts/jobs/applications";
import { JobServiceError, type CandidateActor } from "./job-types";

export class CandidateApplicationService {
  constructor(
    private readonly repository = new PrismaApplicationTrackingRepository(),
  ) {}

  list(
    actor: CandidateActor,
    input: {
      stage?: ApplicationStage;
      group?: ApplicationStageGroup;
      cursor?: string;
      limit?: number;
    } = {},
  ) {
    return this.repository.listCandidateApplications({
      candidateUserId: actor.userId,
      stage: input.stage
        ? applicationStageSchema.parse(input.stage)
        : undefined,
      group: input.group
        ? applicationStageGroupSchema.parse(input.group)
        : undefined,
      cursor: input.cursor,
      limit: Math.min(Math.max(input.limit ?? 50, 1), 100),
    });
  }

  async detail(actor: CandidateActor, applicationId: string) {
    const application = await this.repository.getCandidateApplication(
      actor.userId,
      applicationId,
    );
    if (!application) {
      throw new JobServiceError(404, {
        code: "APPLICATION_NOT_FOUND",
        message: "This application is unavailable.",
      });
    }
    return application;
  }
}
