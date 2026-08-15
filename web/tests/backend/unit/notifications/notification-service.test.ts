import { describe, expect, it, vi } from "vitest";
import { NotificationService } from "@/backend/notifications/notification-service";
import { notificationPageSchema } from "@/shared/contracts/notifications";

describe("NotificationService", () => {
  it("renders persisted notifications in the recipient's current language", async () => {
    const persistedAt = new Date("2026-08-13T00:00:00.000Z");
    const repository = {
      list: vi.fn().mockResolvedValue({
        items: [
          {
            id: "notification-legacy",
            kind: "VERIFICATION_APPROVED",
            category: "VERIFICATION",
            severity: "HIGH",
            title: "Xác minh đã được duyệt",
            summary: "Công ty cũ đã được xác minh.",
            variables: { companyName: "Old Company" },
            href: "/dashboard/employer-verification",
            contextType: "VERIFICATION_REQUEST",
            contextId: "request-1",
            occurrenceCount: 1,
            readAt: null,
            createdAt: persistedAt,
            lastOccurredAt: persistedAt,
            expiresAt: new Date("2026-11-11T00:00:00.000Z"),
          },
        ],
        nextCursor: null,
      }),
      unreadCount: vi.fn().mockResolvedValue(1),
      language: vi.fn().mockResolvedValue("EN"),
    };

    const result = await new NotificationService(
      repository as never,
      () => persistedAt,
    ).list("recipient-1", { limit: 20, state: "all" });

    expect(result.items[0]).toMatchObject({
      title: "Verification approved",
      summary: "Old Company was verified.",
    });
  });

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
    const service = new NotificationService(
      repository as never,
      () => observedAt,
    );

    const result = await service.list("recipient-1", {
      limit: 20,
      state: "all",
    });

    expect(() => notificationPageSchema.parse(result)).not.toThrow();
    expect(result.items[0]).not.toEqual(
      expect.objectContaining(internalFields),
    );
  });
});
