import { describe, expect, it } from "vitest";
import { authenticationAuditEventSchema } from "@/backend/audit/events";

describe("profile discovery audit allowlist", () => {
  const base = { occurredAt: new Date(), actorType: "user" as const, actorUserId: "viewer", actorSessionId: null, targetType: "profile_discovery" as const, targetId: "hmac-digest", result: "DENIED" as const, correlationId: "12345678", context: { outcome: "neutral" } };
  it("allows the neutral lookup action with a digest reference", () => {
    expect(authenticationAuditEventSchema.parse({ ...base, action: "profile.discovery_neutral" }).targetId).toBe("hmac-digest");
  });
  it("rejects raw contact fields in audit context", () => {
    expect(() => authenticationAuditEventSchema.parse({ ...base, action: "profile.discovery_neutral", context: { outcome: "neutral", email: "private@example.com" } })).toThrow();
  });
});
