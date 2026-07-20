import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createCookieGetter, getCookies } from "better-auth/cookies";
import { authCookiePolicy, betterAuthCookieOptions } from "@/server/auth/cookie-policy";

describe("exclusive browser-session credential", () => {
  it("uses unprefixed insecure local cookie names", () => {
    const policy = authCookiePolicy({ APP_ENV: "local", SESSION_COOKIE_NAME: "smarthire.session", PRE_AUTH_COOKIE_NAME: "smarthire.pre-auth", COOKIE_SECURE: false });
    expect(policy).toEqual({ sessionName: "smarthire.session", preAuthName: "smarthire.pre-auth", attributes: { httpOnly: true, sameSite: "lax", secure: false, path: "/" } });
  });

  it("uses exact secure production cookie names without a Domain", () => {
    const policy = authCookiePolicy({ APP_ENV: "production", SESSION_COOKIE_NAME: "__Host-smarthire.session", PRE_AUTH_COOKIE_NAME: "__Secure-smarthire.pre-auth", COOKIE_SECURE: true });
    expect(policy.sessionName).toBe("__Host-smarthire.session");
    expect(policy.preAuthName).toBe("__Secure-smarthire.pre-auth");
    expect(policy.attributes).toMatchObject({ secure: true, httpOnly: true, sameSite: "lax", path: "/" });
    expect(policy.attributes).not.toHaveProperty("domain");
    const options = { session: { expiresIn: 604740 }, advanced: betterAuthCookieOptions(policy) };
    const sessionCookie = getCookies(options).sessionToken;
    const preAuthCookie = createCookieGetter(options)("two_factor");
    expect(sessionCookie.name).toBe("__Host-smarthire.session");
    expect(sessionCookie.attributes).toMatchObject({ secure: true, httpOnly: true, sameSite: "lax", path: "/" });
    expect(sessionCookie.attributes).not.toHaveProperty("domain");
    expect(preAuthCookie.name).toBe("__Secure-smarthire.pre-auth");
    expect(preAuthCookie.attributes.path).toBe("/api/auth/two-factor");
  });

  it("contains no JWT browser plugin or second session owner", async () => {
    const source = await readFile("src/server/auth/config.ts", "utf8");
    expect(source).not.toMatch(/plugins\/jwt|\bjwt\s*\(/i);
    expect(source.match(/modelName:\s*"Session"/g)).toHaveLength(1);
    expect(source).toContain("cookieCache: { enabled: false }");
  });
});
