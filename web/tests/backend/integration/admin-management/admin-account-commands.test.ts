import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/backend/database/prisma";
import { AdminAccountService } from "@/backend/admin/accounts/admin-account-service";

const suffix = crypto.randomUUID();
const targetId = `account-command-${suffix}`;
const authority = {
  userId: `admin-${suffix}`,
  sessionId: `admin-session-${suffix}`,
  grantId: `grant-${suffix}`,
  proofAt: new Date(),
};
const command = (version: number) => ({
  expectedVersion: version,
  idempotencyKey: crypto.randomUUID(),
  reasonCategory: "SECURITY_COMPROMISE",
  explanation: "Confirmed account security investigation.",
});

describe("authoritative account commands", () => {
  beforeEach(async () => {
    await prisma.userAccount.create({
      data: {
        id: targetId,
        name: "Target",
        email: `${targetId}@example.test`,
        normalizedEmail: `${targetId}@example.test`,
        emailVerified: true,
        state: "ACTIVE",
        candidateIdentity: { create: {} },
        sessions: {
          create: [
            {
              id: `s1-${suffix}`,
              token: `t1-${suffix}`,
              expiresAt: new Date(Date.now() + 86_400_000),
              absoluteExpiresAt: new Date(Date.now() + 86_400_000),
            },
            {
              id: `s2-${suffix}`,
              token: `t2-${suffix}`,
              expiresAt: new Date(Date.now() + 86_400_000),
              absoluteExpiresAt: new Date(Date.now() + 86_400_000),
            },
          ],
        },
      },
    });
  });
  afterEach(async () => {
    const correlations = (
      await prisma.auditEvent.findMany({
        where: { targetId },
        select: { correlationId: true },
      })
    ).map((row) => row.correlationId);
    await prisma.securityNotificationWork.deleteMany({
      where: { targetUserId: targetId },
    });
    await prisma.privilegedActionRationale.deleteMany({
      where: { correlationId: { in: correlations } },
    });
    await prisma.adminCommandReceipt.deleteMany({
      where: { targetReference: { startsWith: targetId } },
    });
    await prisma.candidateIdentity.delete({ where: { userId: targetId } });
    await prisma.userAccount.delete({ where: { id: targetId } });
  });
  it("suspends atomically, revokes every session, and preserves Candidate identity", async () => {
    await new AdminAccountService().suspend(authority, targetId, command(1));
    const account = await prisma.userAccount.findUniqueOrThrow({
      where: { id: targetId },
      include: { sessions: true, candidateIdentity: true },
    });
    expect(account.state).toBe("SUSPENDED");
    expect(account.sessions.every((session) => session.revokedAt)).toBe(true);
    expect(account.candidateIdentity).not.toBeNull();
    expect(
      await prisma.securityNotificationWork.count({
        where: { targetUserId: targetId },
      }),
    ).toBe(1);
  });
  it("allows one winner and returns a stale conflict to a parallel command", async () => {
    const first = command(1);
    const second = command(1);
    const results = await Promise.allSettled([
      new AdminAccountService().revokeAll(authority, targetId, first),
      new AdminAccountService().revokeAll(authority, targetId, second),
    ]);
    expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(
      1,
    );
    expect(results.filter((item) => item.status === "rejected")).toHaveLength(
      1,
    );
  });
  it("blocks self-targeting before changing state", async () => {
    await expect(
      new AdminAccountService().suspend(
        { ...authority, userId: targetId },
        targetId,
        command(1),
      ),
    ).rejects.toThrow("PROTECTED_ADMIN_ACTION");
    expect(
      (await prisma.userAccount.findUniqueOrThrow({ where: { id: targetId } }))
        .state,
    ).toBe("ACTIVE");
  });
});
