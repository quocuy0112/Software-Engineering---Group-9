import "server-only";
import type {
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
    const where: Prisma.CompanyWhereInput = {
      ...(q
        ? {
            OR: [
              { id: q },
              { legalName: { contains: q, mode: "insensitive" } },
              { displayName: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(verificationState ? { verificationState } : {}),
      ...(createdFrom || createdTo
        ? {
            createdAt: {
              ...(createdFrom ? { gte: createdFrom } : {}),
              ...(createdTo ? { lte: createdTo } : {}),
            },
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.company.findMany({
        where,
        select: {
          id: true,
          legalName: true,
          displayName: true,
          verificationState: true,
        },
        skip: (input.page - 1) * input.perPage,
        take: input.perPage,
        orderBy: [{ legalName: "asc" }, { id: "asc" }],
      }),
      prisma.company.count({ where }),
    ]);
    return { data: rows, total, ...calculationMetadata(now) };
  }
  async companyDetail(companyId: string) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        legalName: true,
        displayName: true,
        verificationState: true,
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
    const where = {
      ...(typeof input.filter.companyId === "string"
        ? { companyId: input.filter.companyId }
        : {}),
      ...(typeof input.filter.accountId === "string"
        ? { userId: input.filter.accountId }
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
            select: { id: true, legalName: true, verificationState: true },
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
