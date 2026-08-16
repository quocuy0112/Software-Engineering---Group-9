import { describe, expect, it } from "vitest";
import {
  buildNotification,
  renderNotificationCopy,
} from "@/backend/notifications/event-policy";

describe("job-post review notification policy", () => {
  it.each([
    ["JOB_POST_REVIEW_REQUESTED_ADMIN", "MEDIUM"],
    ["JOB_POST_APPROVED", "LOW"],
    ["JOB_POST_REJECTED", "MEDIUM"],
  ] as const)("renders safe localized copy for %s", (kind, severity) => {
    const copy = renderNotificationCopy(kind, {}, "EN");
    expect(copy.title).not.toMatch(/company|engineer|reason/iu);
    expect(copy.summary).not.toMatch(/company|engineer|reason|note/iu);
    const event = buildNotification({
      recipientUserId: "recipient-1",
      kind,
      deduplicationKey: `review:${kind}:1`,
      correlationId: "correlation-1",
      occurredAt: new Date("2026-08-15T00:00:00.000Z"),
      contextType: "JOB_POST_REVIEW",
      contextId: "review-version-1",
      variables: {
        audience: kind.endsWith("_ADMIN") ? "ADMIN" : "USER",
        state: "PENDING_REVIEW",
      },
      language: "EN",
    });
    expect(event.category).toBe("MODERATION");
    expect(event.severity).toBe(severity);
    expect(JSON.stringify(event)).not.toMatch(
      /secret|challenge|privateNote|publicExplanation/iu,
    );
  });

  it("rejects job content and challenge secrets as notification variables", () => {
    expect(() =>
      buildNotification({
        recipientUserId: "admin-1",
        kind: "JOB_POST_REVIEW_REQUESTED_ADMIN",
        deduplicationKey: "review:1",
        correlationId: "correlation-1",
        occurredAt: new Date(),
        contextType: "JOB_POST_REVIEW",
        contextId: "review-1",
        variables: {
          audience: "ADMIN",
          title: "Private job",
          challengeSecret: "secret",
        } as never,
      }),
    ).toThrow();
  });
});
