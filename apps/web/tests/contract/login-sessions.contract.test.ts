import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loginSchema } from "@/features/identity/schemas/login";
import { POST as login } from "@/app/api/identity/login/route";
import { POST as logout } from "@/app/api/identity/logout/route";
import { GET as sessions } from "@/app/api/identity/sessions/route";

const origin = "http://localhost:3001";

describe("login and session HTTP contract", () => {
  it("accepts only the documented login shape and keeps return paths non-secret", () => {
    expect(loginSchema.safeParse({ email: "user@example.test", password: "value", returnTo: "/settings/sessions" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "user@example.test", password: "value", unexpected: true }).success).toBe(false);
  });

  it("uses generic no-store responses and never exposes a session token", async () => {
    const invalid = await login(new Request(`${origin}/api/identity/login`, {
      method: "POST",
      headers: { origin, "sec-fetch-site": "same-origin", "content-type": "application/json" },
      body: JSON.stringify({ email: "invalid", password: "not-returned" }),
    }));
    expect(invalid.status).toBe(400);
    expect(invalid.headers.get("cache-control")).toMatch(/^no-store/);
    expect(await invalid.text()).not.toContain("not-returned");

    const listed = await sessions(new Request(`${origin}/api/identity/sessions`));
    expect(listed.status).toBe(401);
    expect(listed.headers.get("cache-control")).toMatch(/^no-store/);
    expect(await listed.text()).not.toMatch(/sessionToken|token\s*:/i);

    const signedOut = await logout(new Request(`${origin}/api/identity/logout`, { method: "POST", headers: { origin, "sec-fetch-site": "same-origin" } }));
    expect(signedOut.status).toBe(200);
    expect(signedOut.headers.get("cache-control")).toMatch(/^no-store/);
  });

  it("documents the sole cookie session and sanitized list/revoke boundaries", async () => {
    const openapi = await readFile(resolve(process.cwd(), "../../src/specs/001-identity-authentication-account-recovery/contracts/openapi.yaml"), "utf8");
    expect(openapi).toContain("name: __Host-smarthire.session");
    expect(openapi).toContain("SessionListOutcome:");
    expect(openapi).toContain("/api/identity/sessions/{sessionReference}:");
    expect(openapi).not.toMatch(/sessionToken:/);
  });
});
