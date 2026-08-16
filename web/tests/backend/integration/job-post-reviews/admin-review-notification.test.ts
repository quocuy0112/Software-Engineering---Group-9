import { describe, expect, it } from "vitest";
import { resolveNotificationHref } from "@/backend/notifications/notification-destination-resolver";

describe("Administrator review notification navigation", () => {
  it("targets the exact protected review version", () => {
    const href = resolveNotificationHref({
      kind: "JOB_POST_REVIEW_REQUESTED_ADMIN",
      contextType: "JOB_POST_REVIEW",
      contextId: "review-1",
      recipientRole: "ADMIN",
      occurrenceCount: 1,
      lastOccurredAt: new Date("2026-08-15T00:00:00.000Z"),
      adminOrigin: "https://console.example.test",
    });
    expect(href).toBe("https://console.example.test/#/job-post-reviews/review-1/show");
  });
});
