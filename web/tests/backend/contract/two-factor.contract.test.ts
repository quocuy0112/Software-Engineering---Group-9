import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  completeTwoFactorSchema,
  twoFactorManagementSchema,
} from "@/shared/contracts/identity/two-factor";
import {
  clearCookieAttributes,
  identityCookiePolicy,
  PRE_AUTH_COOKIE_PATH,
} from "@/backend/security/cookies";
import { POST as complete } from "@/app/api/identity/two-factor/complete/route";

describe("two-factor and cookie contract", () => {
  it("requires the exact discriminated completion and management objects", () => {
    expect(
      completeTwoFactorSchema.safeParse({ factor: "totp", code: "123456" })
        .success,
    ).toBe(true);
    expect(
      completeTwoFactorSchema.safeParse({
        factor: "backup-code",
        code: "abcd-efgh",
      }).success,
    ).toBe(true);
    expect(
      completeTwoFactorSchema.safeParse({ method: "totp", code: "123456" })
        .success,
    ).toBe(false);
    expect(
      twoFactorManagementSchema.safeParse({
        currentPassword: "proof",
        code: "123456",
      }).success,
    ).toBe(true);
    expect(
      twoFactorManagementSchema.safeParse({ currentPassword: "proof" }).success,
    ).toBe(false);
    expect(
      twoFactorManagementSchema.safeParse({
        currentPassword: "proof",
        code: "123456",
        extra: true,
      }).success,
    ).toBe(false);
  });

  it("applies environment-aware names and matching cookie-clear attributes", () => {
    const local = identityCookiePolicy({
      APP_ENV: "local",
      SESSION_COOKIE_NAME: "smarthire.session",
      PRE_AUTH_COOKIE_NAME: "smarthire.pre-auth",
      COOKIE_SECURE: false,
    });
    expect(local.session).toMatchObject({
      name: "smarthire.session",
      attributes: { path: "/", secure: false, httpOnly: true, sameSite: "lax" },
    });
    expect(local.preAuth).toMatchObject({
      name: "smarthire.pre-auth",
      attributes: { path: PRE_AUTH_COOKIE_PATH, secure: false, maxAge: 300 },
    });
    expect(clearCookieAttributes(local.preAuth.attributes)).toMatchObject({
      path: PRE_AUTH_COOKIE_PATH,
      secure: false,
      maxAge: 0,
    });

    const production = identityCookiePolicy({
      APP_ENV: "production",
      SESSION_COOKIE_NAME: "__Host-smarthire.session",
      PRE_AUTH_COOKIE_NAME: "__Secure-smarthire.pre-auth",
      COOKIE_SECURE: true,
    });
    expect(production.session).toMatchObject({
      name: "__Host-smarthire.session",
      attributes: { path: "/", secure: true },
    });
    expect(production.preAuth).toMatchObject({
      name: "__Secure-smarthire.pre-auth",
      attributes: { path: PRE_AUTH_COOKIE_PATH, secure: true },
    });
  });

  it("rejects a normal session cookie as pre-auth proof with a generic no-store response", async () => {
    const response = await complete(
      new Request("http://localhost:3001/api/identity/two-factor/complete", {
        method: "POST",
        headers: {
          origin: "http://localhost:3001",
          "sec-fetch-site": "same-origin",
          "content-type": "application/json",
          cookie: "smarthire.session=opaque",
        },
        body: JSON.stringify({ factor: "totp", code: "123456" }),
      }),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toMatch(/^no-store/);
    expect(await response.json()).toEqual({
      message: "Verification could not be completed. Sign in and try again.",
    });
  });

  it("documents one Better Auth session mechanism and correct cookie scopes", async () => {
    const contract = await readFile(
      resolve(
        process.cwd(),
        "../spec-kit/specs/001-identity-authentication-account-recovery/contracts/openapi.yaml",
      ),
      "utf8",
    );
    expect(contract).toContain("required: [factor, code]");
    expect(contract).toContain("const: backup-code");
    expect(contract).toContain("required: [currentPassword, code]");
    expect(contract).toContain("Path=/api/identity/two-factor/complete");
    expect(contract).toContain("Path=/; no Domain");

    const services = await Promise.all([
      readFile(
        resolve(
          process.cwd(),
          "src/backend/services/identity/login-with-password.ts",
        ),
        "utf8",
      ),
      readFile(
        resolve(
          process.cwd(),
          "src/backend/services/two-factor/complete-two-factor.ts",
        ),
        "utf8",
      ),
    ]);
    expect(
      services.every((source) => source.includes("BetterAuthSessionGateway")),
    ).toBe(true);
    expect(services.join("\n")).not.toMatch(
      /prisma\.session\.create|new Session\(/,
    );
  });
});
