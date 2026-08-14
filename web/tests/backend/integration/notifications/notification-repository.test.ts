import { describe, expect, it, vi } from "vitest";
import { PrismaNotificationRepository } from "@/backend/repositories/notifications/prisma-notification-repository";

const base = {
  recipientUserId: "recipient-1",
  kind: "MESSAGE_RECEIVED" as const,
  category: "MESSAGING" as const,
  severity: "MEDIUM" as const,
  title: "New message",
  summary: "You have unread messages.",
  href: "/messages?conversation=conversation-1",
  contextType: "CONVERSATION" as const,
  contextId: "conversation-1",
  deduplicationKey: "message:conversation-1:recipient-1:after:0",
  correlationId: "message-1",
  occurredAt: new Date("2026-08-14T00:00:00.000Z"),
  groupable: true,
};

describe("PrismaNotificationRepository", () => {
  it("groups an unread message burst", async () => {
    const update = vi.fn().mockResolvedValue({ id: "notification-1" });
    const repository = new PrismaNotificationRepository({
      inAppNotification: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: "notification-1", readAt: null }),
        update,
      },
    } as never);
    await repository.create(base);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "notification-1" },
        data: expect.objectContaining({ occurrenceCount: { increment: 1 } }),
      }),
    );
  });

  it("reopens a manually-read burst when a later message arrives", async () => {
    const update = vi.fn().mockResolvedValue({ id: "notification-1" });
    const repository = new PrismaNotificationRepository({
      inAppNotification: {
        findUnique: vi.fn().mockResolvedValue({
          id: "notification-1",
          readAt: new Date("2026-08-14T00:01:00.000Z"),
        }),
        update,
      },
    } as never);
    await repository.create({
      ...base,
      correlationId: "message-2",
      occurredAt: new Date("2026-08-14T00:02:00.000Z"),
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          readAt: null,
          occurrenceCount: 1,
          correlationId: "message-2",
        }),
      }),
    );
  });

  it("scopes read mutations to the recipient and active retention window", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const repository = new PrismaNotificationRepository({
      inAppNotification: { updateMany },
    } as never);
    const now = new Date("2026-08-14T00:00:00.000Z");
    await repository.markRead("recipient-1", "notification-1", now);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "notification-1",
        recipientUserId: "recipient-1",
        readAt: null,
        expiresAt: { gt: now },
      },
      data: { readAt: now },
    });
  });
});
