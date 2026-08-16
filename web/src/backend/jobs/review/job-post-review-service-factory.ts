import "server-only";
import { JobPostSubmissionService } from "./job-post-submission-service";

export function createJobPostReviewServices() {
  return { submissions: new JobPostSubmissionService() };
}
