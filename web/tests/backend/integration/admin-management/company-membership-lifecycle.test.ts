import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/backend/database/prisma";
import { AdminMembershipService } from "@/backend/admin/memberships/admin-membership-service";

const suffix = crypto.randomUUID();
const targetId = `membership-user-${suffix}`;
const companyA = `company-a-${suffix}`;
const companyB = `company-b-${suffix}`;
const quotaCompanyIds: string[] = [];
const authority = {
  userId: `admin-${suffix}`,
  sessionId: `session-${suffix}`,
  grantId: `grant-${suffix}`,
  proofAt: new Date(),
};
describe("company-scoped membership lifecycle", () => {
  beforeEach(async () => {
    await prisma.userAccount.create({
      data: {
        id: targetId,
        name: "Target",
        email: `${targetId}@example.test`,
        normalizedEmail: `${targetId}@example.test`,
        state: "ACTIVE",
        emailVerified: true,
        candidateIdentity: { create: {} },
      },
    });
    await prisma.company.createMany({
      data: [
        {
          id: companyA,
          slug: companyA,
          legalName: "Company A",
          displayName: "Company A",
          verificationState: "ACTIVE",
        },
        {
          id: companyB,
          slug: companyB,
          legalName: "Company B",
          displayName: "Company B",
          verificationState: "ACTIVE",
        },
      ],
    });
    await prisma.companyMembership.createMany({
      data: [
        {
          id: `ma-${suffix}`,
          companyId: companyA,
          userId: targetId,
          role: "RECRUITER",
          priorApprovedRole: "RECRUITER",
        },
        {
          id: `mb-${suffix}`,
          companyId: companyB,
          userId: targetId,
          role: "HIRING_MANAGER",
          priorApprovedRole: "HIRING_MANAGER",
        },
      ],
    });
  });
  afterEach(async () => {
    await prisma.securityNotificationWork.deleteMany({
      where: { targetUserId: targetId },
    });
    await prisma.privilegedActionRationale.deleteMany({
      where: {
        correlationId: {
          in: (
            await prisma.auditEvent.findMany({
              where: { targetId: { in: [`ma-${suffix}`, `mb-${suffix}`] } },
              select: { correlationId: true },
            })
          ).map((r) => r.correlationId),
        },
      },
    });
    await prisma.adminCommandReceipt.deleteMany({
      where: { targetReference: { in: [`ma-${suffix}`, `mb-${suffix}`] } },
    });
    await prisma.companyMembership.deleteMany({ where: { userId: targetId } });
    await prisma.companyMembership.deleteMany({
      where: { companyId: { in: quotaCompanyIds } },
    });
    await prisma.company.deleteMany({
      where: { id: { in: quotaCompanyIds } },
    });
    quotaCompanyIds.length = 0;
    await prisma.company.deleteMany({
      where: { id: { in: [companyA, companyB] } },
    });
    await prisma.candidateIdentity.delete({ where: { userId: targetId } });
    await prisma.userAccount.delete({ where: { id: targetId } });
  });
  const command = (version: number) => ({
    expectedVersion: version,
    idempotencyKey: crypto.randomUUID(),
    reasonCategory: "ACCESS_CLEANUP",
    explanation: "Approved company access lifecycle action.",
  });
  it("suspends and restores only the selected membership and retained role", async () => {
    const service = new AdminMembershipService();
    await service.suspend(authority, `ma-${suffix}`, command(1));
    expect(
      await prisma.companyMembership.findUniqueOrThrow({
        where: { id: `ma-${suffix}` },
      }),
    ).toMatchObject({ status: "SUSPENDED", priorApprovedRole: "RECRUITER" });
    expect(
      (
        await prisma.companyMembership.findUniqueOrThrow({
          where: { id: `mb-${suffix}` },
        })
      ).status,
    ).toBe("ACTIVE");
    await service.restore(authority, `ma-${suffix}`, command(2));
    expect(
      await prisma.companyMembership.findUniqueOrThrow({
        where: { id: `ma-${suffix}` },
      }),
    ).toMatchObject({ status: "ACTIVE", role: "RECRUITER" });
  });
  it("makes removal terminal and preserves Candidate identity", async () => {
    await new AdminMembershipService().remove(
      authority,
      `ma-${suffix}`,
      command(1),
    );
    const row = await prisma.companyMembership.findUniqueOrThrow({
      where: { id: `ma-${suffix}` },
    });
    expect(row.status).toBe("REMOVED");
    expect(
      await prisma.candidateIdentity.findUnique({
        where: { userId: targetId },
      }),
    ).not.toBeNull();
    await expect(
      new AdminMembershipService().restore(
        authority,
        row.id,
        command(row.version),
      ),
    ).rejects.toThrow("INVALID_STATE");
  });

  it("does not restore a suspended owner above the per-user ownership limit", async () => {
    await prisma.companyMembership.update({
      where: { id: `ma-${suffix}` },
      data: {
        role: "OWNER",
        priorApprovedRole: "OWNER",
        status: "SUSPENDED",
        version: 2,
      },
    });
    await prisma.companyMembership.update({
      where: { id: `mb-${suffix}` },
      data: { role: "OWNER", priorApprovedRole: "OWNER" },
    });
    for (const index of [1, 2]) {
      const company = await prisma.company.create({
        data: {
          id: `quota-company-${suffix}-${index}`,
          slug: `quota-company-${suffix}-${index}`,
          legalName: `Quota Company ${suffix} ${index}`,
          displayName: `Quota Company ${suffix} ${index}`,
          verificationState: "ACTIVE",
          memberships: {
            create: {
              userId: targetId,
              role: "OWNER",
              status: "ACTIVE",
            },
          },
        },
      });
      quotaCompanyIds.push(company.id);
    }

    await expect(
      new AdminMembershipService().restore(
        authority,
        `ma-${suffix}`,
        command(2),
      ),
    ).rejects.toThrow("OWNER_COMPANY_LIMIT_REACHED");
    expect(
      await prisma.companyMembership.findUniqueOrThrow({
        where: { id: `ma-${suffix}` },
      }),
    ).toMatchObject({ status: "SUSPENDED", version: 2 });
  });
});
