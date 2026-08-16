import { describe, expect, it } from "vitest";
import { resolveNotificationHref } from "@/backend/notifications/notification-destination-resolver";

describe("notification destination resolver", () => {
  const base = { contextType: "APPLICATION" as const, contextId: "app 1", occurrenceCount: 1, lastOccurredAt: new Date() };
  it("is audience-aware for the same application context", () => {
    expect(resolveNotificationHref({ ...base, kind: "APPLICATION_STAGE_CHANGED", recipientAudience: "USER" })).toBe("/jobs/applied/app%201");
    expect(resolveNotificationHref({ ...base, kind: "APPLICATION_STAGE_CHANGED", recipientAudience: "ADMIN" })).toBeNull();
  });
  it("uses intended null when the context cannot safely navigate", () => {
    expect(resolveNotificationHref({ ...base, kind: "APPLICATION_RECEIVED", contextType: null, contextId: null, recipientAudience: "USER" })).toBeNull();
  });
  it("opens exact conversations and administrator reports only for their audience", () => {
    expect(resolveNotificationHref({ ...base, kind: "MESSAGE_RECEIVED", contextType: "CONVERSATION", contextId: "c1", recipientAudience: "USER" })).toBe("/messages?conversation=c1");
    expect(resolveNotificationHref({ ...base, kind: "MODERATION_REPORT_RECEIVED_ADMIN", contextType: "MODERATION_REPORT", contextId: "r1", recipientAudience: "USER" })).toBeNull();
  });
});
