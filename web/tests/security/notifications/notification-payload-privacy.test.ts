import { describe, expect, it } from "vitest";
import { buildNotification } from "@/backend/notifications/event-policy";

const base = {
  recipientUserId: "recipient-1",
  kind: "PASSWORD_CHANGED" as const,
  deduplicationKey: "password-change:1",
  correlationId: "correlation-1",
  occurredAt: new Date("2026-08-14T00:00:00.000Z"),
};

describe("notification payload privacy", () => {
  it.each([
    "token",
    "proof",
    "privateEvidence",
    "html",
    "emailAddress",
    "phone",
  ])("rejects the unsafe variable %s", (key) => {
    expect(() =>
      buildNotification({
        ...base,
        variables: { [key]: "sensitive" } as never,
      }),
    ).toThrow();
  });

  it("only creates encoded internal destinations", () => {
    const notification = buildNotification({
      ...base,
      kind: "MESSAGE_RECEIVED",
      contextType: "CONVERSATION",
      contextId: "../../external?next=https://evil.example",
    });
    expect(notification.href).toBe(
      "/messages?conversation=..%2F..%2Fexternal%3Fnext%3Dhttps%3A%2F%2Fevil.example",
    );
    expect(notification.href).not.toMatch(/^https?:/u);
  });

  it("keeps actionable administrator alerts free of protected workflow content", () => {
    for (const kind of [
      "SUPPORT_CASE_RECEIVED",
      "SUPPORT_REQUESTER_REPLIED",
      "SUPPORT_CASE_REOPENED",
      "MESSAGE_REPORT_RECEIVED_ADMIN",
      "MODERATION_REPORT_RECEIVED_ADMIN",
      "VERIFICATION_REVIEW_OVERDUE",
      "DELIVERY_MANUAL_INTERVENTION_REQUIRED",
    ] as const) {
      const notification = buildNotification({
        ...base,
        kind: kind as never,
        contextType: kind.startsWith("SUPPORT_")
          ? "SUPPORT_CASE"
          : kind.startsWith("MESSAGE_REPORT")
            ? "MESSAGING_REPORT"
            : kind.startsWith("MODERATION_REPORT")
              ? "MODERATION_REPORT"
              : kind.startsWith("VERIFICATION_")
                ? "VERIFICATION_REQUEST"
                : "ACCOUNT",
        contextId: "opaque-resource-id",
        variables: { audience: "ADMIN", state: "ACTION_REQUIRED" },
      });
      const serialized = JSON.stringify(notification);
      for (const protectedValue of [
        "support subject",
        "message body",
        "report evidence",
        "user@example.test",
        "private note",
        "privileged rationale",
      ]) {
        expect(serialized).not.toContain(protectedValue);
      }
    }
  });
});
