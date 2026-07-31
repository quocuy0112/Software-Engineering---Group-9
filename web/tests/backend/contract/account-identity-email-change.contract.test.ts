import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  accountIdentityMutationOutcomeSchema,
  accountIdentitySchema,
  accountNameMutationSchema,
} from "@/shared/contracts/account/identity";
import {
  emailChangeProofSchema,
  emailChangeQueuedSchema,
  emailChangeRequestSchema,
} from "@/shared/contracts/account/email-change";
import {
  GET as getIdentity,
  PATCH as patchIdentity,
} from "@/app/api/account/identity/route";
import { POST as requestEmailChange } from "@/app/api/account/email-change/request/route";
import { POST as verifyEmailChange } from "@/app/api/account/email-change/verify/route";

const identity = {
  name: "Nguyen Van An",
  email: "candidate@example.test",
  emailVerified: true,
  accountState: "ACTIVE" as const,
  createdAt: "2026-07-31T00:00:00.000Z",
  pendingEmailChange: null,
};

describe("account identity and email-change contract", () => {
  it("keeps identity strict and exposes only a safe pending projection", () => {
    expect(accountIdentitySchema.parse(identity)).toEqual(identity);
    expect(
      accountIdentitySchema.safeParse({
        ...identity,
        userId: "forged",
      }).success,
    ).toBe(false);
    expect(
      accountIdentitySchema.safeParse({
        ...identity,
        pendingEmailChange: {
          proposedEmail: "new@example.test",
          expiresAt: "2026-07-31T00:30:00.000Z",
          tokenDigest: "secret",
        },
      }).success,
    ).toBe(false);
  });

  it("accepts only a name mutation and requires a complete safe outcome", () => {
    expect(
      accountNameMutationSchema.parse({ name: "Nguyen Van Binh" }),
    ).toEqual({ name: "Nguyen Van Binh" });
    expect(
      accountNameMutationSchema.safeParse({
        name: "Nguyen Van Binh",
        email: "redirect@example.test",
      }).success,
    ).toBe(false);
    expect(
      accountIdentityMutationOutcomeSchema.safeParse({
        identity,
        warnings: [],
        message: "Account identity saved.",
      }).success,
    ).toBe(true);
  });

  it("uses strict request/proof bodies and redacts queued responses", () => {
    expect(
      emailChangeRequestSchema.parse({
        newEmail: "new@example.test",
        currentPassword: "Current password 2026!",
      }),
    ).toMatchObject({ newEmail: "new@example.test" });
    expect(
      emailChangeRequestSchema.safeParse({
        newEmail: "new@example.test",
        currentPassword: "Current password 2026!",
        userId: "forged",
      }).success,
    ).toBe(false);
    expect(
      emailChangeProofSchema.safeParse({
        proof: "a".repeat(43),
        accountId: "forged",
      }).success,
    ).toBe(false);
    expect(
      emailChangeQueuedSchema.safeParse({
        status: "verification-queued",
        expiresAt: "2026-07-31T00:30:00.000Z",
        message: "Check the proposed address.",
        proof: "must-not-leak",
      }).success,
    ).toBe(false);
  });

  it("keeps OpenAPI operations and no-store headers aligned", () => {
    const openapi = readFileSync(
      resolve(
        process.cwd(),
        "../spec-kit/specs/002-candidate-profile-account-management/contracts/openapi.yaml",
      ),
      "utf8",
    );
    expect(openapi).toContain("/api/account/identity:");
    expect(openapi).toContain("operationId: getOwnAccountIdentity");
    expect(openapi).toContain("operationId: updateOwnAccountName");
    expect(openapi).toContain("/api/account/email-change/request:");
    expect(openapi).toContain("operationId: requestOwnEmailChange");
    expect(openapi).toContain("operationId: verifyEmailChange");
    expect(
      openapi.match(/\$ref: "#\/components\/headers\/NoStoreHeader"/g)?.length,
    ).toBeGreaterThanOrEqual(8);
  });

  it("returns no-store for every identity/email-change failure response", async () => {
    const requests = [
      getIdentity(new Request("http://localhost:3001/api/account/identity")),
      patchIdentity(
        new Request("http://localhost:3001/api/account/identity", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "Candidate" }),
        }),
      ),
      requestEmailChange(
        new Request("http://localhost:3001/api/account/email-change/request", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            newEmail: "new@example.test",
            currentPassword: "Current password 2026!",
          }),
        }),
      ),
      verifyEmailChange(
        new Request("http://localhost:3001/api/account/email-change/verify", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "http://localhost:3001",
            "sec-fetch-site": "same-origin",
          },
          body: JSON.stringify({ proof: "malformed" }),
        }),
      ),
    ];
    for (const response of await Promise.all(requests)) {
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(JSON.stringify(await response.json())).not.toMatch(
        /tokenDigest|protectedProof|userId|sessionId/i,
      );
    }
  });
});
