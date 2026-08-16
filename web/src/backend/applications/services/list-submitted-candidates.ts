import "server-only";

import type { ApplicationPage } from "@/shared/contracts/applications";
import type { ApplicationRepositoryPort } from "@/backend/repositories/applications/application-repository";
import {
  RecruiterApplicationAuthorization,
} from "../authorization/recruiter-application-authorization";

export class ListSubmittedCandidatesService {
  constructor(
    private readonly repository?: ApplicationRepositoryPort,
    private readonly authorization = new RecruiterApplicationAuthorization(),
  ) {}

  private async repo() {
    return this.repository ?? new (await import("@/backend/repositories/applications/prisma-application-repository")).PrismaApplicationRepository();
  }

  async execute(input: {
    userId: string;
    jobId: string;
    limit?: number;
    cursor?: string;
    now?: Date;
  }): Promise<ApplicationPage> {
    const authorization = await this.authorization.authorizeJob(
      input.userId,
      input.jobId,
    );
    if (!authorization.authorized) {
      throw new Error("APPLICATION_UNAVAILABLE");
    }
    return (await this.repo()).listSubmittedCandidates({
      jobId: input.jobId,
      limit: Math.min(Math.max(input.limit ?? 25, 1), 100),
      cursor: input.cursor,
      now: input.now,
    });
  }
}
