import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  TeamApplicationCommandError,
  TeamApplicationService,
} from "@/backend/services/company-members/team-application-service";

const { createNotificationMock, prismaMock, transaction, tx } = vi.hoisted(
  () => {
    const tx = {
      company: { findFirst: vi.fn() },
      companyMembership: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      teamOpportunity: { upsert: vi.fn() },
      teamApplication: { findFirst: vi.fn(), create: vi.fn() },
      auditEvent: { create: vi.fn() },
    };
    const transaction = vi.fn();
    const prismaMock = {
      $transaction: transaction,
      userAccount: { findUnique: vi.fn() },
      companyInvitation: { updateMany: vi.fn() },
      teamApplication: { findFirst: vi.fn(), updateMany: vi.fn() },
    };
    return {
      createNotificationMock: vi.fn(),
      prismaMock,
      transaction,
      tx,
    };
  },
);

vi.mock("@/backend/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/backend/notifications/notification-service", () => ({
  createInAppNotification: createNotificationMock,
}));

describe("TeamApplicationService owner availability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transaction.mockImplementation(
      async (callback: (value: typeof tx) => unknown) => callback(tx),
    );
    prismaMock.userAccount.findUnique.mockResolvedValue({
      email: "candidate@example.com",
      state: "ACTIVE",
      candidateIdentity: { userId: "candidate-1" },
    });
    prismaMock.companyInvitation.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.teamApplication.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.teamApplication.findFirst.mockResolvedValue(null);
    tx.company.findFirst.mockResolvedValue({
      id: "company-1",
      displayName: "Northstar Labs",
    });
    tx.companyMembership.findMany.mockResolvedValue([]);
    tx.companyMembership.findUnique.mockResolvedValue(null);
    tx.teamApplication.findFirst.mockResolvedValue(null);
    tx.teamApplication.create.mockResolvedValue({ id: "application-1" });
    tx.auditEvent.create.mockResolvedValue({});
    tx.teamOpportunity.upsert.mockResolvedValue({
      id: "opportunity-1",
      state: "OPEN",
    });
  });

  it("rejects a submission when no active Owner can receive it", async () => {
    const cleanup = vi.fn().mockResolvedValue(undefined);
    const prepared = {
      cleanup,
      displayName: "resume.pdf",
      fileName: "resume.pdf",
      mimeType: "application/pdf",
      byteSize: 64,
      storageKey: "team-cv-1",
      checksumSha256: "a".repeat(64),
    };

    await expect(
      new TeamApplicationService({} as never).submit(
        "candidate-1",
        "company-1",
        "HR_MANAGER",
        prepared as never,
      ),
    ).rejects.toMatchObject({
      code: "TEAM_COMPANY_UNAVAILABLE",
    } satisfies Partial<TeamApplicationCommandError>);

    expect(cleanup).toHaveBeenCalledOnce();
    expect(tx.teamOpportunity.upsert).not.toHaveBeenCalled();
  });

  it("notifies every active Owner after creating a team application", async () => {
    tx.companyMembership.findMany.mockResolvedValue([
      { userId: "owner-1" },
      { userId: "owner-2" },
    ]);
    const repository = {
      findForCandidate: vi.fn().mockResolvedValue({
        id: "application-1",
        companyId: "company-1",
        appliedRole: "HR_MANAGER",
        status: "SUBMITTED",
        submittedAt: new Date("2026-08-27T00:00:00.000Z"),
        ownerFirstViewedAt: null,
        decidedAt: null,
        joinedAt: null,
        company: { displayName: "Northstar Labs", slug: "northstar-labs" },
        invitation: null,
      }),
    };
    const prepared = {
      cleanup: vi.fn().mockResolvedValue(undefined),
      displayName: "resume.pdf",
      fileName: "resume.pdf",
      mimeType: "application/pdf",
      byteSize: 64,
      storageKey: "team-cv-2",
      checksumSha256: "b".repeat(64),
    };

    const result = await new TeamApplicationService(repository as never).submit(
      "candidate-1",
      "company-1",
      "HR_MANAGER",
      prepared as never,
      new Date("2026-08-27T00:00:00.000Z"),
    );

    expect(result.created).toBe(true);
    expect(createNotificationMock).toHaveBeenCalledTimes(2);
    expect(createNotificationMock).toHaveBeenNthCalledWith(
      1,
      tx,
      expect.objectContaining({
        recipientUserId: "owner-1",
        kind: "TEAM_APPLICATION_RECEIVED",
        contextId: "company-1",
        variables: expect.objectContaining({
          companyName: "Northstar Labs",
          state: "HR_MANAGER",
        }),
      }),
    );
    expect(prepared.cleanup).not.toHaveBeenCalled();
  });
});
