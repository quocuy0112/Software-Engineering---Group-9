import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/backend/database/prisma";
import { createInAppNotification } from "@/backend/notifications/notification-service";

const databaseAvailable = Boolean(process.env.DATABASE_URL);
const userId = `notification-failure:${randomUUID()}`;

describe.skipIf(!databaseAvailable)("notification failure isolation", () => {
  beforeAll(async () => {
    const email = `${randomUUID()}@example.test`;
    await prisma.userAccount.create({
      data: {
        id: userId,
        name: "Failure recipient",
        email,
        normalizedEmail: email,
        emailVerified: true,
        state: "ACTIVE",
      },
    });
  });

  afterAll(async () => {
    await prisma.inAppNotification.deleteMany({ where: { recipientUserId: userId } });
    await prisma.userAccount.deleteMany({ where: { id: userId } });
  });

  it("rolls back partial notification work and retries idempotently", async () => {
    const input = {
      recipientUserId: userId,
      kind: "PASSWORD_CHANGED" as const,
      deduplicationKey: `failure-isolation:${userId}`,
      correlationId: randomUUID(),
      occurredAt: new Date("2026-08-14T00:00:00.000Z"),
      contextType: "ACCOUNT" as const,
      contextId: userId,
    };

    await expect(
      prisma.$transaction(async (transaction) => {
        await createInAppNotification(transaction, input);
        throw new Error("INJECTED_TRANSACTION_FAILURE");
      }),
    ).rejects.toThrow("INJECTED_TRANSACTION_FAILURE");
    expect(
      await prisma.inAppNotification.count({
        where: { deduplicationKey: input.deduplicationKey },
      }),
    ).toBe(0);

    await createInAppNotification(prisma, input);
    await createInAppNotification(prisma, input);
    expect(
      await prisma.inAppNotification.count({
        where: { deduplicationKey: input.deduplicationKey },
      }),
    ).toBe(1);
  });
});
