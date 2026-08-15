import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/backend/database/prisma";
import { runSecurityNotificationCycle } from "@/backend/admin/workers/security-notification-loop";
import { PrismaOutboxRepository } from "@/backend/repositories/email/outbox-repository";
import { deliverClaimedOutbox } from "@/backend/email/workers/email-outbox";
import { EmailDeliveryError } from "@/backend/email/email-service";
import { alertSecurityNotificationDead } from "@/backend/admin/notifications/security-notification-ops-alert";
import { cleanupAdministratorNotificationsForContexts } from "../../../helpers/notifications/admin-notification-cleanup";

const prefix = "feature006-provider-truth:";
const userIds: string[] = [];

async function user() {
  const id = `${prefix}${crypto.randomUUID()}`;
  const email = `${crypto.randomUUID()}@example.test`;
  userIds.push(id);
  await prisma.userAccount.create({
    data: {
      id,
      name: "Notification recipient",
      email,
      normalizedEmail: email,
      emailVerified: true,
      state: "ACTIVE",
    },
  });
  return id;
}

async function linked(now: Date) {
  const userId = await user();
  const businessEventKey = `account:${userId}:ACCOUNT_SUSPENDED:version:2`;
  const outbox = await prisma.emailOutbox.create({
    data: {
      kind: "PASSWORD_CHANGED",
      userId,
      recipientRef: userId,
      templateVersion: "password-changed.v1",
      payloadRef: {},
      idempotencyKey: `email-delivery:${businessEventKey}`,
      nextAttemptAt: now,
      createdAt: now,
    },
  });
  const work = await prisma.securityNotificationWork.create({
    data: {
      idempotencyKey: `security-notification:${businessEventKey}`,
      originatingCorrelationId: crypto.randomUUID(),
      targetUserId: userId,
      kind: "ACCOUNT_SUSPENDED",
      payloadRef: { resultingState: "SUSPENDED" },
      emailOutboxId: outbox.id,
      nextAttemptAt: null,
      deliveryDeadline: new Date(now.getTime() + 24 * 60 * 60_000),
    },
  });
  return { outbox, work };
}

afterEach(async () => {
  await cleanupAdministratorNotificationsForContexts(userIds);
  await prisma.platformAdministratorGrant.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.securityNotificationWork.deleteMany({
    where: { idempotencyKey: { contains: prefix } },
  });
  await prisma.emailOutbox.deleteMany({
    where: { idempotencyKey: { contains: prefix } },
  });
  await prisma.userAccount.deleteMany({ where: { id: { in: userIds } } });
  userIds.length = 0;
});

describe("security notification provider-truth status", () => {
  it("only enqueues and links an outbox; enqueue is not delivery", async () => {
    const now = new Date("2026-08-10T00:00:00.000Z");
    const userId = await user();
    const businessEventKey = `account:${userId}:ACCOUNT_SUSPENDED:version:2`;
    const work = await prisma.securityNotificationWork.create({
      data: {
        idempotencyKey: `security-notification:${businessEventKey}`,
        originatingCorrelationId: crypto.randomUUID(),
        targetUserId: userId,
        kind: "ACCOUNT_SUSPENDED",
        payloadRef: {
          resultingState: "SUSPENDED",
          occurredAt: now.toISOString(),
        },
        nextAttemptAt: now,
        deliveryDeadline: new Date(now.getTime() + 24 * 60 * 60_000),
      },
    });

    const cycle = await runSecurityNotificationCycle(now);
    expect(cycle.enqueued).toBeGreaterThanOrEqual(1);
    expect(cycle.reconciled).toBeGreaterThanOrEqual(1);
    expect(cycle.alerted).toBeGreaterThanOrEqual(0);
    const state = await prisma.securityNotificationWork.findUniqueOrThrow({
      where: { id: work.id },
      include: { emailOutbox: true },
    });
    expect(state.status).toBe("PENDING");
    expect(state.attemptCount).toBe(0);
    expect(state.emailOutbox).toMatchObject({
      status: "PENDING",
      idempotencyKey: `email-delivery:${businessEventKey}`,
      payloadRef: expect.objectContaining({ eventKind: "ACCOUNT_SUSPENDED" }),
    });
  });

  it("mirrors exact provider retry attempts and reaches manual intervention", async () => {
    let now = new Date("2026-08-10T00:00:00.000Z");
    const { outbox, work } = await linked(now);
    const repository = new PrismaOutboxRepository();
    const send = vi
      .fn()
      .mockRejectedValue(
        new EmailDeliveryError("SMTP_CONNECTION_TIMEOUT", true),
      );
    const delays = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];

    for (let index = 0; index < 5; index += 1) {
      const owner = `provider-truth-${index}`;
      const claimed = await repository.claimOne(outbox.id, owner, now);
      expect(claimed).not.toBeNull();
      await deliverClaimedOutbox(claimed!, owner, { send }, repository, now);
      const [outboxState, workState] = await Promise.all([
        prisma.emailOutbox.findUniqueOrThrow({ where: { id: outbox.id } }),
        prisma.securityNotificationWork.findUniqueOrThrow({
          where: { id: work.id },
        }),
      ]);
      if (index < 4) {
        expect(outboxState.status).toBe("RETRYABLE");
        expect(workState.status).toBe("RETRYING");
        expect(outboxState.nextAttemptAt.getTime()).toBe(
          now.getTime() + delays[index]!,
        );
        now = outboxState.nextAttemptAt;
      } else {
        expect(outboxState.status).toBe("DEAD");
        expect(workState.status).toBe("MANUAL_INTERVENTION_REQUIRED");
        expect(workState.attemptCount).toBe(5);
      }
    }
    expect(send).toHaveBeenCalledTimes(5);
  });

  it("sets DELIVERED only after the provider returns success", async () => {
    const now = new Date("2026-08-10T00:00:00.000Z");
    const { outbox, work } = await linked(now);
    const repository = new PrismaOutboxRepository();
    const owner = "provider-success";
    const claimed = await repository.claimOne(outbox.id, owner, now);
    await deliverClaimedOutbox(
      claimed!,
      owner,
      { send: vi.fn().mockResolvedValue({ providerMessageId: "provider-1" }) },
      repository,
      now,
    );
    expect(
      await prisma.emailOutbox.findUniqueOrThrow({
        where: { id: outbox.id },
        select: { status: true },
      }),
    ).toEqual({ status: "SENT" });
    expect(
      await prisma.securityNotificationWork.findUniqueOrThrow({
        where: { id: work.id },
        select: { status: true },
      }),
    ).toEqual({ status: "DELIVERED" });
  });

  it("moves a permanent provider failure directly to DEAD", async () => {
    const now = new Date("2026-08-10T00:00:00.000Z");
    const { outbox, work } = await linked(now);
    const adminId = await user();
    await prisma.platformAdministratorGrant.create({
      data: { userId: adminId },
    });
    const repository = new PrismaOutboxRepository();
    const owner = "provider-permanent";
    const claimed = await repository.claimOne(outbox.id, owner, now);
    const sendAlert = vi.fn().mockResolvedValue(undefined);
    await deliverClaimedOutbox(
      claimed!,
      owner,
      {
        send: vi
          .fn()
          .mockRejectedValue(new EmailDeliveryError("SMTP_AUTH_FAILED", false)),
      },
      repository,
      now,
      () => 0.5,
      { send: sendAlert },
    );
    expect(
      await prisma.emailOutbox.findUniqueOrThrow({
        where: { id: outbox.id },
        select: { status: true },
      }),
    ).toEqual({ status: "DEAD" });
    expect(
      await prisma.securityNotificationWork.findUniqueOrThrow({
        where: { id: work.id },
        select: { status: true },
      }),
    ).toEqual({ status: "MANUAL_INTERVENTION_REQUIRED" });
    expect(sendAlert).toHaveBeenCalledOnce();
    const inAppAlerts = await prisma.inAppNotification.findMany({
      where: {
        recipientUserId: adminId,
        kind: "DELIVERY_MANUAL_INTERVENTION_REQUIRED" as never,
        contextType: "ACCOUNT",
        contextId: work.targetUserId,
      },
    });
    expect(inAppAlerts).toHaveLength(1);
    expect(JSON.stringify(inAppAlerts)).not.toContain(
      `${work.targetUserId}@example.test`,
    );
    expect(sendAlert.mock.calls[0]?.[0]).toEqual({
      alertKey: `account-security-dead:${work.id}`,
      workReference: work.id,
      eventKind: "ACCOUNT_SUSPENDED",
      deliveryDeadline: new Date(
        now.getTime() + 24 * 60 * 60_000,
      ).toISOString(),
      safeFailureCategory: "ATTEMPTS_EXHAUSTED",
    });
    expect(
      await alertSecurityNotificationDead(outbox.id, { send: sendAlert }),
    ).toBe(false);
    expect(sendAlert).toHaveBeenCalledOnce();
  });
});
