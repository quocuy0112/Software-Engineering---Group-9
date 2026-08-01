import "server-only";
import type { SavedJobRepositoryPort } from "@/backend/repositories/jobs/prisma-saved-job-repository";
import type { CandidateActor } from "./job-types";
import { JobServiceError } from "./job-types";

type PublicActionTargetRepository = {
  findPublicActionTarget(jobId: string, now: Date): Promise<unknown | null>;
};

export class SavedJobService {
  constructor(
    private readonly savedJobs?: SavedJobRepositoryPort,
    private readonly publicJobs?: PublicActionTargetRepository,
  ) {}

  private async savedRepo() {
    return (
      this.savedJobs ??
      new (
        await import("@/backend/repositories/jobs/prisma-saved-job-repository")
      ).PrismaSavedJobRepository()
    );
  }

  private async publicRepo() {
    return (
      this.publicJobs ??
      new (
        await import("@/backend/repositories/jobs/prisma-public-job-repository")
      ).PrismaPublicJobRepository()
    );
  }

  private async requirePublicTarget(jobId: string, now: Date) {
    const target = await (
      await this.publicRepo()
    ).findPublicActionTarget(jobId, now);
    if (!target) {
      throw new JobServiceError(404, {
        code: "JOB_NOT_FOUND",
        message: "This job is not available on the public board.",
      });
    }
  }

  async save(actor: CandidateActor, jobId: string, now = new Date()) {
    await this.requirePublicTarget(jobId, now);
    const saved = await (await this.savedRepo()).save(actor.userId, jobId);
    return { jobId, saved, message: "Job saved." };
  }

  async remove(actor: CandidateActor, jobId: string, now = new Date()) {
    await this.requirePublicTarget(jobId, now);
    const saved = await (await this.savedRepo()).remove(actor.userId, jobId);
    return { jobId, saved, message: "Job removed from saved jobs." };
  }
}
