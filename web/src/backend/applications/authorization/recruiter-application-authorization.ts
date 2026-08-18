import "server-only";

import { prisma } from "@/backend/database/prisma";

const recruiterRoles = [
  "OWNER",
  "HR_MANAGER",
  "RECRUITER",
  "HIRING_MANAGER",
] as const;

type RecruiterRole = (typeof recruiterRoles)[number];
type PipelineJobStatus = "ACTIVE" | "CLOSED";

export type RecruiterAuthorizationResult = Readonly<{
  authorized: boolean;
  requestedJobId: string;
  jobPostingId: string;
  /** @deprecated Use jobPostingId for persisted application queries. */
  jobId: string;
  companyId: string;
  jobTitle: string;
  jobStatus: PipelineJobStatus | null;
  membershipRole: RecruiterRole | null;
  canView: boolean;
  canMoveStages: boolean;
  canReject: boolean;
  canRecordOfferDeclined: boolean;
  canConfirmHired: boolean;
}>;

type MembershipRow = Readonly<{
  role: string;
  status: string;
  removedAt: Date | null;
  user: Readonly<{ state: string; deletedAt: Date | null }>;
}>;

type CompanyRow = Readonly<{
  verificationState: string;
  verifiedAt: Date | null;
  verificationInactiveAt: Date | null;
  memberships: readonly MembershipRow[];
}>;

type JobRow = Readonly<{
  id: string;
  companyId: string;
  title: string;
  status: string;
  removedAt: Date | null;
  company: CompanyRow;
}>;

function activeMembership(company: CompanyRow): MembershipRow | null {
  if (
    company.verificationState !== "ACTIVE" ||
    !company.verifiedAt ||
    company.verificationInactiveAt
  ) {
    return null;
  }
  return (
    company.memberships.find(
      (membership) =>
        membership.status === "ACTIVE" &&
        !membership.removedAt &&
        membership.user.state === "ACTIVE" &&
        !membership.user.deletedAt &&
        recruiterApplicationRoleAllowed(membership.role),
    ) ?? null
  );
}

function validJob(row: JobRow): boolean {
  return (
    (row.status === "ACTIVE" || row.status === "CLOSED") && !row.removedAt
  );
}

function denied(requestedJobId: string): RecruiterAuthorizationResult {
  return {
    authorized: false,
    requestedJobId,
    jobPostingId: "",
    jobId: requestedJobId,
    companyId: "",
    jobTitle: "",
    jobStatus: null,
    membershipRole: null,
    canView: false,
    canMoveStages: false,
    canReject: false,
    canRecordOfferDeclined: false,
    canConfirmHired: false,
  };
}

function authorized(
  requestedJobId: string,
  row: JobRow,
  membership: MembershipRow,
): RecruiterAuthorizationResult {
  const membershipRole = membership.role as RecruiterRole;
  const canMutate = recruiterApplicationMutationRoleAllowed(membershipRole);
  return {
    authorized: true,
    requestedJobId,
    jobPostingId: row.id,
    jobId: row.id,
    companyId: row.companyId,
    jobTitle: row.title,
    jobStatus: row.status as PipelineJobStatus,
    membershipRole,
    canView: true,
    canMoveStages: canMutate,
    canReject: canMutate,
    canRecordOfferDeclined: canMutate,
    canConfirmHired: canMutate,
  };
}

const jobSafetySelect = {
  id: true,
  companyId: true,
  title: true,
  status: true,
  removedAt: true,
  company: {
    select: {
      verificationState: true,
      verifiedAt: true,
      verificationInactiveAt: true,
      memberships: {
        select: {
          role: true,
          status: true,
          removedAt: true,
          user: { select: { state: true, deletedAt: true } },
        },
      },
    },
  },
} as const;

const companyAccessWhere = (userId: string) => ({
  verificationState: "ACTIVE" as const,
  verifiedAt: { not: null },
  verificationInactiveAt: null,
  memberships: {
    some: {
      userId,
      status: "ACTIVE" as const,
      removedAt: null,
      role: { in: [...recruiterRoles] },
      user: { state: "ACTIVE" as const, deletedAt: null },
    },
  },
});

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

    const databaseRows = (await this.db.jobPosting.findMany({
      where: {
        id: { in: requestedJobIds },
        status: { in: ["ACTIVE", "CLOSED"] },
        removedAt: null,
        company: companyAccessWhere(userId),
      },
      select: jobSafetySelect,
    })) as unknown as JobRow[];
    const directByRequestedId = new Map<string, RecruiterAuthorizationResult>();
    for (const row of databaseRows) {
      const membership = validJob(row) ? activeMembership(row.company) : null;
      if (membership) directByRequestedId.set(row.id, authorized(row.id, row, membership));
    }

    const unresolvedIds = requestedJobIds.filter(
      (jobId) => !directByRequestedId.has(jobId),
    );
    const aggregateRows =
      unresolvedIds.length === 0
        ? []
        : ((await this.db.jobPostReviewAggregate.findMany({
            where: {
              jobId: { in: unresolvedIds },
              publicJobPostingId: { not: null },
              company: companyAccessWhere(userId),
              publicJobPosting: {
                is: {
                  status: { in: ["ACTIVE", "CLOSED"] },
                  removedAt: null,
                },
              },
            },
            select: {
              jobId: true,
              companyId: true,
              publicJobPostingId: true,
              publicJobPosting: { select: jobSafetySelect },
              company: {
                select: {
                  verificationState: true,
                  verifiedAt: true,
                  verificationInactiveAt: true,
                  memberships: {
                    select: {
                      role: true,
                      status: true,
                      removedAt: true,
                      user: { select: { state: true, deletedAt: true } },
                    },
                  },
                },
              },
            },
          })) as unknown as Array<{
            jobId: string;
            companyId: string;
            publicJobPostingId: string | null;
            publicJobPosting: JobRow | null;
            company: CompanyRow;
          }>);

    const aggregatesByRequestedId = new Map<string, typeof aggregateRows>();
    for (const row of aggregateRows) {
      const rows = aggregatesByRequestedId.get(row.jobId) ?? [];
      rows.push(row);
      aggregatesByRequestedId.set(row.jobId, rows);
    }

    const mappedByRequestedId = new Map<string, RecruiterAuthorizationResult>();
    for (const requestedJobId of unresolvedIds) {
      const matches = aggregatesByRequestedId.get(requestedJobId) ?? [];
      if (matches.length !== 1) continue;
      const aggregate = matches[0];
      const row = aggregate.publicJobPosting;
      if (
        !row ||
        !aggregate.publicJobPostingId ||
        aggregate.publicJobPostingId !== row.id ||
        aggregate.companyId !== row.companyId ||
        !validJob(row)
      ) {
        continue;
      }
      const aggregateMembership = activeMembership(aggregate.company);
      const postingMembership = activeMembership(row.company);
      if (!aggregateMembership || !postingMembership) continue;
      mappedByRequestedId.set(
        requestedJobId,
        authorized(requestedJobId, row, postingMembership),
      );
    }

    return requestedJobIds.map(
      (jobId) =>
        directByRequestedId.get(jobId) ??
        mappedByRequestedId.get(jobId) ??
        denied(jobId),
    );
  }

  async authorizeJob(
    userId: string,
    jobId: string,
  ): Promise<RecruiterAuthorizationResult> {
    return (await this.authorizeJobs(userId, [jobId]))[0] ?? denied(jobId);
  }

  async authorizeApplication(
    userId: string,
    jobId: string,
    applicationId: string,
  ): Promise<RecruiterAuthorizationResult> {
    const result = await this.authorizeJob(userId, jobId);
    if (!result.authorized) return result;
    const application = await this.db.jobApplication.findFirst({
      where: { id: applicationId, jobPostingId: result.jobPostingId },
      select: { id: true },
    });
    return application ? result : denied(result.requestedJobId);
  }
}

export function recruiterApplicationRoleAllowed(role: string): boolean {
  return (recruiterRoles as readonly string[]).includes(role);
}

export function recruiterApplicationMutationRoleAllowed(role: string): boolean {
  return recruiterApplicationRoleAllowed(role);
}
