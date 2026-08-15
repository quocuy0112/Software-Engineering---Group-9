import "server-only";

import { prisma } from "@/backend/database/prisma";

const recruiterRoles = ["OWNER", "HR_MANAGER", "RECRUITER", "HIRING_MANAGER"] as const;

export type RecruiterAuthorizationResult = Readonly<{
  authorized: boolean;
  jobId: string;
  companyId: string;
  jobTitle: string;
}>;

export class RecruiterApplicationAuthorization {
  constructor(private readonly db: typeof prisma = prisma) {}

  async authorizeJob(
    userId: string,
    jobId: string,
  ): Promise<RecruiterAuthorizationResult> {
    const row = await this.db.jobPosting.findFirst({
      where: {
        id: jobId,
        company: {
          verificationState: "ACTIVE",
          verifiedAt: { not: null },
          memberships: {
            some: {
              userId,
              status: "ACTIVE",
              role: { in: [...recruiterRoles] },
            },
          },
        },
      },
      select: { id: true, companyId: true, title: true },
    });
    return row
      ? { authorized: true, jobId: row.id, companyId: row.companyId, jobTitle: row.title }
      : { authorized: false, jobId, companyId: "", jobTitle: "" };
  }

  async authorizeApplication(
    userId: string,
    jobId: string,
    applicationId: string,
  ): Promise<RecruiterAuthorizationResult> {
    const result = await this.authorizeJob(userId, jobId);
    if (!result.authorized) return result;
    const application = await this.db.jobApplication.findFirst({
      where: { id: applicationId, jobPostingId: jobId },
      select: { id: true },
    });
    return application ? result : { authorized: false, jobId, companyId: "", jobTitle: "" };
  }
}

export function recruiterApplicationRoleAllowed(role: string): boolean {
  return (recruiterRoles as readonly string[]).includes(role);
}
