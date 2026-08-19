import { describe, expect, it } from "vitest";
import {
  completeTwoFactorSchema,
  backupCodeSchema,
  totpCodeSchema,
  TWO_FACTOR_GENERIC_ERROR,
} from "@/shared/contracts/identity/two-factor";
describe("two-factor completion schemas", () => {
  it("accepts only six digit TOTP", () => {
    expect(
      completeTwoFactorSchema.safeParse({ factor: "totp", code: "123456" })
        .success,
    ).toBe(true);
    for (const code of ["12345", "1234567", "12a456", 123456])
      expect(
        completeTwoFactorSchema.safeParse({ factor: "totp", code }).success,
      ).toBe(false);
  });
  it("normalizes presentation separators from authenticator apps", () => {
    expect(totpCodeSchema.safeParse({ code: "123 456" })).toMatchObject({
      success: true,
      data: { code: "123456" },
    });
    expect(
      completeTwoFactorSchema.safeParse({ factor: "totp", code: "123-456" }),
    ).toMatchObject({ success: true, data: { code: "123456" } });
  });
  it("bounds later backup-code input", () => {
    expect(backupCodeSchema.safeParse({ code: "abcd-1234" }).success).toBe(
      true,
    );
    expect(backupCodeSchema.safeParse({ code: "x".repeat(129) }).success).toBe(
      false,
    );
  });
  it("exports only a generic safe error", () => {
    expect(TWO_FACTOR_GENERIC_ERROR).not.toMatch(
      /token|secret|account|user id/i,
    );
  });
});
