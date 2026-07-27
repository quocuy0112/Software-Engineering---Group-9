import { describe, expect, it } from "vitest";
import {
  accountRecoveryActionSchema,
  accountRecoveryCapabilitySchema,
  accountRecoveryRequestSchema,
  completeAccountRecoveryActionSchema,
} from "@/features/identity/schemas/password-recovery";

describe("full account recovery schemas", () => {
  it("normalizes email and rejects unknown request fields", () => {
    expect(
      accountRecoveryRequestSchema.parse({ email: " Person@Example.Test " }),
    ).toEqual({ email: "person@example.test" });
    expect(
      accountRecoveryRequestSchema.safeParse({
        email: "person@example.test",
        proof: "secret",
      }).success,
    ).toBe(false);
  });

  it("accepts only bounded write-only proofs and matching compliant passwords", () => {
    const proof = "a".repeat(32);
    expect(
      accountRecoveryCapabilitySchema.safeParse({
        kind: "confirmation",
        proof,
      }).success,
    ).toBe(true);
    expect(
      accountRecoveryCapabilitySchema.safeParse({
        kind: "confirmation",
        proof: "short",
      }).success,
    ).toBe(false);
    expect(accountRecoveryActionSchema.safeParse({}).success).toBe(true);
    expect(accountRecoveryActionSchema.safeParse({ proof }).success).toBe(
      false,
    );
    expect(
      completeAccountRecoveryActionSchema.safeParse({
        newPassword: "new recovery password 2026!",
        confirmPassword: "new recovery password 2026!",
      }).success,
    ).toBe(true);
    expect(
      completeAccountRecoveryActionSchema.safeParse({
        newPassword: "new recovery password 2026!",
        confirmPassword: "different recovery password 2026!",
      }).success,
    ).toBe(false);
  });
});
