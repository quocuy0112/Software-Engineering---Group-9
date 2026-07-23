import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { forgotPasswordSchema, PASSWORD_RECOVERY_GENERIC_RESPONSE, PASSWORD_RESET_GENERIC_ERROR, resetPasswordSchema } from "@/features/identity/schemas/password-recovery";
import { POST as forgot } from "@/app/api/identity/password/forgot/route";
import { POST as reset } from "@/app/api/identity/password/reset/route";

const origin = "http://localhost:3001";
const post = (path: string, body: unknown) => new Request(`${origin}${path}`, { method: "POST", headers: { origin, "sec-fetch-site": "same-origin", "content-type": "application/json" }, body: JSON.stringify(body) });

describe("password recovery HTTP contract", () => {
  it("normalizes request email and requires a strict matching reset object", () => {
    expect(forgotPasswordSchema.parse({ email: " User@Example.Test " }).email).toBe("user@example.test");
    expect(resetPasswordSchema.safeParse({ token: "opaque", newPassword: "correct horse 2026", confirmPassword: "correct horse 2026" }).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ token: "opaque", newPassword: "correct horse 2026", confirmPassword: "different value 2026" }).success).toBe(false);
  });

  it("keeps request and reset failures generic, secret-free, and no-store", async () => {
    const requested = await forgot(post("/api/identity/password/forgot", { email: "not-an-email" }));
    expect(requested.status).toBe(202);
    expect(requested.headers.get("cache-control")).toMatch(/^no-store/);
    expect(await requested.json()).toEqual({ message: PASSWORD_RECOVERY_GENERIC_RESPONSE });

    const token = "not-a-valid-reset-handle";
    const changed = await reset(post("/api/identity/password/reset", { token, newPassword: "short", confirmPassword: "short" }));
    expect(changed.status).toBe(400);
    expect(changed.headers.get("cache-control")).toMatch(/^no-store/);
    expect(await changed.json()).toEqual({ message: PASSWORD_RESET_GENERIC_ERROR });
  });

  it("documents successful revocation and never models returned credentials", async () => {
    const openapi = await readFile(resolve(process.cwd(), "../../src/specs/001-identity-authentication-account-recovery/contracts/openapi.yaml"), "utf8");
    expect(openapi).toContain("required: [token, newPassword, confirmPassword]");
    expect(openapi).toContain("Password changed; all sessions revoked; normal login required");
    expect(openapi).not.toMatch(/resetToken:|sessionToken:/);
  });
});
