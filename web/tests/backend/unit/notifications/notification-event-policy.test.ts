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

  it("uses Vietnamese with English fallback and safe internal destinations", () => {
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
    expect(en.href).toBe("/messages?conversation=conversation%201");
    expect(en.groupable).toBe(true);
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
