import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

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
});
