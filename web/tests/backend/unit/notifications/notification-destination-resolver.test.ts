import { describe, expect, it } from "vitest";
import { resolveNotificationHref } from "@/backend/notifications/notification-destination-resolver";

describe("notification destination resolver", () => {
  const base = { contextType: "APPLICATION" as const, contextId: "app 1", occurrenceCount: 1, lastOccurredAt: new Date("2026-08-16T00:00:00.000Z") };
  it("is audience-aware for the same application context", () => {
    expect(resolveNotificationHref({ ...base, kind: "APPLICATION_STAGE_CHANGED", recipientRole: "CANDIDATE" })).toBe("/jobs/applied/app%201");
    expect(resolveNotificationHref({ ...base, kind: "APPLICATION_RECEIVED", recipientRole: "RECRUITER", jobId: "job 1" })).toBe("/recruiter/candidates/job%201?application=app%201");
  });
  it("uses intended null when the context cannot safely navigate", () => {
    expect(resolveNotificationHref({ ...base, kind: "APPLICATION_RECEIVED", contextType: null, contextId: null, recipientRole: "RECRUITER" })).toBeNull();
  });
  it("opens exact conversations and administrator reports only for their audience", () => {
    expect(resolveNotificationHref({ ...base, kind: "MESSAGE_RECEIVED", contextType: "CONVERSATION", contextId: "c1", recipientRole: "CANDIDATE" })).toBe("/messages?conversation=c1");
    expect(resolveNotificationHref({ ...base, kind: "MODERATION_REPORT_RECEIVED_ADMIN", contextType: "MODERATION_REPORT", contextId: "r1", recipientRole: "ADMIN", adminOrigin: "https://admin.example.test" })).toBe("https://admin.example.test/#/moderation-reports/r1/show");
  });
  it("uses a filtered list destination for grouped notifications", () => {
    expect(resolveNotificationHref({ ...base, kind: "APPLICATION_RECEIVED", recipientRole: "RECRUITER", jobId: "job 1", occurrenceCount: 2 })).toBe("/recruiter/candidates/job%201?status=new&since=2026-08-16T00%3A00%3A00.000Z");
  });
});
