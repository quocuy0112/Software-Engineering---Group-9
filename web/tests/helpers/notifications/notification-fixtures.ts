import type { NotificationItem } from "@/shared/contracts/notifications";

export function notificationFixture(
  overrides: Partial<NotificationItem> = {},
): NotificationItem {
  return {
    id: "notification-1",
    kind: "PASSWORD_CHANGED",
    category: "SECURITY",
    severity: "HIGH",
    title: "Password changed",
    summary: "Your SmartHire password was changed.",
    href: "/profile/security",
    contextType: "ACCOUNT",
    contextId: "user-1",
    occurrenceCount: 1,
    readAt: null,
    createdAt: "2026-08-14T00:00:00.000Z",
    lastOccurredAt: "2026-08-14T00:00:00.000Z",
    expiresAt: "2026-11-12T00:00:00.000Z",
    ...overrides,
  };
}
