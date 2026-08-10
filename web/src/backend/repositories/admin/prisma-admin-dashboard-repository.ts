import "server-only";
import { prisma } from "@/backend/database/prisma";
import {
  DASHBOARD_MAX_AGE_MS,
  DASHBOARD_STATE_DEFINITION_VERSION,
  dashboardDefinition,
  type DashboardMetricKey,
  type DashboardMetrics,
} from "@/backend/admin/dashboard/dashboard-definition";

export class PrismaAdminDashboardRepository {
  async calculate(now = new Date()): Promise<DashboardMetrics> {
    void now;
    const [
      active,
      suspended,
      pending,
      recruiterUsers,
      roles,
      suspendedMemberships,
      pendingVerification,
      pendingModeration,
    ] = await Promise.all([
      prisma.userAccount.count({
        where: { state: "ACTIVE", candidateIdentity: { isNot: null } },
      }),
      prisma.userAccount.count({
        where: { state: "SUSPENDED", candidateIdentity: { isNot: null } },
      }),
      prisma.userAccount.count({
        where: {
          state: "PENDING_VERIFICATION",
          candidateIdentity: { isNot: null },
        },
      }),
      prisma.companyMembership.groupBy({
        by: ["userId"],
        where: { status: "ACTIVE", user: { state: "ACTIVE" } },
      }),
      prisma.companyMembership.groupBy({
        by: ["role"],
        where: { status: "ACTIVE" },
        _count: { _all: true },
      }),
      prisma.companyMembership.count({ where: { status: "SUSPENDED" } }),
      prisma.recruiterVerificationRequest.count({
        where: {
          state: { in: ["PENDING_CHECKS", "PENDING_REVIEW", "RESUBMITTED"] },
        },
      }),
      prisma.moderationReport.count({ where: { state: "PENDING_REVIEW" } }),
    ]);
    const roleCount = Object.fromEntries(
      roles.map((row) => [row.role, row._count._all]),
    );
    const values: Record<DashboardMetricKey, number> = {
      candidateActive: active,
      candidateSuspended: suspended,
      candidatePending: pending,
      recruiterEnabledAccounts: recruiterUsers.length,
      ownerMemberships: roleCount.OWNER ?? 0,
      hrManagerMemberships: roleCount.HR_MANAGER ?? 0,
      recruiterMemberships: roleCount.RECRUITER ?? 0,
      hiringManagerMemberships: roleCount.HIRING_MANAGER ?? 0,
      suspendedMemberships,
      pendingVerificationRequests: pendingVerification,
      pendingModerationReports: pendingModeration,
    };
    return Object.fromEntries(
      (Object.keys(dashboardDefinition) as DashboardMetricKey[]).map((key) => [
        key,
        { value: values[key], unit: dashboardDefinition[key].unit },
      ]),
    ) as DashboardMetrics;
  }

  create(metrics: DashboardMetrics, calculatedAt: Date) {
    return prisma.adminDashboardSnapshot.create({
      data: {
        calculatedAt,
        expiresAt: new Date(calculatedAt.getTime() + DASHBOARD_MAX_AGE_MS),
        stateDefinitionVersion: DASHBOARD_STATE_DEFINITION_VERSION,
        metrics,
      },
    });
  }

  current(now = new Date()) {
    return prisma.adminDashboardSnapshot.findFirst({
      where: {
        expiresAt: { gt: now },
        calculatedAt: { lte: now },
        stateDefinitionVersion: DASHBOARD_STATE_DEFINITION_VERSION,
      },
      orderBy: [{ calculatedAt: "desc" }, { id: "desc" }],
    });
  }

  cleanup(before: Date) {
    return prisma.adminDashboardSnapshot.deleteMany({
      where: { expiresAt: { lt: before } },
    });
  }
}
