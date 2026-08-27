import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CompanyTeamCommandError,
  CompanyTeamService,
} from "@/backend/company-members/company-team-service";

const {
  transaction,
  accountFindUnique,
  invitationFindUnique,
  invitationUpdateMany,
} = vi.hoisted(() => ({
  transaction: vi.fn(),
  accountFindUnique: vi.fn(),
  invitationFindUnique: vi.fn(),
  invitationUpdateMany: vi.fn(),
}));

const tx = {
  userAccount: { findUnique: accountFindUnique },
  companyInvitation: {
    findUnique: invitationFindUnique,
    updateMany: invitationUpdateMany,
  },
};

vi.mock("@/backend/database/prisma", () => ({
  prisma: { $transaction: transaction },
}));

describe("Team invitation acceptance security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transaction.mockImplementation(
      async (callback: (value: typeof tx) => unknown) => callback(tx),
    );
    accountFindUnique.mockResolvedValue({
      email: "candidate@example.com",
      state: "ACTIVE",
    });
  });

  it("does not disclose an invitation or create membership for a wrong account", async () => {
    invitationFindUnique.mockResolvedValue({
      id: "invitation-1",
      companyId: "company-1",
      normalizedEmail: "other@example.com",
      role: "RECRUITER",
      state: "PENDING",
      version: 1,
      expiresAt: new Date("2026-09-03T00:00:00.000Z"),
      company: {
        displayName: "Northstar Labs",
        verificationState: "ACTIVE",
        verificationInactiveAt: null,
        moderationState: "ACTIVE",
      },
      teamApplication: null,
    });

    await expect(
      new CompanyTeamService().accept("candidate-1", "signed-token"),
    ).rejects.toEqual(new CompanyTeamCommandError("INVITATION_UNAVAILABLE"));
    expect(invitationUpdateMany).not.toHaveBeenCalled();
  });

  it("previews a notification-referenced invitation through the same account binding", async () => {
    const expiresAt = new Date("2026-09-03T00:00:00.000Z");
    invitationFindUnique.mockResolvedValue({
      id: "invitation-1",
      companyId: "company-1",
      normalizedEmail: "candidate@example.com",
      role: "RECRUITER",
      state: "PENDING",
      version: 1,
      expiresAt,
      company: {
        displayName: "Northstar Labs",
        verificationState: "ACTIVE",
        verificationInactiveAt: null,
        moderationState: "ACTIVE",
      },
    });

    await expect(
      new CompanyTeamService().previewById("candidate-1", "invitation-1"),
    ).resolves.toEqual({
      companyName: "Northstar Labs",
      role: "RECRUITER",
      expiresAt,
    });
    expect(invitationFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "invitation-1" } }),
    );
  });

  it.each([
    ["expired", "PENDING", new Date("2026-08-01T00:00:00.000Z")],
    ["revoked", "REVOKED", new Date("2026-09-03T00:00:00.000Z")],
    ["already accepted", "ACCEPTED", new Date("2026-09-03T00:00:00.000Z")],
  ] as const)(
    "rejects a %s invitation without membership changes",
    async (_label, state, expiresAt) => {
      invitationFindUnique.mockResolvedValue({
        id: "invitation-1",
        companyId: "company-1",
        normalizedEmail: "candidate@example.com",
        role: "HR_MANAGER",
        state,
        version: 1,
        expiresAt,
        company: {
          displayName: "Northstar Labs",
          verificationState: "ACTIVE",
          verificationInactiveAt: null,
          moderationState: "ACTIVE",
        },
        teamApplication: null,
      });

      await expect(
        new CompanyTeamService().accept("candidate-1", "signed-token"),
      ).rejects.toEqual(new CompanyTeamCommandError("INVITATION_UNAVAILABLE"));
      expect(invitationUpdateMany).not.toHaveBeenCalled();
    },
  );

  it("keeps acceptance one-time when the invitation claim loses its version race", async () => {
    invitationFindUnique.mockResolvedValue({
      id: "invitation-1",
      companyId: "company-1",
      normalizedEmail: "candidate@example.com",
      role: "RECRUITER",
      state: "PENDING",
      version: 1,
      expiresAt: new Date("2026-09-03T00:00:00.000Z"),
      company: {
        displayName: "Northstar Labs",
        verificationState: "ACTIVE",
        verificationInactiveAt: null,
        moderationState: "ACTIVE",
      },
      teamApplication: null,
    });
    invitationUpdateMany.mockResolvedValue({ count: 0 });

    await expect(
      new CompanyTeamService().accept("candidate-1", "signed-token"),
    ).rejects.toEqual(new CompanyTeamCommandError("INVITATION_UNAVAILABLE"));
  });
});
