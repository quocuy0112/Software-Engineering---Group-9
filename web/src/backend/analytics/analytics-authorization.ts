import "server-only";

import { RecruiterApplicationAuthorization } from "@/backend/applications/authorization/recruiter-application-authorization";

export type EmployerAnalyticsScope = Readonly<{
  jobPostingId: string;
  companyId: string;
  jobTitle: string;
  membershipRole: "OWNER" | "HR_MANAGER" | "RECRUITER" | "HIRING_MANAGER";
}>;

export class AnalyticsAuthorization {
  constructor(
    private readonly recruiterAuthorization: Pick<
      RecruiterApplicationAuthorization,
      "authorizeJob"
    > = new RecruiterApplicationAuthorization(),
  ) {}

  async employerJob(
    userId: string,
    requestedJobId: string,
  ): Promise<EmployerAnalyticsScope | null> {
    const result = await this.recruiterAuthorization.authorizeJob(
      userId,
      requestedJobId,
    );
    if (!result.authorized || !result.membershipRole) return null;
    return {
      jobPostingId: result.jobPostingId,
      companyId: result.companyId,
      jobTitle: result.jobTitle,
      membershipRole: result.membershipRole,
    };
  }
}
