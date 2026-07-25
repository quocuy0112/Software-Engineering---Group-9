import { describe, expect, it } from "vitest";
import { POST as requestRecovery } from "@/app/api/identity/account-recovery/request/route";
import { POST as confirmRecovery } from "@/app/api/identity/account-recovery/confirm/route";
import { POST as cancelRecovery } from "@/app/api/identity/account-recovery/cancel/route";
import { POST as completeRecovery } from "@/app/api/identity/account-recovery/complete/route";

function request(
  path: string,
  body: unknown,
  origin = "http://localhost:3001",
) {
  return new Request(`http://localhost:3001${path}`, {
    method: "POST",
    headers: {
      origin,
      "sec-fetch-site": "same-origin",
      "content-type": "application/json",
      "x-forwarded-for": "attacker-controlled",
      forwarded: "for=attacker-controlled",
    },
    body: JSON.stringify(body),
  });
}

describe("full account recovery route boundary", () => {
  it("returns a clear no-store validation error for malformed input", async () => {
    const response = await requestRecovery(
      request("/api/identity/account-recovery/request", {
        email: "not-an-email",
      }),
    );
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({
      message: "Enter a valid email address.",
    });
  });

  it("rejects cross-origin writes before any recovery service executes", async () => {
    const response = await requestRecovery(
      request(
        "/api/identity/account-recovery/request",
        { email: "person@example.test" },
        "https://attacker.example",
      ),
    );
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("never echoes invalid confirmation, cancellation, or completion proofs", async () => {
    const proof = "raw-proof-must-not-be-returned".padEnd(40, "x");
    const responses = await Promise.all([
      confirmRecovery(
        request("/api/identity/account-recovery/confirm", { proof }),
      ),
      cancelRecovery(
        request("/api/identity/account-recovery/cancel", { proof }),
      ),
      completeRecovery(
        request("/api/identity/account-recovery/complete", {
          completionProof: proof,
          newPassword: "new recovery password 2026!",
          confirmPassword: "new recovery password 2026!",
        }),
      ),
    ]);
    for (const response of responses) {
      const body = await response.text();
      expect(response.status).toBe(400);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(body).not.toContain(proof);
    }
  });
});
