import { describe, expect, it } from "vitest";
import { adminNotificationTarget } from "@/frontend/features/admin/notifications/admin-notification-navigation";
import { notificationItemSchema } from "@/shared/contracts/notifications";

describe("Administrator review notification navigation", () => {
  it("targets the exact protected review version", () => {
    const item = notificationItemSchema.parse({
      id: "n1",
      kind: "JOB_POST_REVIEW_REQUESTED_ADMIN",
      category: "MODERATION",
      severity: "MEDIUM",
      title: "Review awaiting",
      summary: "A review awaits.",
      href: "/admin/job-post-reviews/review-1",
      contextType: "JOB_POST_REVIEW",
      contextId: "review-1",
      occurrenceCount: 1,
      readAt: null,
      createdAt: "2026-08-15T00:00:00.000Z",
      lastOccurredAt: "2026-08-15T00:00:00.000Z",
      expiresAt: "2026-11-01T00:00:00.000Z",
    });
    expect(adminNotificationTarget(item)).toEqual({
      resource: "job-post-reviews",
      id: "review-1",
    });
  });
});
