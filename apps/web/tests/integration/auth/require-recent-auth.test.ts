import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { TokenProtector } from "@/lib/security/security-tokens";
import { BetterAuthGateway } from "@/server/auth/identity/better-auth-gateway";
import { BetterAuthSessionGateway } from "@/server/auth/identity/better-auth-session-gateway";
import { PrismaRegistrationRepository } from "@/server/repositories/identity/prisma-registration-repository";
import {
  RECENT_AUTH_WINDOW_MS,
  RequireRecentAuthService,
} from "@/server/services/identity/require-recent-auth";

const password = "Recent Auth Passphrase 2026!";
const createdEmails = new Set<string>();

function sameOriginHeaders(extra: Record<string, string> = {}) {
  return new Headers({
    origin: "http://localhost:3000",
    "sec-fetch-site": "same-origin",
    "user-agent": "vitest",
    ...extra,
  });
}

async function activeAccount() {
  const id = randomUUID();
  const email = `recent-${id}@example.test`;
  const protector = new TokenProtector();
  await new PrismaRegistrationRepository().create({
    name: "Recent Auth User",
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

async function signInCookie(email: string) {
  const response = await new BetterAuthSessionGateway().signIn(
    email,
    password,
    sameOriginHeaders(),
  );
  const cookie = response.headers
    .getSetCookie()
    .find((value) => value.startsWith("smarthire.session="));
  const pair = cookie?.split(";", 1)[0];
  expect(pair).toBeTruthy();
  return pair as string;
}

afterEach(async () => {
  for (const email of createdEmails) {
    const user = await prisma.userAccount.findUnique({
      where: { normalizedEmail: email },
    });
    if (user) {
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await prisma.authProviderAccount.deleteMany({
        where: { userId: user.id },
      });
      await prisma.candidateIdentity.deleteMany({ where: { userId: user.id } });
      await prisma.userAccount.delete({ where: { id: user.id } });
    }
  }
  createdEmails.clear();
});

describe("RequireRecentAuthService", () => {
  it("grants when the session is recent and the current password verifies", async () => {
    const email = await activeAccount();
    const cookie = await signInCookie(email);
    const result = await new RequireRecentAuthService().execute(password, {
      headers: sameOriginHeaders({ cookie }),
      subject: randomUUID(),
    });
    expect(result.ok).toBe(true);
  });

  it("denies with a generic 401 when no session is present", async () => {
    const result = await new RequireRecentAuthService().execute(password, {
      headers: sameOriginHeaders(),
      subject: randomUUID(),
    });
    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  it("denies when the current password is wrong without revealing the reason", async () => {
    const email = await activeAccount();
    const cookie = await signInCookie(email);
    const result = await new RequireRecentAuthService().execute(
      "wrong password",
      {
        headers: sameOriginHeaders({ cookie }),
        subject: randomUUID(),
      },
    );
    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  it("denies when authentication is older than the ten-minute window", async () => {
    const email = await activeAccount();
    const cookie = await signInCookie(email);
    const stale = new Date(Date.now() + RECENT_AUTH_WINDOW_MS + 60_000);
    const result = await new RequireRecentAuthService().execute(password, {
      headers: sameOriginHeaders({ cookie }),
      subject: randomUUID(),
      now: stale,
    });
    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  it("denies when the owning account is no longer ACTIVE", async () => {
    const email = await activeAccount();
    const cookie = await signInCookie(email);
    await prisma.userAccount.update({
      where: { normalizedEmail: email },
      data: { state: "SUSPENDED" },
    });
    const result = await new RequireRecentAuthService().execute(password, {
      headers: sameOriginHeaders({ cookie }),
      subject: randomUUID(),
    });
    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  it("throttles after the enrollment rate limit is exhausted", async () => {
    const subject = randomUUID();
    const service = new RequireRecentAuthService();
    let throttled: Awaited<ReturnType<typeof service.execute>> | null = null;
    for (let attempt = 0; attempt < 7; attempt += 1) {
      const outcome = await service.execute("wrong password", {
        headers: sameOriginHeaders(),
        subject,
      });
      if (!outcome.ok && outcome.status === 429) {
        throttled = outcome;
        break;
      }
    }
    expect(throttled).toMatchObject({ ok: false, status: 429 });
    expect(
      (throttled as { retryAfterSeconds: number }).retryAfterSeconds,
    ).toBeGreaterThan(0);
  });
});
