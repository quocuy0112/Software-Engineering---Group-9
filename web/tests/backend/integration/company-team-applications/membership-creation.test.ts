import { beforeEach, describe, expect, it, vi } from "vitest";
import { CompanyTeamService } from "@/backend/company-members/company-team-service";

const {
  transaction,
  invitationFindUnique,
  membershipFindUnique,
  membershipCreate,
  teamApplicationUpdate,
} = vi.hoisted(() => ({
  transaction: vi.fn(),
  invitationFindUnique: vi.fn(),
  membershipFindUnique: vi.fn(),
  membershipCreate: vi.fn(),
  teamApplicationUpdate: vi.fn(),
}));

const tx = {
  userAccount: {
    findUnique: vi.fn(),
  },
  companyInvitation: {
    findUnique: invitationFindUnique,
    updateMany: vi.fn(),
  },
  auditEvent: {
    create: vi.fn(),
  },
  companyMembership: {
    findUnique: membershipFindUnique,
    create: membershipCreate,
    update: vi.fn(),
  },
  companyMembershipHistory: {
    create: vi.fn(),
  },
  teamApplication: {
    updateMany: teamApplicationUpdate,
  },
  companyTeamActivity: {
    create: vi.fn(),
  },
};

vi.mock("@/backend/database/prisma", () => ({
  prisma: {
    $transaction: transaction,
  },
}));
vi.mock("@/backend/notifications/notification-service", () => ({
  createInAppNotification: vi.fn(),
}));
vi.mock("@/backend/repositories/email/outbox-repository", () => ({
  PrismaOutboxRepository: vi.fn().mockImplementation(function () {
    return {
      enqueueIdempotent: vi.fn(),
    };
  }),
}));

describe("Team invitation membership creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transaction.mockImplementation(
      async (callback: (value: typeof tx) => unknown) => callback(tx),
    );
    tx.userAccount.findUnique.mockResolvedValue({
      email: "candidate@example.com",
      state: "ACTIVE",
    });
    invitationFindUnique.mockResolvedValue({
      id: "invitation-1",
      companyId: "company-1",
      normalizedEmail: "candidate@example.com",
      role: "RECRUITER",
      state: "PENDING",
      version: 1,
      expiresAt: new Date("2026-09-03T00:00:00.000Z"),
      invitedByUserId: "owner-1",
      company: {
        displayName: "Northstar Labs",
        verificationState: "ACTIVE",
        verificationInactiveAt: null,
        moderationState: "ACTIVE",
      },
      teamApplication: {
        id: "application-1",
        status: "INVITATION_SENT",
      },
    });
    tx.companyInvitation.updateMany.mockResolvedValue({ count: 1 });
    membershipFindUnique.mockResolvedValue(null);
    membershipCreate.mockResolvedValue({
      id: "membership-1",
      status: "ACTIVE",
      role: "RECRUITER",
      version: 1,
    });
    teamApplicationUpdate.mockResolvedValue({ count: 1 });
  });

  it("creates membership only after a valid invitation is explicitly accepted", async () => {
    await new CompanyTeamService().accept("candidate-1", "signed-token");

    expect(membershipCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: "company-1",
        userId: "candidate-1",
        role: "RECRUITER",
        status: "ACTIVE",
      }),
    });
    expect(teamApplicationUpdate).toHaveBeenCalledWith({
      where: { id: "application-1", status: "INVITATION_SENT" },
      data: expect.objectContaining({
        status: "JOINED",
      }),
    });
  });
});
