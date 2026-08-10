import { describe, expect, it } from "vitest";
import { privilegedCommandSchema } from "@/shared/contracts/admin/commands";
import { loginSessionProjectionSchema } from "@/shared/contracts/admin/resources";
import { maskEmail } from "@/backend/admin/accounts/account-list-service";

describe("account security contracts", () => {
  it("requires confirmation, a category, a UUID idempotency key, and 10-500 normalized characters", () => {
    expect(() =>
      privilegedCommandSchema.parse({
        expectedVersion: 1,
        confirmation: true,
        idempotencyKey: crypto.randomUUID(),
        reasonCategory: "OTHER",
        explanation: "too short",
      }),
    ).toThrow();
    expect(
      privilegedCommandSchema.parse({
        expectedVersion: 1,
        confirmation: true,
        idempotencyKey: crypto.randomUUID(),
        reasonCategory: "ACCESS_CLEANUP",
        explanation: "  access cleanup approved  ",
      }).explanation,
    ).toBe("access cleanup approved");
  });

  it("exposes no reusable session identifier or network address", () => {
    expect(() =>
      loginSessionProjectionSchema.parse({
        reference: "opaque",
        deviceDescription: "Firefox on Windows",
        approximateLocation: null,
        createdAt: "2026-08-10T00:00:00.000Z",
        lastActivityAt: "2026-08-10T00:00:00.000Z",
        expiresAt: "2026-08-11T00:00:00.000Z",
        token: "secret",
      }),
    ).toThrow();
  });

  it("masks Unicode local parts exactly", () => {
    expect(maskEmail("a@example.test")).toBe("***@example.test");
    expect(maskEmail("áb@example.test")).toBe("á***@example.test");
  });
});
