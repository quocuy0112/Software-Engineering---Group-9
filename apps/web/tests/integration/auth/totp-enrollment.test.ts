import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { auth } from "@/server/auth/config";
import { symmetricDecrypt } from "better-auth/crypto";
import { prisma } from "@/lib/db/prisma";
import { serverEnvironment } from "@/lib/env/runtime";
import { TokenProtector } from "@/lib/security/security-tokens";
import { csrfProof } from "@/lib/security/csrf-proof";
import { BetterAuthGateway } from "@/server/auth/identity/better-auth-gateway";
import { BetterAuthSessionGateway } from "@/server/auth/identity/better-auth-session-gateway";
import { PrismaRegistrationRepository } from "@/server/repositories/identity/prisma-registration-repository";
import { POST as startEnrollment } from "@/app/api/identity/two-factor/enrollment/route";
import { POST as verifyEnrollment } from "@/app/api/identity/two-factor/enrollment/verify/route";

const password = "Enrollment Passphrase 2026!";
const createdEmails = new Set<string>();

// A unique client IP per request keeps each test in its own rate-limit bucket,
// so ordering within the full suite never throttles a later assertion.
function uniqueClientIp() {
  return `203.0.113.${Math.floor(Math.random() * 254) + 1}:${randomUUID()}`;
}

function requestHeaders(cookie: string, extra: Record<string, string> = {}) {
  return new Headers({
    origin: "http://localhost:3001",
    "sec-fetch-site": "same-origin",
    "content-type": "application/json",
    "user-agent": "vitest",
    "x-forwarded-for": uniqueClientIp(),
    cookie,
    ...extra,
  });
}

async function activeAccount() {
  const id = randomUUID();
  const email = `enroll-${id}@example.test`;
  const protector = new TokenProtector();
  await new PrismaRegistrationRepository().create({
    name: "Enrollment User",
    email,
    normalizedEmail: email,
    credentialPassword:
      await new BetterAuthGateway().preparePasswordForCredential(password),
    tokenDigest: protector.digest(protector.generate()),
    protectedToken: protector.seal(protector.generate()),
    expiresAt: new Date(Date.now() + 86400000),
    correlationId: id,
  });
  await prisma.userAccount.update({
    where: { normalizedEmail: email },
    data: { state: "ACTIVE", emailVerified: true },
  });
  createdEmails.add(email);
  return email;
}

async function signIn(email: string) {
  const response = await new BetterAuthSessionGateway().signIn(
    email,
    password,
    new Headers({
      origin: "http://localhost:3001",
      "sec-fetch-site": "same-origin",
      "user-agent": "vitest",
    }),
  );
  const cookie = response.headers
    .getSetCookie()
    .find((value) => value.startsWith("smarthire.session="));
  const pair = cookie?.split(";", 1)[0];
  expect(pair).toBeTruthy();
  const sessionId = (
    await auth.api.getSession({ headers: requestHeaders(pair as string) })
  )?.session.id;
  expect(sessionId).toBeTruthy();
  return { cookie: pair as string, sessionId: sessionId as string };
}

function startRequest(cookie: string, proof: string, body: unknown) {
  return new Request(
    "http://localhost:3001/api/identity/two-factor/enrollment",
    {
      method: "POST",
      headers: requestHeaders(cookie, { "x-csrf-token": proof }),
      body: JSON.stringify(body),
    },
  );
}

function verifyRequest(cookie: string, proof: string, body: unknown) {
  return new Request(
    "http://localhost:3001/api/identity/two-factor/enrollment/verify",
    {
      method: "POST",
      headers: requestHeaders(cookie, { "x-csrf-token": proof }),
      body: JSON.stringify(body),
    },
  );
}

async function currentTotpCode(userId: string) {
  const stored = await prisma.twoFactor.findFirstOrThrow({ where: { userId } });
  const decryptedSecret = await symmetricDecrypt({
    key: serverEnvironment.BETTER_AUTH_SECRET,
    data: stored.secret,
  });
  const { code } = await auth.api.generateTOTP({
    body: { secret: decryptedSecret },
  });
  return code;
}

afterEach(async () => {
  for (const email of createdEmails) {
    const user = await prisma.userAccount.findUnique({
      where: { normalizedEmail: email },
    });
    if (user) {
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await prisma.twoFactor.deleteMany({ where: { userId: user.id } });
      await prisma.authProviderAccount.deleteMany({
        where: { userId: user.id },
      });
      await prisma.candidateIdentity.deleteMany({ where: { userId: user.id } });
      await prisma.userAccount.delete({ where: { id: user.id } });
    }
  }
  createdEmails.clear();
});

describe("TOTP enrollment route handlers (real Better Auth + qrcode)", () => {
  it("runs the full enrollment flow and returns exactly ten backup codes once with no-store headers", async () => {
    const email = await activeAccount();
    const { cookie, sessionId } = await signIn(email);
    const proof = csrfProof(sessionId);

    const started = await startEnrollment(
      startRequest(cookie, proof, { currentPassword: password }),
    );
    expect(started.status, await started.clone().text()).toBe(200);
    expect(started.headers.get("Cache-Control")).toContain("no-store");
    const setup = (await started.json()) as {
      qrCodeDataUrl: string;
      manualKey: string;
      issuer: string;
      accountLabel: string;
    };
    expect(setup.qrCodeDataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(setup.manualKey.length).toBeGreaterThan(0);
    expect(setup.issuer).toBe("SmartHire");
    // The response must not leak the raw otpauth URI or secret in any string field.
    expect(JSON.stringify(setup)).not.toContain("otpauth://");

    const userId = (
      await prisma.userAccount.findUniqueOrThrow({
        where: { normalizedEmail: email },
      })
    ).id;
    const code = await currentTotpCode(userId);

    const verified = await verifyEnrollment(
      verifyRequest(cookie, proof, { code }),
    );
    expect(verified.status, await verified.clone().text()).toBe(200);
    expect(verified.headers.get("Cache-Control")).toContain("no-store");
    const body = (await verified.json()) as { backupCodes: string[] };
    expect(body.backupCodes).toHaveLength(10);
    expect(new Set(body.backupCodes).size).toBe(10);
    expect(
      (await prisma.userAccount.findUniqueOrThrow({ where: { id: userId } }))
        .twoFactorEnabled,
    ).toBe(true);
    expect(
      (await prisma.twoFactor.findUniqueOrThrow({ where: { userId } }))
        .verified,
    ).toBe(true);
  });

  it("rejects an invalid initial TOTP code without enabling 2FA", async () => {
    const email = await activeAccount();
    const { cookie, sessionId } = await signIn(email);
    const proof = csrfProof(sessionId);

    const started = await startEnrollment(
      startRequest(cookie, proof, { currentPassword: password }),
    );
    expect(started.status).toBe(200);

    const verified = await verifyEnrollment(
      verifyRequest(cookie, proof, { code: "000000" }),
    );
    expect(verified.status).toBe(401);
    const userId = (
      await prisma.userAccount.findUniqueOrThrow({
        where: { normalizedEmail: email },
      })
    ).id;
    expect(
      (await prisma.userAccount.findUniqueOrThrow({ where: { id: userId } }))
        .twoFactorEnabled,
    ).toBe(false);
  });

  it("limits enrollment verification to five account-bound attempts", async () => {
    const email = await activeAccount();
    const { cookie, sessionId } = await signIn(email);
    const proof = csrfProof(sessionId);

    const started = await startEnrollment(
      startRequest(cookie, proof, { currentPassword: password }),
    );
    expect(started.status).toBe(200);

    const responses: Response[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1)
      responses.push(
        await verifyEnrollment(
          verifyRequest(cookie, proof, { code: "000000" }),
        ),
      );

    expect(responses.slice(0, 5).every(({ status }) => status === 401)).toBe(
      true,
    );
    expect(responses[5]?.status).toBe(429);
    expect(responses[5]?.headers.get("Retry-After")).toMatch(/^\d+$/);
    expect(await responses[5]?.json()).toEqual({
      message: "That code could not be verified.",
    });
  });

  it("rejects enrollment start with a wrong current password", async () => {
    const email = await activeAccount();
    const { cookie, sessionId } = await signIn(email);
    const proof = csrfProof(sessionId);

    const started = await startEnrollment(
      startRequest(cookie, proof, { currentPassword: "wrong password" }),
    );
    expect(started.status).toBe(401);
    expect(
      await prisma.twoFactor.count({
        where: { user: { normalizedEmail: email } },
      }),
    ).toBe(0);
  });

  it("rejects a request that fails CSRF proof", async () => {
    const email = await activeAccount();
    const { cookie } = await signIn(email);

    const started = await startEnrollment(
      startRequest(cookie, "invalid-proof", { currentPassword: password }),
    );
    expect(started.status).toBe(403);
    expect(started.headers.get("Cache-Control")).toContain("no-store");
  });

  it("rejects an unauthenticated request", async () => {
    const started = await startEnrollment(
      new Request("http://localhost:3001/api/identity/two-factor/enrollment", {
        method: "POST",
        headers: new Headers({
          origin: "http://localhost:3001",
          "sec-fetch-site": "same-origin",
          "content-type": "application/json",
        }),
        body: JSON.stringify({ currentPassword: password }),
      }),
    );
    expect(started.status).toBe(401);
  });

  it("rejects enrollment for an inactive account", async () => {
    const email = await activeAccount();
    const { cookie, sessionId } = await signIn(email);
    const proof = csrfProof(sessionId);
    // Suspend after sign-in; the session guard must now deny sensitive actions.
    await prisma.userAccount.update({
      where: { normalizedEmail: email },
      data: { state: "SUSPENDED" },
    });

    const started = await startEnrollment(
      startRequest(cookie, proof, { currentPassword: password }),
    );
    expect(started.status).toBe(401);
  });
});
