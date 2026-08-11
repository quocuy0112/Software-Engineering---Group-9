import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { adminNoStoreHeaders } from "@/backend/admin/http/admin-route";

describe("admin authentication contract", () => {
  const provider = readFileSync(
    "src/frontend/features/admin/app/auth-provider.ts",
    "utf8",
  );
  it("uses Better Auth cookies and memory-only CSRF state", () => {
    expect(provider).toContain('credentials: "same-origin"');
    expect(provider).toContain('cache: "no-store"');
    expect(provider).not.toMatch(/localStorage|sessionStorage|indexedDB/u);
    expect(provider).not.toMatch(/Authorization|Bearer/u);
  });
  it.each(["context", "login", "two-factor", "step-up", "logout"])(
    "implements the %s route without returning tokens or grants",
    (name) => {
      const source = readFileSync(
        `src/app/api/admin/auth/${name}/route.ts`,
        "utf8",
      );
      expect(source).not.toMatch(/accessToken|refreshToken|permissionToken/u);
      expect(source).toContain("admin");
    },
  );

  it("scopes the pre-authentication cookie to the admin factor route", () => {
    const service = readFileSync(
      "src/backend/admin/authorization/admin-auth-service.ts",
      "utf8",
    );
    const route = readFileSync(
      "src/app/api/admin/auth/two-factor/route.ts",
      "utf8",
    );
    expect(service).toContain("ADMIN_PRE_AUTH_COOKIE_PATH");
    expect(service).toContain("preAuthCookiePath: ADMIN_PRE_AUTH_COOKIE_PATH");
    expect(route).toContain("clearPreAuthCookie(ADMIN_PRE_AUTH_COOKIE_PATH)");
  });

  it("preserves separate session and challenge Set-Cookie headers", () => {
    const source = new Headers();
    source.append("set-cookie", "smarthire.session=session-value; Path=/");
    source.append(
      "set-cookie",
      "smarthire.pre-auth=; Path=/api/admin/auth/two-factor; Max-Age=0",
    );
    expect(adminNoStoreHeaders(source).getSetCookie()).toHaveLength(2);
  });
});
