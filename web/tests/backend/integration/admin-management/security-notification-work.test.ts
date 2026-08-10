import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/backend/database/prisma";
import { SecurityNotificationDispatcher } from "@/backend/admin/notifications/security-notification-dispatcher";

describe("security notification retry work", () => {
  afterEach(() =>
    prisma.securityNotificationWork.deleteMany({
      where: { idempotencyKey: { startsWith: "test-notification:" } },
    }),
  );

  async function create(now: Date) {
    return prisma.securityNotificationWork.create({
      data: {
        idempotencyKey: `test-notification:${crypto.randomUUID()}`,
        originatingCorrelationId: crypto.randomUUID(),
        targetUserId: "test-user",
        kind: "admin.account_suspended",
        payloadRef: { resultingState: "SUSPENDED" },
        nextAttemptAt: now,
        deliveryDeadline: new Date(now.getTime() + 24 * 60 * 60_000),
      },
    });
  }

  it("uses the exact 1m, 5m, 30m, and 2h retry intervals then requires intervention", async () => {
    let now = new Date("2026-08-10T00:00:00.000Z");
    const row = await create(now);
    const dispatcher = new SecurityNotificationDispatcher({
      send: async () => {
        throw new Error("temporary");
      },
    });
    for (const delay of [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000]) {
      await dispatcher.dispatchDue(now);
      const state = await prisma.securityNotificationWork.findUniqueOrThrow({
        where: { id: row.id },
      });
      expect(state.status).toBe("RETRYING");
      expect(state.nextAttemptAt?.getTime()).toBe(now.getTime() + delay);
      now = state.nextAttemptAt!;
    }
    await dispatcher.dispatchDue(now);
    const terminal = await prisma.securityNotificationWork.findUniqueOrThrow({
      where: { id: row.id },
    });
    expect(terminal.status).toBe("MANUAL_INTERVENTION_REQUIRED");
    expect(terminal.attemptCount).toBe(5);
    expect(terminal.failureCategory).toBe("ATTEMPTS_EXHAUSTED");
  });

  it("classifies permanent failure once without undoing the originating work", async () => {
    const now = new Date();
    const row = await create(now);
    await new SecurityNotificationDispatcher({
      send: async () => {
        throw new Error("DESTINATION_REJECTED");
      },
    }).dispatchDue(now);
    const state = await prisma.securityNotificationWork.findUniqueOrThrow({
      where: { id: row.id },
    });
    expect(state.status).toBe("MANUAL_INTERVENTION_REQUIRED");
    expect(state.attemptCount).toBe(1);
    expect(state.failureCategory).toBe("DESTINATION_REJECTED");
  });
});
