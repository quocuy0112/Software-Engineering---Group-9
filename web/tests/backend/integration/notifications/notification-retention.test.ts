import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/backend/database/prisma";
import { runNotificationRetentionCycle } from "@/backend/admin/workers/notification-retention-loop";

const databaseAvailable = Boolean(process.env.DATABASE_URL);
const userId = `notification-retention:${randomUUID()}`;
const auditId = "notification-retention-audit-fixture";

describe.skipIf(!databaseAvailable)("notification retention", () => {
  afterAll(async () => {
    await prisma.inAppNotification.deleteMany({ where: { recipientUserId: userId } });
    await prisma.userAccount.deleteMany({ where: { id: userId } });
  });

  it("removes expired inbox rows without removing originating audits", async () => {
    const now = new Date("2026-08-14T00:00:00.000Z");
    const email = `${randomUUID()}@example.test`;
    await prisma.userAccount.create({
      data: {
        id: userId,
        name: "Retention recipient",
        email,
        normalizedEmail: email,
        emailVerified: true,
        state: "ACTIVE",
      },
    });
    if (!(await prisma.auditEvent.findFirst({ where: { targetId: auditId } }))) {
      await prisma.auditEvent.create({
        data: {
          actorType: "system",
          action: "notification.retention.fixture",
          targetType: "notification",
          targetId: auditId,
          result: "SUCCESS",
          correlationId: randomUUID(),
          context: {},
        },
      });
    }
    const auditCount = await prisma.auditEvent.count({ where: { targetId: auditId } });
    await prisma.inAppNotification.createMany({
      data: [
        {
          recipientUserId: userId,
          kind: "PASSWORD_CHANGED",
          category: "SECURITY",
          severity: "HIGH",
          title: "Expired",
          summary: "Expired notification.",
          deduplicationKey: `expired:${userId}`,
          correlationId: randomUUID(),
          expiresAt: new Date(now.getTime() - 1),
          createdAt: new Date(now.getTime() - 90 * 86_400_000),
          lastOccurredAt: new Date(now.getTime() - 90 * 86_400_000),
        },
        {
          recipientUserId: userId,
          kind: "PASSWORD_CHANGED",
          category: "SECURITY",
          severity: "HIGH",
          title: "Active",
          summary: "Active notification.",
          deduplicationKey: `active:${userId}`,
          correlationId: randomUUID(),
          expiresAt: new Date(now.getTime() + 86_400_000),
          createdAt: now,
          lastOccurredAt: now,
        },
      ],
    });

    expect(await runNotificationRetentionCycle(now)).toEqual({ deleted: 1 });
    expect(
      await prisma.inAppNotification.count({ where: { recipientUserId: userId } }),
    ).toBe(1);
    expect(await prisma.auditEvent.count({ where: { targetId: auditId } })).toBe(
      auditCount,
    );
  });
});
