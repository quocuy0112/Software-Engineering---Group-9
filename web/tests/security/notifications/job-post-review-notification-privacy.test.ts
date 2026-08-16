import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildNotification } from "@/backend/notifications/event-policy";

describe("job-post review notification privacy", () => {
  const base = {
    recipientUserId: "recipient-1",
    correlationId: "corr-1",
    occurredAt: new Date("2026-08-15T00:00:00.000Z"),
    contextType: "JOB_POST_REVIEW" as const,
    contextId: "review-version-1",
    variables: { audience: "ADMIN" as const, state: "ACTION_REQUIRED" as const },
  };

  it("keeps the administrator request generic and points only to the protected review", () => {
    const notification = buildNotification({
      ...base,
      kind: "JOB_POST_REVIEW_REQUESTED_ADMIN",
      deduplicationKey: "job-review-request:review-version-1",
    }, "EN");
    expect(notification.title).toBe("Job post awaiting review");
    expect(notification.summary).not.toMatch(/title|company|submitter|reason|evidence|note/iu);
    expect(notification.href).toBeNull();
  });

  it.each(["JOB_POST_APPROVED", "JOB_POST_REJECTED"] as const)(
    "keeps %s outcome payload free of snapshot and private-note fields",
    (kind) => {
      const notification = buildNotification({
        ...base,
        kind,
        deduplicationKey: `job-review-outcome:${kind}`,
        variables: { audience: "USER", state: "ACTION_REQUIRED" },
      }, "EN");
      const serialized = JSON.stringify(notification);
      expect(serialized).not.toMatch(/snapshot|privateNote|publicExplanation|evidence|phone|email/iu);
      expect(notification.href).toBeNull();
    },
  );

  it("emits only bounded operational fields in notification logs", () => {
    const operations = readFileSync("src/backend/notifications/notification-operations.ts", "utf8");
    expect(operations).toContain("bounded(event.correlationId, 128)");
    expect(operations).not.toMatch(/snapshot|privateNote|publicExplanation|companyName/iu);
  });
});
