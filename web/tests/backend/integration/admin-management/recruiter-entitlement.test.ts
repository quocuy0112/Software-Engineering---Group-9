import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/backend/database/prisma";
import { requireSession } from "@/backend/auth/session/require-session";
import { RecruiterEntitlementService } from "@/backend/admin/memberships/recruiter-entitlement-service";

vi.mock("@/backend/auth/session/require-session", () => ({
  requireSession: vi.fn(),
}));

const suffix = crypto.randomUUID();
const userId = `entitlement-user-${suffix}`;
const companyA = `entitlement-company-a-${suffix}`;
const companyB = `entitlement-company-b-${suffix}`;
const request = new Request(
  "http://console.recruiter.localhost:3001/api/recruiter/entitlement",
);

describe("recruiter entitlement isolation", () => {
  beforeEach(async () => {
    vi.mocked(requireSession).mockResolvedValue({
      userId,
      sessionId: `session-${suffix}`,
    } as never);
    await prisma.userAccount.create({
      data: {
        id: userId,
        name: "Recruiter",
        email: `${userId}@example.test`,
        normalizedEmail: `${userId}@example.test`,
        state: "ACTIVE",
        emailVerified: true,
      },
    });
    await prisma.company.createMany({
      data: [
        {
          id: companyA,
          slug: companyA,
          legalName: "Alpha Legal",
          displayName: "Alpha",
          verificationState: "ACTIVE",
        },
        {
          id: companyB,
          slug: companyB,
          legalName: "Beta Legal",
          displayName: "Beta",
          verificationState: "ACTIVE",
        },
      ],
    });
    await prisma.companyMembership.createMany({
      data: [
        {
          id: `entitlement-ma-${suffix}`,
          companyId: companyA,
          userId,
          role: "RECRUITER",
          priorApprovedRole: "RECRUITER",
          status: "ACTIVE",
        },
        {
          id: `entitlement-mb-${suffix}`,
          companyId: companyB,
          userId,
          role: "HIRING_MANAGER",
          priorApprovedRole: "HIRING_MANAGER",
          status: "ACTIVE",
        },
      ],
    });
  });

  afterEach(async () => {
    await prisma.companyMembership.deleteMany({ where: { userId } });
    await prisma.platformAdministratorGrant.deleteMany({ where: { userId } });
    await prisma.company.deleteMany({
      where: { id: { in: [companyA, companyB] } },
    });
    await prisma.userAccount.deleteMany({ where: { id: userId } });
    vi.restoreAllMocks();
  });

  it("requires explicit company selection and returns only safe active options", async () => {
    const service = new RecruiterEntitlementService();
    const unselected = await service.resolve(request);
    expect(unselected).toMatchObject({
      available: false,
      requiresSelection: true,
      selectedCompanyId: null,
    });
    expect(unselected.companies.map((item) => item.companyId)).toEqual([
      companyA,
      companyB,
    ]);
    expect(unselected.destinations.map((item) => item.label)).toEqual([
      "Candidate Dashboard",
      "Employer Verification",
    ]);
    expect(await service.resolve(request, companyB)).toMatchObject({
      available: true,
      requiresSelection: false,
      selectedCompanyId: companyB,
    });
  });

  it("revalidates current membership state and an administrator grant is not a substitute", async () => {
    await prisma.companyMembership.update({
      where: { companyId_userId: { companyId: companyA, userId } },
      data: { status: "SUSPENDED" },
    });
    const service = new RecruiterEntitlementService();
    const stale = await service.resolve(request, companyA);
    expect(stale).toMatchObject({
      available: true,
      requiresSelection: false,
      selectedCompanyId: companyB,
    });
    expect(stale.companies.map((item) => item.companyId)).toEqual([companyB]);

    await prisma.companyMembership.update({
      where: { companyId_userId: { companyId: companyB, userId } },
      data: { status: "REMOVED", removedAt: new Date() },
    });
    await prisma.platformAdministratorGrant.create({
      data: { id: `entitlement-grant-${suffix}`, userId, state: "ACTIVE" },
    });
    expect(await service.resolve(request)).toMatchObject({
      available: false,
      companies: [],
    });
  });
});
