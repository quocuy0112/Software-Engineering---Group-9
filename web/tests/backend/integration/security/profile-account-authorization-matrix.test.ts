import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auth } from "@/backend/auth/cookies/config";
import { BetterAuthPasswordGateway } from "@/backend/auth/better-auth/better-auth-password-gateway";
import { prisma } from "@/backend/database/prisma";
import { csrfProof } from "@/backend/security/csrf/csrf-proof";
import {
  GET as getProfile,
  PATCH as patchProfile,
} from "@/app/api/account/profile/route";
import { GET as getIdentity } from "@/app/api/account/identity/route";
import {
  GET as getPreferences,
  PUT as putPreferences,
} from "@/app/api/account/preferences/route";
import { POST as verifyEmailChange } from "@/app/api/account/email-change/verify/route";
import { DELETE as deleteSession } from "@/app/api/identity/sessions/[sessionReference]/route";
import { createCredentialFixture } from "../../../helpers/credential-fixture";
import { cleanupFixture } from "../auth/backup-code-fixture";

const origin = "http://localhost:3001";
const password = "Authorization matrix 2026!";
type Account = {
  id: string;
  email: string;
  cookie: string;
  sessionId: string;
  profileId: string;
};
let accountA: Account;
let accountB: Account;

function cookieFrom(response: Response) {
  return (
    response.headers
      .getSetCookie()
      .find((value) => value.startsWith("smarthire.session="))
      ?.split(";", 1)[0] ?? ""
  );
}

function requestHeaders(
  account: Account,
  options: { csrf?: boolean; requestOrigin?: string } = {},
) {
  const headers = new Headers({
    cookie: account.cookie,
    origin: options.requestOrigin ?? origin,
    "sec-fetch-site": "same-origin",
    "content-type": "application/json",
  });
  if (options.csrf) {
    headers.set("x-csrf-token", csrfProof(account.sessionId));
  }
  return headers;
}

async function createAccount(label: string): Promise<Account> {
  const suffix = randomUUID();
  const email = `authorization-${label}-${suffix}@example.test`;
  const user = await createCredentialFixture({
    name: `Authorization ${label}`,
    email,
    password,
  });
  const identity = await prisma.candidateIdentity.create({
    data: { userId: user.id, profile: { create: {} } },
    include: { profile: true },
  });
  const login = await auth.handler(
    new Request(`${origin}/api/auth/sign-in/email`, {
      method: "POST",
      headers: new Headers({
        origin,
        "sec-fetch-site": "same-origin",
        "content-type": "application/json",
      }),
      body: JSON.stringify({ email, password }),
    }),
  );
  const cookie = cookieFrom(login);
  const current = await new BetterAuthPasswordGateway().authoritativeSession(
    new Headers({ cookie }),
  );
  if (!cookie || !current || !identity.profile) {
    throw new Error("AUTHORIZATION_FIXTURE_FAILED");
  }
  return {
    id: user.id,
    email,
    cookie,
    sessionId: current.sessionId,
    profileId: identity.profile.id,
  };
}

beforeAll(async () => {
  accountA = await createAccount("a");
  accountB = await createAccount("b");
  const pendingEmail = `pending-${randomUUID()}@example.test`;
  const requestCreatedAt = new Date();
  await prisma.emailChangeRequest.create({
    data: {
      userId: accountA.id,
      proposedEmail: pendingEmail,
      normalizedProposedEmail: pendingEmail,
      tokenDigest: randomUUID().replaceAll("-", ""),
      createdAt: requestCreatedAt,
      expiresAt: new Date(requestCreatedAt.getTime() + 30 * 60_000),
      idempotencyKey: `pending_${randomUUID().replaceAll("-", "_")}`,
      correlationId: randomUUID(),
      createdBySessionId: accountA.sessionId,
    },
  });
});

afterAll(async () => {
  for (const account of [accountA, accountB]) {
    if (!account?.id) continue;
    await prisma.passwordChangeOperation.deleteMany({
      where: { userId: account.id },
    });
    await prisma.passwordChangeAttemptWindow.deleteMany({
      where: { userId: account.id },
    });
    await cleanupFixture(account.id);
  }
});

describe("Feature 002 two-account authorization matrix", () => {
  it("returns only each owner's profile, identity, preferences, and pending projection", async () => {
    const profileA = await getProfile(
      new Request(`${origin}/api/account/profile`, {
        headers: requestHeaders(accountA),
      }),
    );
    const profileB = await getProfile(
      new Request(`${origin}/api/account/profile`, {
        headers: requestHeaders(accountB),
      }),
    );
    expect(profileA.status).toBe(200);
    expect(profileB.status).toBe(200);
    expect(await profileA.json()).toMatchObject({
      basics: { summary: null },
      skills: [],
      experience: [],
      education: [],
    });
    expect(await profileB.json()).toMatchObject({
      basics: { summary: null },
      skills: [],
      experience: [],
      education: [],
    });

    const identityA = await getIdentity(
      new Request(`${origin}/api/account/identity`, {
        headers: requestHeaders(accountA),
      }),
    );
    const identityB = await getIdentity(
      new Request(`${origin}/api/account/identity`, {
        headers: requestHeaders(accountB),
      }),
    );
    const bodyA = await identityA.json();
    const bodyB = await identityB.json();
    expect(bodyA.email).toBe(accountA.email);
    expect(bodyA.pendingEmailChange).toMatchObject({
      proposedEmail: expect.any(String),
    });
    expect(bodyB.email).toBe(accountB.email);
    expect(bodyB.pendingEmailChange).toBeNull();
    expect(JSON.stringify(bodyB)).not.toContain(
      bodyA.pendingEmailChange.proposedEmail,
    );

    const preferencesB = await getPreferences(
      new Request(`${origin}/api/account/preferences`, {
        headers: requestHeaders(accountB),
      }),
    );
    expect(await preferencesB.json()).toMatchObject({
      language: "vi",
      timezone: "Asia/Ho_Chi_Minh",
    });
  });

  it("rejects foreign profile children without disclosing or mutating them", async () => {
    const experience = await prisma.profileExperience.create({
      data: {
        profileId: accountA.profileId,
        title: "Owner A title",
        company: "Owner A company",
        startDate: new Date("2024-01-01T00:00:00.000Z"),
        isCurrent: true,
        position: 0,
      },
    });
    const response = await patchProfile(
      new Request(`${origin}/api/account/profile`, {
        method: "PATCH",
        headers: requestHeaders(accountB, { csrf: true }),
        body: JSON.stringify({
          section: "experience",
          baseRevision: 0,
          experience: [
            {
              id: experience.id,
              title: "Forged update",
              company: "Foreign",
              description: null,
              startDate: "2024-01-01",
              endDate: null,
              current: true,
            },
          ],
        }),
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "PROFILE_ITEM_NOT_OWNED",
    });
    expect(
      await prisma.profileExperience.findUniqueOrThrow({
        where: { id: experience.id },
      }),
    ).toMatchObject({ title: "Owner A title" });
  });

  it("rejects forged IDs, missing CSRF, and cross-origin preference mutation", async () => {
    const body = {
      language: "en",
      timezone: "UTC",
      emailNotifications: {
        application_updates: false,
        job_recommendations: false,
        account_security: true,
      },
    };
    const forged = await putPreferences(
      new Request(`${origin}/api/account/preferences`, {
        method: "PUT",
        headers: requestHeaders(accountB, { csrf: true }),
        body: JSON.stringify({ ...body, userId: accountA.id }),
      }),
    );
    expect(forged.status).toBe(400);
    const missingCsrf = await putPreferences(
      new Request(`${origin}/api/account/preferences`, {
        method: "PUT",
        headers: requestHeaders(accountB),
        body: JSON.stringify(body),
      }),
    );
    expect(missingCsrf.status).toBe(403);
    const crossOrigin = await putPreferences(
      new Request(`${origin}/api/account/preferences`, {
        method: "PUT",
        headers: requestHeaders(accountB, {
          csrf: true,
          requestOrigin: "https://attacker.example",
        }),
        body: JSON.stringify(body),
      }),
    );
    expect(crossOrigin.status).toBe(403);
    expect(
      await prisma.accountPreferences.count({
        where: { userId: accountB.id },
      }),
    ).toBe(0);
  });

  it("cannot revoke another account session by reference", async () => {
    const response = await deleteSession(
      new Request(`${origin}/api/identity/sessions/${accountA.sessionId}`, {
        method: "DELETE",
        headers: requestHeaders(accountB, { csrf: true }),
      }),
      {
        params: Promise.resolve({ sessionReference: accountA.sessionId }),
      },
    );
    expect(response.status).toBe(200);
    expect(
      await prisma.session.findUnique({
        where: { id: accountA.sessionId },
      }),
    ).not.toBeNull();
  });

  it("rejects owner selection in proof bodies and invalidates inactive/expired sessions", async () => {
    const proofResponse = await verifyEmailChange(
      new Request(`${origin}/api/account/email-change/verify`, {
        method: "POST",
        headers: new Headers({
          origin,
          "sec-fetch-site": "same-origin",
          "content-type": "application/json",
        }),
        body: JSON.stringify({
          proof: "x".repeat(43),
          userId: accountB.id,
        }),
      }),
    );
    expect(proofResponse.status).toBe(400);

    await prisma.userAccount.update({
      where: { id: accountB.id },
      data: { state: "SUSPENDED", stateChangedAt: new Date() },
    });
    const inactive = await getIdentity(
      new Request(`${origin}/api/account/identity`, {
        headers: requestHeaders(accountB),
      }),
    );
    expect(inactive.status).toBe(401);

    const now = Date.now();
    await prisma.session.updateMany({
      where: { id: accountA.sessionId },
      data: {
        createdAt: new Date(now - 2 * 60 * 60_000),
        expiresAt: new Date(now - 60 * 60_000),
        absoluteExpiresAt: new Date(now - 30 * 60_000),
      },
    });
    const expired = await getProfile(
      new Request(`${origin}/api/account/profile`, {
        headers: requestHeaders(accountA),
      }),
    );
    expect(expired.status).toBe(401);
  });
});
