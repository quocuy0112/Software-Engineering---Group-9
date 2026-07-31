import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { PasswordPolicy } from "@/backend/auth/policy/password-policy";
import type { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import type { PrismaRateLimitRepository } from "@/backend/repositories/rate-limit/prisma-rate-limit-repository";

describe("SmartHire password operation boundary", () => {
  it("accepts Unicode and spaces within 12–128 characters", async () => {
    await expect(
      new PasswordPolicy().evaluate("Đúng mật khẩu dài 2026"),
    ).resolves.toEqual({ accepted: true });
  });
  it("rejects short, oversized, control-character, and compromised passwords", async () => {
    const policy = new PasswordPolicy();
    expect((await policy.evaluate("short")).accepted).toBe(false);
    expect((await policy.evaluate("a".repeat(129))).accepted).toBe(false);
    expect((await policy.evaluate("safe-password\nvalue")).accepted).toBe(
      false,
    );
    expect(await policy.evaluate("123456789012")).toMatchObject({
      accepted: false,
      code: "PASSWORD_COMPROMISED",
    });
  });
  it("returns generic safe credential errors", () => {
    expect(new PasswordPolicy().mapCredentialError().message).not.toMatch(
      /password|email|account/i,
    );
  });
  it("integrates rate limiting and audit without exposing the subject", async () => {
    const consume = vi.fn().mockResolvedValue({
      allowed: false,
      limit: 5,
      remaining: 0,
      retryAfterSeconds: 60,
    });
    const append = vi.fn().mockResolvedValue("audit");
    const policy = new PasswordPolicy(
      { consume } as unknown as PrismaRateLimitRepository,
      { append } as unknown as PrismaAuditRepository,
    );
    expect(
      await policy.evaluate("valid password 2026", {
        subject: "private@example.test",
        correlationId: "correlation-123",
      }),
    ).toMatchObject({ code: "RATE_LIMITED", retryAfterSeconds: 60 });
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "rate_limit.denied",
        result: "DENIED",
      }),
    );
    expect(JSON.stringify(append.mock.calls)).not.toContain(
      "private@example.test",
    );
  });
  it("contains no independent SmartHire password hashing or verification implementation", async () => {
    const source = await readFile(
      resolve(process.cwd(), "src/backend/auth/policy/password-policy.ts"),
      "utf8",
    );
    expect(source).not.toMatch(
      /scrypt|argon|bcrypt|pbkdf|createHash|verifyPassword|hashPassword/,
    );
    const gateway = await readFile(
      resolve(
        process.cwd(),
        "src/backend/auth/better-auth/better-auth-gateway.ts",
      ),
      "utf8",
    );
    expect(gateway).toContain('from "better-auth/crypto"');
  });
});
