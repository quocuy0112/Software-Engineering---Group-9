import { describe, expect, it } from "vitest";
import {
  buildNotification,
  proofEmailKinds,
} from "@/backend/notifications/event-policy";
import { notificationKinds } from "@/shared/contracts/notifications";

const base = {
  recipientUserId: "user-1",
  deduplicationKey: "event-1:user-1",
  correlationId: "correlation-1",
  occurredAt: new Date("2026-08-14T00:00:00.000Z"),
} as const;

describe("in-app notification event policy", () => {
  it("covers every shared kind with bounded safe output", () => {
    for (const kind of notificationKinds) {
      const result = buildNotification({ ...base, kind });
      expect(result.kind).toBe(kind);
      expect(result.title.length).toBeGreaterThan(0);
      expect(result.title.length).toBeLessThanOrEqual(120);
      expect(result.summary.length).toBeGreaterThan(0);
      expect(result.summary.length).toBeLessThanOrEqual(500);
    }
  });

  it("assigns critical severity to access-loss events", () => {
    for (const kind of [
      "RECOVERY_PENDING",
      "RECOVERY_COMPLETED",
      "ACCOUNT_SUSPENDED",
      "ALL_SESSIONS_REVOKED",
    ] as const) {
      expect(buildNotification({ ...base, kind }).severity).toBe("CRITICAL");
    }
  });

  it("uses Vietnamese with English fallback and defers destinations", () => {
    const vi = buildNotification(
      {
        ...base,
        kind: "MESSAGE_RECEIVED",
        contextType: "CONVERSATION",
        contextId: "conversation 1",
        variables: { count: 2 },
      },
      "VI",
    );
    const en = buildNotification(
      {
        ...base,
        kind: "MESSAGE_RECEIVED",
        contextType: "CONVERSATION",
        contextId: "conversation 1",
        variables: { count: 2 },
      },
      "EN",
    );
    expect(vi.summary).toContain("tin nhắn chưa đọc");
    expect(en.summary).toContain("unread messages");
    expect(en.href).toBeNull();
    expect(en.groupable).toBe(true);
  });

  it("uses English operational copy for administrator verification alerts", () => {
    const notification = buildNotification(
      {
        ...base,
        kind: "VERIFICATION_RECEIVED",
        variables: { audience: "ADMIN" },
      },
      "EN",
    );
    expect(notification.title).toBe("Verification received");
    expect(notification.summary).toBe(
      "A new business verification request was submitted and is awaiting review.",
    );
  });

  it("localizes team-application alerts for the company Owner", () => {
    const input = {
      ...base,
      kind: "TEAM_APPLICATION_RECEIVED" as const,
      variables: {
        companyName: "Northstar Labs",
        recipientRole: "RECRUITER" as const,
        state: "HR_MANAGER",
      },
      contextType: "MEMBERSHIP" as const,
      contextId: "company-1",
    };
    const vi = buildNotification(input, "VI");
    const en = buildNotification(input, "EN");

    expect(vi.title).toBe("Có hồ sơ ứng tuyển đội ngũ mới");
    expect(vi.summary).toContain("Northstar Labs");
    expect(vi.summary).toContain("HR Manager");
    expect(en.title).toBe("New team application received");
    expect(en.summary).toContain("HR Manager team application");
    expect(en.recipientRole).toBe("RECRUITER");
  });

  it("assigns actionable administrator alerts safe severity and generic copy", () => {
    const expected = {
      SUPPORT_CASE_RECEIVED: "MEDIUM",
      SUPPORT_REQUESTER_REPLIED: "HIGH",
      SUPPORT_CASE_REOPENED: "HIGH",
      MESSAGE_REPORT_RECEIVED_ADMIN: "HIGH",
      MODERATION_REPORT_RECEIVED_ADMIN: "HIGH",
      VERIFICATION_REVIEW_OVERDUE: "HIGH",
      DELIVERY_MANUAL_INTERVENTION_REQUIRED: "CRITICAL",
    } as const;
    for (const [kind, severity] of Object.entries(expected)) {
      const notification = buildNotification(
        {
          ...base,
          kind: kind as never,
          variables: { audience: "ADMIN", state: "ACTION_REQUIRED" },
        },
        "EN",
      );
      expect(notification.severity).toBe(severity);
      expect(notification.title).not.toContain("ACTION_REQUIRED");
      expect(notification.summary).not.toContain("user@example.test");
    }
    expect(notificationKinds).toEqual(
      expect.arrayContaining(Object.keys(expected)),
    );
  });

  it("rejects unknown variables and context mismatches", () => {
    expect(() =>
      buildNotification({
        ...base,
        kind: "PASSWORD_CHANGED",
        variables: { protectedToken: "secret" } as never,
      }),
    ).toThrow();
    expect(() =>
      buildNotification({
        ...base,
        kind: "PASSWORD_CHANGED",
        contextType: "ACCOUNT",
      }),
    ).toThrow("NOTIFICATION_CONTEXT_INVALID");
  });

  it("keeps all challenge and proof email kinds out of the event catalog", () => {
    expect(proofEmailKinds).toEqual([
      "VERIFY_EMAIL",
      "EMAIL_CHANGE_VERIFY",
      "RESET_PASSWORD",
      "COMPANY_EMAIL_VERIFY",
    ]);
    for (const kind of proofEmailKinds)
      expect(notificationKinds).not.toContain(kind as never);
  });
});
