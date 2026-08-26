import "server-only";
import type {
  CompanyModerationState,
  CompanyVerificationState,
  Prisma,
} from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";
import { calculationMetadata } from "@/backend/admin/dashboard/dashboard-definition";

export class PrismaAdminMembershipRepository {
  async companies(input: {
    page: number;
    perPage: number;
    filter: Record<string, unknown>;
  }) {
    const now = new Date();
    const q = typeof input.filter.q === "string" ? input.filter.q.trim() : "";
    const verificationStates = ["ACTIVE", "INACTIVE", "UNVERIFIED"] as const;
    const verificationState: CompanyVerificationState | undefined =
      typeof input.filter.verificationState === "string" &&
      verificationStates.some(
        (state) => state === input.filter.verificationState,
      )
        ? (input.filter.verificationState as CompanyVerificationState)
        : undefined;
    const moderationState: CompanyModerationState | undefined =
      input.filter.moderationState === "ACTIVE" ||
      input.filter.moderationState === "BANNED"
        ? input.filter.moderationState
        : undefined;
    const needsAttention = input.filter.attention === "NEEDS_ATTENTION";
    const date = (value: unknown, endOfDay = false) => {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value))
        return undefined;
      const parsed = new Date(
        `${value}${endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z"}`,
      );
      return Number.isNaN(parsed.valueOf()) ? undefined : parsed;
    };
    const createdFrom = date(input.filter.createdFrom);
    const createdTo = date(input.filter.createdTo, true);
    const attentionReportCompanies = needsAttention
      ? await prisma.moderationReport.findMany({
          where: {
            companyReference: { not: null },
            state: "PENDING_REVIEW",
          },
          distinct: ["companyReference"],
          select: { companyReference: true },
        })
      : [];
    const attentionConditions: Prisma.CompanyWhereInput[] = [
      { moderationState: "BANNED" },
      { verificationState: { in: ["UNVERIFIED", "INACTIVE"] } },
      { memberships: { none: { status: "ACTIVE", role: "OWNER" } } },
      {
        jobPostReviewAggregates: {
          some: { pendingVersionId: { not: null }, softDeletedAt: null },
        },
      },
      {
        id: {
          in: attentionReportCompanies.flatMap((report) =>
            report.companyReference ? [report.companyReference] : [],
          ),
        },
      },
    ];
    const where: Prisma.CompanyWhereInput = {
      AND: [
        ...(q
          ? [
              {
                OR: [
                  { id: q },
                  {
                    legalName: {
                      contains: q,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    displayName: {
                      contains: q,
                      mode: "insensitive" as const,
                    },
                  },
                ],
              },
            ]
          : []),
        ...(verificationState ? [{ verificationState }] : []),
        ...(moderationState ? [{ moderationState }] : []),
        ...(createdFrom || createdTo
          ? [
              {
                createdAt: {
                  ...(createdFrom ? { gte: createdFrom } : {}),
                  ...(createdTo ? { lte: createdTo } : {}),
                },
              },
            ]
          : []),
        ...(needsAttention ? [{ OR: attentionConditions }] : []),
      ],
    };
    const [rows, total] = await Promise.all([
      prisma.company.findMany({
        where,
        select: {
          id: true,
          legalName: true,
          displayName: true,
          verificationState: true,
          moderationState: true,
          createdAt: true,
          updatedAt: true,
        },
        skip: (input.page - 1) * input.perPage,
        take: input.perPage,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      }),
      prisma.company.count({ where }),
    ]);
    const companyIds = rows.map((row) => row.id);
    const [activeMemberships, activeOwners, pendingReviews, openReports] =
      await Promise.all([
        prisma.companyMembership.groupBy({
          by: ["companyId"],
          where: { companyId: { in: companyIds }, status: "ACTIVE" },
          _count: { _all: true },
        }),
        prisma.companyMembership.groupBy({
          by: ["companyId"],
          where: {
            companyId: { in: companyIds },
            status: "ACTIVE",
            role: "OWNER",
          },
          _count: { _all: true },
        }),
        prisma.jobPostReviewAggregate.groupBy({
          by: ["companyId"],
          where: {
            companyId: { in: companyIds },
            pendingVersionId: { not: null },
            softDeletedAt: null,
          },
          _count: { _all: true },
        }),
        prisma.moderationReport.groupBy({
          by: ["companyReference"],
          where: {
            companyReference: { in: companyIds },
            state: "PENDING_REVIEW",
          },
          _count: { _all: true },
        }),
      ]);
    const countByCompany = <
      T extends { companyId: string; _count: { _all: number } },
    >(
      values: T[],
    ) => new Map(values.map((value) => [value.companyId, value._count._all]));
    const activeMembershipCount = countByCompany(activeMemberships);
    const activeOwnerCount = countByCompany(activeOwners);
    const pendingReviewCount = countByCompany(pendingReviews);
    const openReportCount = new Map(
      openReports.flatMap((report) =>
        report.companyReference
          ? [[report.companyReference, report._count._all] as const]
          : [],
      ),
    );
    return {
      data: rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        metrics: {
          activeMembershipCount: activeMembershipCount.get(row.id) ?? 0,
          activeOwnerCount: activeOwnerCount.get(row.id) ?? 0,
          pendingJobReviewCount: pendingReviewCount.get(row.id) ?? 0,
          openModerationReportCount: openReportCount.get(row.id) ?? 0,
        },
      })),
      total,
      ...calculationMetadata(now),
    };
  }
  async companyDetail(companyId: string) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        legalName: true,
        displayName: true,
        verificationState: true,
        moderationState: true,
        moderationVersion: true,
        bannedAt: true,
        verifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!company) return null;
    const [
      membershipStates,
      activeOwnerCount,
      recentMemberships,
      verificationCount,
      latestVerification,
      jobStates,
      pendingJobReviewCount,
      openModerationReportCount,
    ] = await Promise.all([
      prisma.companyMembership.groupBy({
        by: ["status"],
        where: { companyId },
        _count: { _all: true },
      }),
      prisma.companyMembership.count({
        where: { companyId, status: "ACTIVE", role: "OWNER" },
      }),
      prisma.companyMembership.findMany({
        where: { companyId },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: 5,
        select: {
          id: true,
          role: true,
          status: true,
          updatedAt: true,
          user: { select: { name: true } },
        },
      }),
      prisma.recruiterVerificationRequest.count({
        where: { targetCompanyId: companyId },
      }),
      prisma.recruiterVerificationRequest.findFirst({
        where: { targetCompanyId: companyId },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        select: { id: true, state: true, createdAt: true, updatedAt: true },
      }),
      prisma.jobPosting.groupBy({
        by: ["status"],
        where: { companyId, removedAt: null },
        _count: { _all: true },
      }),
      prisma.jobPostReviewAggregate.count({
        where: {
          companyId,
          pendingVersionId: { not: null },
          softDeletedAt: null,
        },
      }),
      prisma.moderationReport.count({
        where: { companyReference: companyId, state: "PENDING_REVIEW" },
      }),
    ]);
    const memberships = Object.fromEntries(
      membershipStates.map((row) => [row.status, row._count._all]),
    );
    const jobs = Object.fromEntries(
      jobStates.map((row) => [row.status, row._count._all]),
    );
    return {
      id: company.id,
      company: {
        id: company.id,
        legalName: company.legalName,
        displayName: company.displayName,
        verificationState: company.verificationState,
        moderationState: company.moderationState,
        moderationVersion: company.moderationVersion,
        bannedAt: company.bannedAt?.toISOString() ?? null,
        verifiedAt: company.verifiedAt?.toISOString() ?? null,
        createdAt: company.createdAt.toISOString(),
        updatedAt: company.updatedAt.toISOString(),
      },
      membershipSummary: {
        total: membershipStates.reduce(
          (total, row) => total + row._count._all,
          0,
        ),
        active: memberships.ACTIVE ?? 0,
        suspended: memberships.SUSPENDED ?? 0,
        removed: memberships.REMOVED ?? 0,
        activeOwnerCount,
        recent: recentMemberships.map((membership) => ({
          id: membership.id,
          accountDisplayName: membership.user.name,
          role: membership.role,
          state: membership.status,
          updatedAt: membership.updatedAt.toISOString(),
        })),
      },
      verificationSummary: {
        totalRequestCount: verificationCount,
        latest: latestVerification
          ? {
              id: latestVerification.id,
              state: latestVerification.state,
              submittedAt: latestVerification.createdAt.toISOString(),
              updatedAt: latestVerification.updatedAt.toISOString(),
            }
          : null,
      },
      activitySummary: {
        activeJobCount: jobs.ACTIVE ?? 0,
        closedJobCount: jobs.CLOSED ?? 0,
        pendingJobReviewCount,
        openModerationReportCount,
      },
    };
  }
  async list(input: {
    page: number;
    perPage: number;
    filter: Record<string, unknown>;
  }) {
    const now = new Date();
    const q = typeof input.filter.q === "string" ? input.filter.q.trim() : "";
    const where: Prisma.CompanyMembershipWhereInput = {
      ...(q
        ? {
            OR: [
              { id: q },
              { companyId: q },
              { userId: q },
              {
                company: {
                  is: {
                    OR: [
                      { legalName: { contains: q, mode: "insensitive" } },
                      { displayName: { contains: q, mode: "insensitive" } },
                    ],
                  },
                },
              },
              { user: { is: { name: { contains: q, mode: "insensitive" } } } },
            ],
          }
        : {}),
      ...(typeof input.filter.companyId === "string"
        ? { companyId: input.filter.companyId.trim() }
        : {}),
      ...(typeof input.filter.accountId === "string"
        ? { userId: input.filter.accountId.trim() }
        : {}),
      ...(typeof input.filter.role === "string"
        ? {
            role: input.filter.role as
              | "OWNER"
              | "HR_MANAGER"
              | "RECRUITER"
              | "HIRING_MANAGER",
          }
        : {}),
      ...(typeof input.filter.state === "string"
        ? { status: input.filter.state as "ACTIVE" | "SUSPENDED" | "REMOVED" }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.companyMembership.findMany({
        where,
        include: {
          company: {
            select: {
              id: true,
              legalName: true,
              verificationState: true,
              moderationState: true,
            },
          },
          user: { select: { name: true } },
        },
        skip: (input.page - 1) * input.perPage,
        take: input.perPage,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      }),
      prisma.companyMembership.count({ where }),
    ]);
    return {
      data: rows.map((row) => ({
        id: row.id,
        company: row.company,
        companyId: row.companyId,
        accountId: row.userId,
        accountDisplayName: row.user.name,
        role: row.role,
        state: row.status,
        accessState:
          row.company.moderationState === "BANNED"
            ? "COMPANY_BANNED"
            : row.status,
        priorApprovedRole: row.priorApprovedRole ?? row.role,
        version: row.version,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      total,
      ...calculationMetadata(now),
    };
  }
  async one(id: string) {
    const row = await prisma.companyMembership.findUnique({
      where: { id },
      include: {
        company: {
          select: { id: true, legalName: true, verificationState: true },
        },
        user: { select: { name: true } },
        history: {
          orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
          take: 25,
        },
      },
    });
    return row
      ? {
          id: row.id,
          company: row.company,
          companyId: row.companyId,
          accountId: row.userId,
          accountDisplayName: row.user.name,
          role: row.role,
          state: row.status,
          priorApprovedRole: row.priorApprovedRole ?? row.role,
          version: row.version,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
          history: row.history,
        }
      : null;
  }
}
