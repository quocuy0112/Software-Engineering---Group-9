import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { authenticationAuditEventSchema } from "@/backend/audit/events";

const source = readFileSync(
  resolve(process.cwd(), "src/backend/audit/events.ts"),
  "utf8",
);

describe("administrator audit correlation and privacy", () => {
  it("accepts the required safe correlation fields", () => {
    const event = authenticationAuditEventSchema.parse({
      occurredAt: new Date("2026-08-10T00:00:00.000Z"),
      actorType: "user",
      actorUserId: "admin-1",
      actorSessionId: "session-1",
      action: "admin.account_suspended",
      targetType: "user_account",
      targetId: "account-1",
      result: "SUCCESS",
      correlationId: "correlation-0001",
      context: {
        priorState: "ACTIVE",
        resultingState: "SUSPENDED",
        reasonCategory: "POLICY_VIOLATION",
      },
    });
    expect(event).toMatchObject({
      actorUserId: "admin-1",
      targetId: "account-1",
      result: "SUCCESS",
    });
  });

  it("rejects rationale text, evidence locators, credentials, and arbitrary context", () => {
    for (const forbidden of [
      "explanation",
      "storageLocator",
      "password",
      "token",
      "documentBytes",
    ]) {
      expect(() =>
        authenticationAuditEventSchema.parse({
          occurredAt: new Date(),
          actorType: "user",
          action: "admin.account_suspended",
          targetType: "user_account",
          result: "SUCCESS",
          correlationId: "correlation-0001",
          context: { [forbidden]: "secret-canary" },
        }),
      ).toThrow();
    }
    expect(source).not.toMatch(/privateNote\s*:/u);
  });
});
