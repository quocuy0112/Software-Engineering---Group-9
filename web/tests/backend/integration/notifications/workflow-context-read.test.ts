import { describe, expect, it, vi } from "vitest";
import { NotificationService } from "@/backend/notifications/notification-service";
import type { NotificationContextType } from "@/shared/contracts/notifications";

describe("workflow context reads", () => {
  it("scopes each supported workflow context to the authenticated recipient", async () => {
    const observedAt = new Date("2026-08-14T00:00:00.000Z");
    const markContextRead = vi.fn().mockResolvedValue({ count: 1 });
    const unreadCount = vi.fn().mockResolvedValue(2);
    const service = new NotificationService(
      { markContextRead, unreadCount } as never,
      () => observedAt,
    );
    const contexts: NotificationContextType[] = [
      "APPLICATION",
      "VERIFICATION_REQUEST",
      "SUPPORT_CASE",
      "CONNECTION_PROPOSAL",
      "CONNECTION",
      "MESSAGING_REPORT",
      "MODERATION_REPORT",
    ];

    for (const contextType of contexts) {
      await expect(
        service.markContextRead("recipient-1", contextType, "context-1"),
      ).resolves.toEqual({
        changedCount: 1,
        unreadCount: 2,
        observedAt: observedAt.toISOString(),
      });
    }
    expect(markContextRead).toHaveBeenCalledTimes(contexts.length);
    for (const contextType of contexts) {
      expect(markContextRead).toHaveBeenCalledWith(
        "recipient-1",
        contextType,
        "context-1",
        observedAt,
      );
    }
  });
});
