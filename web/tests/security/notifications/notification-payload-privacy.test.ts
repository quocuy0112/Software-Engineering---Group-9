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
});
