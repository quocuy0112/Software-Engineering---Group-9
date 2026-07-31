import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  passwordChangeIdempotencyKeySchema,
  passwordChangeLockedErrorSchema,
  passwordChangeOutcomeSchema,
  passwordChangeRequestSchema,
  passwordChangeRetryableErrorSchema,
} from "@/shared/contracts/account/password-change";

const valid = {
  currentPassword: "Current password 2026!",
  newPassword: "A different password 2026!",
  newPasswordConfirmation: "A different password 2026!",
};

describe("password-change contract", () => {
  it("accepts the three password fields and rejects unknown ownership/session input", () => {
    expect(passwordChangeRequestSchema.safeParse(valid).success).toBe(true);
    for (const extra of [
      { userId: "other-user" },
      { accountId: "other-account" },
      { sessionId: "client-selected-session" },
      { revokeOtherSessions: false },
    ]) {
      expect(
        passwordChangeRequestSchema.safeParse({ ...valid, ...extra }).success,
      ).toBe(false);
    }
  });

  it("uses Unicode code points at the exact 12/128 boundaries", () => {
    const twelve = "🔐".repeat(12);
    const oneHundredTwentyEight = "🔐".repeat(128);
    expect(
      passwordChangeRequestSchema.safeParse({
        ...valid,
        newPassword: twelve,
        newPasswordConfirmation: twelve,
      }).success,
    ).toBe(true);
    expect(
      passwordChangeRequestSchema.safeParse({
        ...valid,
        newPassword: oneHundredTwentyEight,
        newPasswordConfirmation: oneHundredTwentyEight,
      }).success,
    ).toBe(true);
    expect(
      passwordChangeRequestSchema.safeParse({
        ...valid,
        newPassword: "🔐".repeat(129),
        newPasswordConfirmation: "🔐".repeat(129),
      }).success,
    ).toBe(false);
  });

  it("requires an opaque idempotency header and exposes only safe result fields", () => {
    expect(
      passwordChangeIdempotencyKeySchema.safeParse(
        "password_change_request_0001",
      ).success,
    ).toBe(true);
    expect(passwordChangeIdempotencyKeySchema.safeParse("short").success).toBe(
      false,
    );
    const result = passwordChangeOutcomeSchema.parse({
      status: "success",
      message: "Password changed.",
    });
    expect(Object.keys(result).sort()).toEqual(["message", "status"]);
    expect(JSON.stringify(result)).not.toMatch(
      /sessionId|userId|token|cookie|hash/i,
    );
    expect(JSON.stringify(result)).not.toContain(valid.currentPassword);
    expect(JSON.stringify(result)).not.toContain(valid.newPassword);
  });

  it("keeps lock and incomplete errors generic with bounded retry metadata", () => {
    expect(
      passwordChangeLockedErrorSchema.parse({
        code: "PASSWORD_CHANGE_LOCKED",
        message: "Try again later.",
        retryAfterSeconds: 900,
      }),
    ).toEqual({
      code: "PASSWORD_CHANGE_LOCKED",
      message: "Try again later.",
      retryAfterSeconds: 900,
    });
    expect(
      passwordChangeRetryableErrorSchema.parse({
        code: "PASSWORD_CHANGE_INCOMPLETE",
        message: "The password change could not be completed. Try again.",
      }),
    ).not.toHaveProperty("operationId");
  });

  it("matches the documented body, status, idempotency, and no-store surface", () => {
    const openapi = readFileSync(
      resolve(
        process.cwd(),
        "../spec-kit/specs/002-candidate-profile-account-management/contracts/openapi.yaml",
      ),
      "utf8",
    );
    expect(openapi).toContain("/api/account/password/change:");
    expect(openapi).toContain('$ref: "#/components/parameters/IdempotencyKey"');
    expect(openapi).toContain(
      '$ref: "#/components/schemas/PasswordChangeRequest"',
    );
    expect(openapi).toContain('$ref: "#/components/headers/NoStoreHeader"');
    for (const status of ["200", "400", "401", "403", "409", "429", "503"]) {
      expect(openapi).toContain(`"${status}":`);
    }
  });
});
