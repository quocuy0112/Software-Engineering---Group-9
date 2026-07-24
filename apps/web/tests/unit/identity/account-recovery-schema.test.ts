import { describe, expect, it } from "vitest";
import {
  accountRecoveryProofSchema,
  accountRecoveryRequestSchema,
  completeAccountRecoverySchema,
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
    expect(accountRecoveryProofSchema.safeParse({ proof }).success).toBe(true);
    expect(accountRecoveryProofSchema.safeParse({ proof: "short" }).success).toBe(
      false,
    );
    expect(
      completeAccountRecoverySchema.safeParse({
        completionProof: proof,
        newPassword: "new recovery password 2026!",
        confirmPassword: "new recovery password 2026!",
      }).success,
    ).toBe(true);
    expect(
      completeAccountRecoverySchema.safeParse({
        completionProof: proof,
        newPassword: "new recovery password 2026!",
        confirmPassword: "different recovery password 2026!",
      }).success,
    ).toBe(false);
  });
});
