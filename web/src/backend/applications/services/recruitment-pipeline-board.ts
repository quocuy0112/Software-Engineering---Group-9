import "server-only";

import { PrismaApplicationRepository } from "@/backend/repositories/applications/prisma-application-repository";
import type { RecruitmentPipelineRepositoryPort } from "@/backend/repositories/applications/application-repository";
import {
  pipelineApplicationStages,
  pipelineBoardMetadataSchema,
  pipelineStageLabels,
  pipelineStagePageSchema,
  type ApplicationStage,
  type PipelineBoardMetadata,
  type PipelineStagePage,
} from "@/shared/contracts/applications";
import { ordinaryApplicationTransitions } from "@/backend/services/jobs/application-stage-policy";
import { RecruiterApplicationAuthorization } from "../authorization/recruiter-application-authorization";

export class RecruitmentPipelineBoardService {
  constructor(
    private readonly repository: RecruitmentPipelineRepositoryPort = new PrismaApplicationRepository(),
    private readonly authorization = new RecruiterApplicationAuthorization(),
  ) {}

  private async context(userId: string, jobId: string) {
    const result = await this.authorization.authorizeJob(userId, jobId);
    if (!result.authorized || !result.canView || !result.membershipRole || !result.jobStatus) {
      throw new Error("APPLICATION_UNAVAILABLE");
    }
    return result;
  }

  async metadata(input: { userId: string; jobId: string; now?: Date }): Promise<PipelineBoardMetadata> {
    const context = await this.context(input.userId, input.jobId);
    const counts = await this.repository.countPipelineStages(context.jobPostingId);
    return pipelineBoardMetadataSchema.parse({
      job: { jobId: context.requestedJobId, title: context.jobTitle, status: context.jobStatus },
      permissions: {
        role: context.membershipRole,
        canView: true,
        canMoveStages: context.canMoveStages,
        canReject: context.canReject,
        canRecordOfferDeclined: context.canRecordOfferDeclined,
        canConfirmHired: context.canConfirmHired,
      },
      stages: pipelineApplicationStages.map((stage) => ({ stage, label: pipelineStageLabels[stage], count: counts[stage] })),
      observedAt: (input.now ?? new Date()).toISOString(),
    });
  }

  async stagePage(input: { userId: string; jobId: string; stage: ApplicationStage; limit: number; cursor?: string; now?: Date }): Promise<PipelineStagePage> {
    const context = await this.context(input.userId, input.jobId);
    const page = await this.repository.listPipelineStage({ jobId: context.jobPostingId, stage: input.stage, limit: input.limit, cursor: input.cursor });
    return pipelineStagePageSchema.parse({
      stage: input.stage,
      items: page.items.map((item) => ({
        ...item,
        allowedDestinations: context.canMoveStages ? ordinaryApplicationTransitions[item.stage] : [],
      })),
      nextCursor: page.nextCursor,
      observedAt: (input.now ?? new Date()).toISOString(),
    });
  }
}
