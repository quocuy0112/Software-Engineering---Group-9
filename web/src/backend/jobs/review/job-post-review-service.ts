import "server-only";
import { PrismaJobPostReviewRepository } from "@/backend/repositories/jobs/prisma-job-post-review-repository";

/**
 * Application boundary for the review lifecycle. User-story orchestration is
 * added here so Route Handlers never depend on Prisma or JSON persistence.
 */
export class JobPostReviewService {
  constructor(
    readonly reviews: PrismaJobPostReviewRepository =
      new PrismaJobPostReviewRepository(),
  ) {}
}
