import { describe, expect, it } from "vitest";
import { resolveNotificationHref } from "@/backend/notifications/notification-destination-resolver";
import { notificationKinds } from "@/shared/contracts/notifications";

describe("notification destination resolver", () => {
  const base = {
    notificationId: "notification-1",
    contextType: "APPLICATION" as const,
    contextId: "app 1",
    occurrenceCount: 1,
    lastOccurredAt: new Date("2026-08-16T00:00:00.000Z"),
  };
  it("is audience-aware for the same application context", () => {
    expect(
      resolveNotificationHref({
        ...base,
        kind: "APPLICATION_STAGE_CHANGED",
        recipientRole: "CANDIDATE",
      }),
    ).toBe("/jobs/applied/app%201");
    expect(
      resolveNotificationHref({
        ...base,
        kind: "APPLICATION_RECEIVED",
        recipientRole: "RECRUITER",
        jobId: "job 1",
      }),
    ).toBe("/recruiter/candidates/job%201?application=app%201");
  });
  it("uses the notification inbox as the safe fallback when exact context is unavailable", () => {
    expect(
      resolveNotificationHref({
        ...base,
        kind: "APPLICATION_RECEIVED",
        contextType: null,
        contextId: null,
        recipientRole: "RECRUITER",
      }),
    ).toBe("/notifications?notification=notification-1");
  });
  it("returns a safe href for every notification kind, including legacy contextless rows", () => {
    for (const kind of notificationKinds) {
      expect(
        resolveNotificationHref({
          ...base,
          kind,
          contextType: null,
          contextId: null,
          recipientRole: "CANDIDATE",
        }),
      ).toBe("/notifications?notification=notification-1");
    }
  });
  it("keeps an administrator fallback inside the administrator console", () => {
    expect(
      resolveNotificationHref({
        ...base,
        kind: "DELIVERY_MANUAL_INTERVENTION_REQUIRED",
        contextType: null,
        contextId: null,
        recipientRole: "ADMIN",
        adminOrigin: "https://admin.example.test",
      }),
    ).toBe(
      "https://admin.example.test/#/notifications?notification=notification-1",
    );
  });
  it("opens exact conversations and administrator reports only for their audience", () => {
    expect(
      resolveNotificationHref({
        ...base,
        kind: "MESSAGE_RECEIVED",
        contextType: "CONVERSATION",
        contextId: "c1",
        recipientRole: "CANDIDATE",
      }),
    ).toBe("/messages?conversation=c1");
    expect(
      resolveNotificationHref({
        ...base,
        kind: "MODERATION_REPORT_RECEIVED_ADMIN",
        contextType: "MODERATION_REPORT",
        contextId: "r1",
        recipientRole: "ADMIN",
        adminOrigin: "https://admin.example.test",
      }),
    ).toBe("https://admin.example.test/#/moderation-reports/r1/show");
  });
  it("uses a filtered list destination for grouped notifications", () => {
    expect(
      resolveNotificationHref({
        ...base,
        kind: "APPLICATION_RECEIVED",
        recipientRole: "RECRUITER",
        jobId: "job 1",
        occurrenceCount: 2,
      }),
    ).toBe(
      "/recruiter/candidates/job%201?status=new&since=2026-08-16T00%3A00%3A00.000Z",
    );
  });
  it("covers the remaining durable contexts with a safe, role-aware destination", () => {
    expect(
      resolveNotificationHref({
        ...base,
        kind: "SUPPORT_RESOLVED",
        contextType: "SUPPORT_CASE",
        contextId: "case 1",
        recipientRole: "CANDIDATE",
      }),
    ).toBe("/support?case=case%201");
    expect(
      resolveNotificationHref({
        ...base,
        kind: "CONNECTION_ACCEPTED",
        contextType: "CONNECTION",
        contextId: "connection 1",
        recipientRole: "CANDIDATE",
      }),
    ).toBe("/connections?connection=connection%201");
    expect(
      resolveNotificationHref({
        ...base,
        kind: "SUPPORT_CASE_RECEIVED",
        contextType: "SUPPORT_CASE",
        contextId: "case 1",
        recipientRole: "ADMIN",
        adminOrigin: "https://admin.example.test",
      }),
    ).toBe("https://admin.example.test/#/support-cases/case%201/show");
    expect(
      resolveNotificationHref({
        ...base,
        kind: "COMPANY_INVITATION_RECEIVED",
        contextType: "COMPANY_INVITATION",
        contextId: "invite 1",
        recipientRole: "CANDIDATE",
      }),
    ).toBe("/recruiter/company-invitation");
    expect(
      resolveNotificationHref({
        ...base,
        kind: "MESSAGE_REPORT_RECEIVED_ADMIN",
        contextType: "MESSAGING_REPORT",
        contextId: "report 1",
        recipientRole: "ADMIN",
        adminOrigin: "https://admin.example.test",
      }),
    ).toBe("https://admin.example.test/#/messaging-reports/report%201/show");
  });
});
