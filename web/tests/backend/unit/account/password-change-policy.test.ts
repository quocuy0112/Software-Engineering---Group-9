import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PasswordPolicy } from "@/backend/auth/policy/password-policy";

const policy = new PasswordPolicy();
const currentPassword = "Current password 2026!";

async function evaluate(
  newPassword: string,
  confirmation = newPassword,
  newPasswordMatchesCurrent = false,
) {
  return policy.evaluateChange({
    currentPassword,
    newPassword,
    newPasswordConfirmation: confirmation,
    newPasswordMatchesCurrent,
  });
}

describe("password-change policy", () => {
  it("counts Unicode code points and accepts valid composition at 12 and 128", async () => {
    expect(await evaluate(`A1!${"a".repeat(9)}`)).toEqual({ accepted: true });
    expect(await evaluate(`A1!${"a".repeat(125)}`)).toEqual({ accepted: true });
    expect(await evaluate("🔐".repeat(11))).toMatchObject({
      accepted: false,
      code: "PASSWORD_POLICY",
    });
    expect(await evaluate("🔐".repeat(129))).toMatchObject({
      accepted: false,
      code: "PASSWORD_POLICY",
    });
    expect(await evaluate("A calm password! 2026")).toEqual({ accepted: true });
  });

  it("requires uppercase, digit, and special-character composition", async () => {
    expect(await evaluate("all lowercase words only!")).toMatchObject({
      code: "PASSWORD_POLICY",
    });
    expect(await evaluate("ALL UPPERCASE WORDS 2026")).toMatchObject({
      code: "PASSWORD_POLICY",
    });
    expect(await evaluate("Uppercase without number!")).toMatchObject({
      code: "PASSWORD_POLICY",
    });
  });

  it("rejects mismatch, common/compromised values, and current reuse", async () => {
    expect(
      await evaluate("A different password", "not the same value"),
    ).toMatchObject({
      accepted: false,
      code: "PASSWORD_CONFIRMATION_MISMATCH",
    });
    expect(await evaluate("123456789012")).toMatchObject({
      accepted: false,
      code: "PASSWORD_COMPROMISED",
    });
    expect(await evaluate(currentPassword)).toMatchObject({
      accepted: false,
      code: "PASSWORD_REUSE",
    });
    expect(
      await evaluate("A hidden current equivalent", undefined, true),
    ).toMatchObject({
      accepted: false,
      code: "PASSWORD_REUSE",
    });
  });

  it("does not add password-history persistence", () => {
    const schema = readFileSync(
      resolve(process.cwd(), "prisma/schema.prisma"),
      "utf8",
    );
    expect(schema).not.toMatch(
      /PasswordHistory|passwordHistory|previousPassword|previousHash/u,
    );
  });
});
