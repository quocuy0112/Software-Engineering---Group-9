import { describe, expect, it } from "vitest";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/features/identity/schemas/password-recovery";

describe("password recovery schemas", () => {
  it("normalizes a bounded email and rejects unknown fields", () => {
    expect(forgotPasswordSchema.parse({ email: " User@Example.Test " })).toEqual({
      email: "user@example.test",
    });
    expect(forgotPasswordSchema.safeParse({ email: "user@example.test", token: "x" }).success).toBe(false);
    expect(forgotPasswordSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
  });

  it("requires bounded matching passwords and an opaque bounded token", () => {
    expect(resetPasswordSchema.safeParse({ token: "t", newPassword: "correct horse 2026", confirmPassword: "correct horse 2026" }).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ token: "t", newPassword: "short", confirmPassword: "short" }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ token: "t", newPassword: "correct horse 2026", confirmPassword: "different password" }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ token: "t", newPassword: "correct horse 2026", confirmPassword: "correct horse 2026", extra: "x" }).success).toBe(false);
  });
});
