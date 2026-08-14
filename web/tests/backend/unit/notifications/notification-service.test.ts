import { describe, expect, it, vi } from "vitest";
import { NotificationService } from "@/backend/notifications/notification-service";
import { notificationPageSchema } from "@/shared/contracts/notifications";

describe("NotificationService", () => {
  it("returns only public notification fields from persistence rows", async () => {
    const observedAt = new Date("2026-08-14T00:00:00.000Z");
    const persistedAt = new Date("2026-08-13T00:00:00.000Z");
    const internalFields = {
      recipientUserId: "recipient-1",
      deduplicationKey: "private-deduplication-key",
      correlationId: "private-correlation-id",
      updatedAt: persistedAt,
    };
    const repository = {
      list: vi.fn().mockResolvedValue({
        items: [
          {
            id: "notification-1",
            kind: "MESSAGE_RECEIVED",
            category: "MESSAGING",
            severity: "MEDIUM",
            title: "New message",
            summary: "You have unread messages.",
            href: "/messages?conversation=conversation-1",
            contextType: "CONVERSATION",
            contextId: "conversation-1",
            occurrenceCount: 1,
            readAt: null,
            createdAt: persistedAt,
            lastOccurredAt: persistedAt,
            expiresAt: new Date("2026-11-11T00:00:00.000Z"),
            ...internalFields,
          },
        ],
        nextCursor: null,
      }),
      unreadCount: vi.fn().mockResolvedValue(1),
    };
    const service = new NotificationService(repository as never, () => observedAt);

    const result = await service.list("recipient-1", {
      limit: 20,
      state: "all",
    });

    expect(() => notificationPageSchema.parse(result)).not.toThrow();
    expect(result.items[0]).not.toEqual(expect.objectContaining(internalFields));
  });
});
