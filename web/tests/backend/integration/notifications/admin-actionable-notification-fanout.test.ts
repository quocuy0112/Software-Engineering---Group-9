import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/backend/database/prisma";
import { notifyActionableAdministrators } from "@/backend/notifications/admin-notification-fanout";
import { PrismaMessagingReportRepository } from "@/backend/repositories/messaging/prisma-messaging-report-repository";
import { NotificationService } from "@/backend/notifications/notification-service";
import { AdminNotificationService } from "@/backend/admin/notifications/admin-notification-service";
import {
  cleanupMessagingFixture,
  seedMessagingFixture,
} from "../messaging/fixtures";

const prefixes: string[] = [];

async function admin(
  prefix: string,
  suffix: string,
  state: "ACTIVE" | "SUSPENDED" = "ACTIVE",
) {
  const id = `${prefix}-admin-${suffix}`;
  await prisma.userAccount.create({
    data: {
      id,
      name: `Admin ${suffix}`,
      email: `${id}@example.test`,
      normalizedEmail: `${id}@example.test`,
      emailVerified: true,
      state,
      platformAdministratorGrants: { create: {} },
    },
  });
  return id;
}

afterEach(async () => {
  for (const prefix of prefixes.splice(0)) {
    await prisma.platformAdministratorGrant.deleteMany({
      where: { userId: { startsWith: prefix } },
    });
    await prisma.userAccount.deleteMany({
      where: { id: { startsWith: prefix } },
    });
  }
});

describe("actionable administrator notification fan-out", () => {
  it("selects active grants, prefers an active assignee, and safely falls back", async () => {
    const prefix = `admin-fanout-${randomUUID()}`;
    prefixes.push(prefix);
    const activeA = await admin(prefix, "a");
    const activeB = await admin(prefix, "b");
    const suspended = await admin(prefix, "suspended", "SUSPENDED");
    const now = new Date("2026-08-15T00:00:00.000Z");
    const expectedActiveRecipients = (
      await prisma.platformAdministratorGrant.findMany({
        where: {
          state: "ACTIVE",
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          user: { state: "ACTIVE", deletedAt: null },
        },
        select: { userId: true },
      })
    )
      .map(({ userId }) => userId)
      .sort();
    expect(expectedActiveRecipients).toEqual(
      expect.arrayContaining([activeA, activeB]),
    );
    expect(expectedActiveRecipients).not.toContain(suspended);

    await notifyActionableAdministrators(prisma, {
      kind: "SUPPORT_CASE_RECEIVED" as never,
      eventKey: `${prefix}:all`,
      correlationId: `${prefix}:all`,
      occurredAt: now,
      contextType: "SUPPORT_CASE",
      contextId: `${prefix}-case-all`,
    });
    const allAudienceNotifications = await prisma.inAppNotification.findMany({
      where: { contextId: `${prefix}-case-all` },
      select: { id: true, recipientUserId: true },
      orderBy: { recipientUserId: "asc" },
    });
    expect(
      allAudienceNotifications.map(({ recipientUserId }) => ({
        recipientUserId,
      })),
    ).toEqual(
      expectedActiveRecipients.map((recipientUserId) => ({ recipientUserId })),
    );
    expect(
      (
        await new NotificationService().list(activeA, {
          limit: 20,
          state: "all",
        })
      ).items,
    ).toEqual([]);
    await expect(
      new NotificationService().markRead(
        activeA,
        allAudienceNotifications.find(
          ({ recipientUserId }) => recipientUserId === activeA,
        )!.id,
      ),
    ).rejects.toThrow("NOTIFICATION_UNAVAILABLE");
    expect(
      (
        await new AdminNotificationService().list(activeA, {
          page: 1,
          perPage: 20,
          state: "all",
        })
      ).data,
    ).toHaveLength(1);

    await notifyActionableAdministrators(prisma, {
      kind: "SUPPORT_REQUESTER_REPLIED" as never,
      eventKey: `${prefix}:preferred`,
      correlationId: `${prefix}:preferred`,
      occurredAt: now,
      contextType: "SUPPORT_CASE",
      contextId: `${prefix}-case-preferred`,
      preferredRecipientUserId: activeA,
    });
    expect(
      await prisma.inAppNotification.findMany({
        where: { contextId: `${prefix}-case-preferred` },
        select: { recipientUserId: true },
      }),
    ).toEqual([{ recipientUserId: activeA }]);

    await notifyActionableAdministrators(prisma, {
      kind: "SUPPORT_REQUESTER_REPLIED" as never,
      eventKey: `${prefix}:fallback`,
      correlationId: `${prefix}:fallback`,
      occurredAt: now,
      contextType: "SUPPORT_CASE",
      contextId: `${prefix}-case-fallback`,
      preferredRecipientUserId: suspended,
    });
    expect(
      (
        await prisma.inAppNotification.findMany({
          where: { contextId: `${prefix}-case-fallback` },
          select: { recipientUserId: true },
        })
      )
        .map((item) => item.recipientUserId)
        .sort(),
    ).toEqual(expectedActiveRecipients);
  });

  it("notifies active administrators once for a new messaging report", async () => {
    const fixture = await seedMessagingFixture(
      new Date("2026-08-15T00:00:00.000Z"),
    );
    prefixes.push(fixture.prefix);
    const adminId = await admin(fixture.prefix, "report-review");
    const conversationId = `${fixture.prefix}-report-conversation`;
    await prisma.messagingConversation.create({
      data: {
        id: conversationId,
        participantLowId: [fixture.candidateId, fixture.recruiterId].sort()[0]!,
        participantHighId: [
          fixture.candidateId,
          fixture.recruiterId,
        ].sort()[1]!,
        contextType: "PROFESSIONAL_CONNECTION",
        contextReference: fixture.connectionId,
        participants: {
          create: [
            { userId: fixture.candidateId },
            { userId: fixture.recruiterId },
          ],
        },
      },
    });
    const repository = new PrismaMessagingReportRepository();
    const input = {
      reporterUserId: fixture.candidateId,
      conversationId,
      targetUserId: fixture.recruiterId,
      targetType: "CONVERSATION" as const,
      category: "ABUSE_OR_THREATS" as const,
      detail: "Restricted reporter detail must stay out of notifications.",
      now: new Date("2026-08-15T00:01:00.000Z"),
    };
    const first = await repository.submit(input);
    const replay = await repository.submit(input);
    expect(replay).toEqual({ reportId: first.reportId, deduplicated: true });
    const notifications = await prisma.inAppNotification.findMany({
      where: {
        recipientUserId: adminId,
        kind: "MESSAGE_REPORT_RECEIVED_ADMIN" as never,
        contextId: first.reportId,
      },
    });
    expect(notifications).toHaveLength(1);
    expect(JSON.stringify(notifications)).not.toContain(
      "Restricted reporter detail",
    );

    await prisma.platformAdministratorGrant.deleteMany({
      where: { userId: adminId },
    });
    await prisma.userAccount.deleteMany({ where: { id: adminId } });
    await cleanupMessagingFixture(fixture.prefix);
  });
});
