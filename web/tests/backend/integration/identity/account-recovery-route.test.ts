import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { POST as requestRecovery } from "@/app/api/identity/account-recovery/request/route";
import { POST as authorizeRecovery } from "@/app/api/identity/account-recovery/capability/route";
import { POST as confirmRecovery } from "@/app/api/identity/account-recovery/confirm/route";
import { POST as cancelRecovery } from "@/app/api/identity/account-recovery/cancel/route";
import { POST as completeRecovery } from "@/app/api/identity/account-recovery/complete/route";
import type { AccountRecoveryCapabilityKind } from "@/shared/contracts/identity/password-recovery";
import { prisma } from "@/backend/database/prisma";
import { issueAccountRecoveryCapability } from "@/backend/security/account-recovery-capability";
import { TokenProtector } from "@/backend/security/security-token/security-tokens";

function request(
  path: string,
  body: unknown,
  origin = "http://localhost:3001",
  cookie?: string,
) {
  return new Request(`http://localhost:3001${path}`, {
    method: "POST",
    headers: {
      origin,
      "sec-fetch-site": "same-origin",
      "content-type": "application/json",
      "x-forwarded-for": "attacker-controlled",
      forwarded: "for=attacker-controlled",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

function capabilityCookie(kind: AccountRecoveryCapabilityKind, proof: string) {
  return issueAccountRecoveryCapability(kind, proof).split(";")[0];
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

  it("rejects direct mutation calls that do not have a server-issued capability", async () => {
    const responses = await Promise.all([
      confirmRecovery(request("/api/identity/account-recovery/confirm", {})),
      cancelRecovery(request("/api/identity/account-recovery/cancel", {})),
      completeRecovery(
        request("/api/identity/account-recovery/complete", {
          newPassword: "new recovery password 2026!",
          confirmPassword: "new recovery password 2026!",
        }),
      ),
    ]);
    for (const response of responses) {
      expect(response.status).toBe(403);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(response.headers.get("set-cookie")).toContain(
        "smarthire.recovery-capability=",
      );
    }
  });

  it("cannot consume a real proof or create an operation without a capability", async () => {
    const protector = new TokenProtector();
    const proof = protector.generate();
    const userId = randomUUID();
    const tokenId = randomUUID();
    await prisma.userAccount.create({
      data: {
        id: userId,
        name: "Route Boundary",
        email: `${userId}@example.test`,
        normalizedEmail: `${userId}@example.test`,
        emailVerified: true,
        state: "ACTIVE",
        twoFactorEnabled: true,
        securityTokens: {
          create: {
            id: tokenId,
            purpose: "ACCOUNT_RECOVERY_CONFIRMATION",
            status: "ACTIVE",
            tokenDigest: protector.digest(proof),
            expiresAt: new Date(Date.now() + 30 * 60 * 1000),
            createdByRequestId: randomUUID(),
          },
        },
      },
    });
    try {
      const response = await confirmRecovery(
        request("/api/identity/account-recovery/confirm", {}),
      );
      expect(response.status).toBe(403);
      expect(
        await prisma.securityToken.findUniqueOrThrow({
          where: { id: tokenId },
          select: { status: true, consumedAt: true },
        }),
      ).toEqual({ status: "ACTIVE", consumedAt: null });
      expect(
        await prisma.fullAccountRecoveryOperation.count({
          where: { userId },
        }),
      ).toBe(0);
    } finally {
      await prisma.userAccount.delete({ where: { id: userId } });
    }
  });

  it("rejects malformed and cross-origin capability exchanges", async () => {
    const malformed = await authorizeRecovery(
      request("/api/identity/account-recovery/capability", {
        kind: "confirmation",
        proof: "short",
      }),
    );
    const crossOrigin = await authorizeRecovery(
      request(
        "/api/identity/account-recovery/capability",
        {
          kind: "confirmation",
          proof: "x".repeat(40),
        },
        "https://attacker.example",
      ),
    );
    expect(malformed.status).toBe(400);
    expect(crossOrigin.status).toBe(403);
  });

  it("never echoes invalid confirmation, cancellation, or completion proofs", async () => {
    const proof = "raw-proof-must-not-be-returned".padEnd(40, "x");
    const responses = [
      await confirmRecovery(
        request(
          "/api/identity/account-recovery/confirm",
          {},
          undefined,
          capabilityCookie("confirmation", proof),
        ),
      ),
      await cancelRecovery(
        request(
          "/api/identity/account-recovery/cancel",
          {},
          undefined,
          capabilityCookie("cancellation", proof),
        ),
      ),
      await completeRecovery(
        request(
          "/api/identity/account-recovery/complete",
          {
            newPassword: "new recovery password 2026!",
            confirmPassword: "new recovery password 2026!",
          },
          undefined,
          capabilityCookie("completion", proof),
        ),
      ),
    ];
    for (const response of responses) {
      const body = await response.text();
      expect([400, 503]).toContain(response.status);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(body).not.toContain(proof);
    }
  });
});
