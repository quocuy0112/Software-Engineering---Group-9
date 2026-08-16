import "server-only";

import { prisma } from "@/backend/database/prisma";
import { authorizeLegacyRecruiterJobs } from "@/backend/services/jobs/recruiter-job-posting-data";

const recruiterRoles = [
  "OWNER",
  "HR_MANAGER",
  "RECRUITER",
  "HIRING_MANAGER",
] as const;

export type RecruiterAuthorizationResult = Readonly<{
  authorized: boolean;
  jobId: string;
  companyId: string;
  jobTitle: string;
}>;

export class RecruiterApplicationAuthorization {
  constructor(private readonly db: typeof prisma = prisma) {}

  async authorizeJobs(
    userId: string,
    jobIds: readonly string[],
  ): Promise<RecruiterAuthorizationResult[]> {
    const requestedJobIds = [
      ...new Set(jobIds.map((jobId) => jobId.trim()).filter(Boolean)),
    ];
    if (requestedJobIds.length === 0) return [];

    const databaseRows = await this.db.jobPosting.findMany({
      where: {
        id: { in: requestedJobIds },
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
    const databaseById = new Map(
      databaseRows.map((row) => [
        row.id,
        {
          authorized: true,
          jobId: row.id,
          companyId: row.companyId,
          jobTitle: row.title,
        } satisfies RecruiterAuthorizationResult,
      ]),
    );
    const legacyIds = requestedJobIds.filter(
      (jobId) => !databaseById.has(jobId),
    );
    const legacyById =
      legacyIds.length > 0
        ? await authorizeLegacyRecruiterJobs(userId, legacyIds)
        : new Map();
    const denied = (jobId: string): RecruiterAuthorizationResult => ({
      authorized: false,
      jobId,
      companyId: "",
      jobTitle: "",
    });

    return requestedJobIds.map(
      (jobId) =>
        databaseById.get(jobId) ??
        (legacyById.get(jobId)
          ? { authorized: true, ...legacyById.get(jobId)! }
          : denied(jobId)),
    );
  }

  async authorizeJob(
    userId: string,
    jobId: string,
  ): Promise<RecruiterAuthorizationResult> {
    return (
      (await this.authorizeJobs(userId, [jobId]))[0] ?? {
        authorized: false,
        jobId,
        companyId: "",
        jobTitle: "",
      }
    );
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
    return application
      ? result
      : { authorized: false, jobId, companyId: "", jobTitle: "" };
  }
}

export function recruiterApplicationRoleAllowed(role: string): boolean {
  return (recruiterRoles as readonly string[]).includes(role);
}
