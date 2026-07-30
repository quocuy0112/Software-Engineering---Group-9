import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { registrationSchema, verificationTokenSchema } from "@/shared/contracts/identity/registration";
import { POST as register } from "@/app/api/identity/register/route";
import { POST as verify } from "@/app/api/identity/verification/consume/route";

const origin = "http://localhost:3001";
const request = (url: string, body: unknown) =>
  new Request(`${origin}${url}`, {
    method: "POST",
    headers: { origin, "sec-fetch-site": "same-origin", "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("registration and verification HTTP contract", () => {
  it("keeps request schemas strict, normalized, and write-only in OpenAPI", async () => {
    expect(
      registrationSchema.parse({
        name: "Candidate",
        email: " Candidate@Example.Test ",
        password: "correct horse 2026",
        passwordConfirmation: "correct horse 2026",
      }).email,
    ).toBe("candidate@example.test");
    expect(registrationSchema.safeParse({ name: "Candidate", extra: true })).toMatchObject({ success: false });
    expect(verificationTokenSchema.safeParse({ token: "short" }).success).toBe(false);

    const openapi = await readFile(
      resolve(process.cwd(), "../../src/specs/001-identity-authentication-account-recovery/contracts/openapi.yaml"),
      "utf8",
    );
    expect(openapi).toContain("/api/identity/register:");
    expect(openapi).toContain("/api/identity/verification/consume:");
    expect(openapi).toMatch(/password: \{[^\n]*writeOnly: true/);
    expect(openapi).toMatch(/TokenRequest:[^\n]*writeOnly: true/);
  });

  it("returns no-store field-safe failures without echoing submitted secrets", async () => {
    const password = "contract-secret-value";
    const registration = await register(request("/api/identity/register", {
      name: "",
      email: "invalid",
      password,
      passwordConfirmation: password,
    }));
    expect(registration.status).toBe(400);
    expect(registration.headers.get("cache-control")).toMatch(/^no-store/);
    expect(await registration.text()).not.toContain(password);

    const token = "invalid-contract-token";
    const verification = await verify(request("/api/identity/verification/consume", { token }));
    expect(verification.status).toBe(400);
    expect(verification.headers.get("cache-control")).toMatch(/^no-store/);
    expect(await verification.text()).toBe('{"status":"failure"}');
  });
});
