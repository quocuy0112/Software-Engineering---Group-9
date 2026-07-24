import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { auth } from "@/server/auth/config";
import { symmetricDecrypt } from "better-auth/crypto";
import { getActiveSession } from "@/server/auth/get-session";
import { prisma } from "@/lib/db/prisma";
import { serverEnvironment } from "@/lib/env/runtime";
import { markInternalBetterAuthRequest } from "@/server/auth/identity/better-auth-internal-request";

const runId = randomUUID();
const email = `compat-${runId}@example.test`;
const password = "Compatibility Passphrase 2026!";
const baseURL = "http://localhost:3001/api/auth";
let authoritativeCookie = "";

async function request(
  path: string,
  options: { body?: unknown; cookie?: string; method?: string } = {},
) {
  const headers = new Headers({ origin: "http://localhost:3001" });
  if (options.body !== undefined)
    headers.set("content-type", "application/json");
  if (options.cookie) headers.set("cookie", options.cookie);
  return auth.handler(
    new Request(`${baseURL}${path}`, {
      method: options.method ?? (options.body === undefined ? "GET" : "POST"),
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    }),
  );
}

function responseCookie(response: Response, name: string): string | null {
  for (const value of response.headers.getSetCookie()) {
    const pair = value.split(";", 1)[0];
    if (pair.startsWith(`${name}=`)) return pair;
  }
  return null;
}

async function signIn() {
  return request("/sign-in/email", { body: { email, password } });
}

afterAll(async () => {
  const user = await prisma.userAccount.findUnique({
    where: { normalizedEmail: email },
  });
  if (user) {
    await prisma.candidateIdentity.deleteMany({ where: { userId: user.id } });
    await prisma.userAccount.delete({ where: { id: user.id } });
  }
  await prisma.$disconnect();
});

describe.sequential("Better Auth 1.6.13 PostgreSQL compatibility", () => {
  it("keeps direct Better Auth throttling while the durable SmartHire gateway owns its login limit", async () => {
    const rule = (await auth.$context).rateLimit.customRules?.[
      "/sign-in/email"
    ];
    expect(typeof rule).toBe("function");
    if (typeof rule !== "function") throw new Error("RATE_LIMIT_RULE_MISSING");
    const currentRule = { window: 10, max: 3 };
    const external = new Request(`${baseURL}/sign-in/email`);
    expect(await rule(external, currentRule)).toEqual(currentRule);
    expect(
      await rule(markInternalBetterAuthRequest(external), currentRule),
    ).toBe(false);
  });

  it("creates Better Auth credential ownership with a non-plaintext password hash", async () => {
    const response = await request("/sign-up/email", {
      body: { name: "Compatibility User", email, password },
    });
    expect(response.status, await response.clone().text()).toBe(200);
    const user = await prisma.userAccount.findUniqueOrThrow({
      where: { normalizedEmail: email },
      include: { accounts: true, sessions: true },
    });
    expect(user.accounts).toHaveLength(1);
    expect(user.accounts[0].providerId).toBe("credential");
    expect(user.accounts[0].password).toBeTruthy();
    expect(user.accounts[0].password).not.toBe(password);
    expect(user.sessions).toHaveLength(0);
  });

  it("rejects Pending Verification sessions through SmartHire state enforcement", async () => {
    const pendingLogin = await signIn();
    expect(pendingLogin.status).not.toBe(200);
    expect(
      await prisma.session.count({
        where: { user: { normalizedEmail: email } },
      }),
    ).toBe(0);
    await prisma.userAccount.update({
      where: { normalizedEmail: email },
      data: { state: "ACTIVE" },
    });
  });

  it("verifies passwords, creates one cookie-backed database session, lists and revokes sessions", async () => {
    const wrong = await request("/sign-in/email", {
      body: { email, password: "incorrect password" },
    });
    expect(wrong.status).toBe(401);
    const first = await signIn();
    expect(first.status).toBe(200);
    const firstCookie = responseCookie(first, "smarthire.session");
    expect(firstCookie).toBeTruthy();
    expect(
      first.headers
        .getSetCookie()
        .filter((value) => value.startsWith("smarthire.session=")),
    ).toHaveLength(1);
    expect(
      first.headers.getSetCookie().some((value) => /jwt/i.test(value)),
    ).toBe(false);
    const tamperedCookie = `${firstCookie!.slice(0, -1)}${firstCookie!.endsWith("A") ? "B" : "A"}`;
    const tampered = await request("/get-session", { cookie: tamperedCookie });
    expect(await tampered.json()).toBeNull();
    const firstToken = (
      await prisma.session.findFirstOrThrow({
        where: { user: { normalizedEmail: email } },
        orderBy: { createdAt: "desc" },
      })
    ).token;
    expect(firstCookie).toContain(firstToken);

    await signIn();
    const secondToken = (
      await prisma.session.findFirstOrThrow({
        where: { user: { normalizedEmail: email }, token: { not: firstToken } },
        orderBy: { createdAt: "desc" },
      })
    ).token;
    const listed = await request("/list-sessions", { cookie: firstCookie! });
    expect(listed.status).toBe(200);
    expect((await listed.json()) as unknown[]).toHaveLength(2);

    const revokeOne = await request("/revoke-session", {
      cookie: firstCookie!,
      body: { token: secondToken },
    });
    expect(revokeOne.status).toBe(200);
    expect(
      await prisma.session.findUnique({ where: { token: secondToken } }),
    ).toBeNull();

    const signOut = await request("/sign-out", {
      cookie: firstCookie!,
      body: {},
    });
    expect(signOut.status).toBe(200);
    expect(
      await prisma.session.findUnique({ where: { token: firstToken } }),
    ).toBeNull();

    const third = await signIn();
    const fourth = await signIn();
    const thirdCookie = responseCookie(third, "smarthire.session")!;
    expect(responseCookie(fourth, "smarthire.session")).toBeTruthy();
    const revokeAll = await request("/revoke-sessions", {
      cookie: thirdCookie,
      body: {},
    });
    expect(revokeAll.status).toBe(200);
    expect(
      await prisma.session.count({
        where: { user: { normalizedEmail: email } },
      }),
    ).toBe(0);
  });

  it("persists encrypted TOTP and backup codes, challenges sign-in, and consumes one backup code atomically", async () => {
    const login = await signIn();
    const sessionCookie = responseCookie(login, "smarthire.session")!;
    const enable = await request("/two-factor/enable", {
      cookie: sessionCookie,
      body: { password },
    });
    expect(enable.status).toBe(200);
    const enrollment = (await enable.json()) as {
      totpURI: string;
      backupCodes: string[];
    };
    expect(enrollment.backupCodes).toHaveLength(10);
    const secret = new URL(enrollment.totpURI).searchParams.get("secret")!;
    const stored = await prisma.twoFactor.findFirstOrThrow({
      where: { user: { normalizedEmail: email } },
    });
    expect(stored.secret).not.toContain(secret);
    expect(stored.backupCodes).not.toContain(enrollment.backupCodes[0]);

    const decryptedSecret = await symmetricDecrypt({
      key: serverEnvironment.BETTER_AUTH_SECRET,
      data: stored.secret,
    });
    expect(decryptedSecret).not.toBe(secret);
    const { code } = await auth.api.generateTOTP({
      body: { secret: decryptedSecret },
    });
    const verifyEnrollment = await request("/two-factor/verify-totp", {
      cookie: sessionCookie,
      body: { code },
    });
    expect(verifyEnrollment.status, await verifyEnrollment.clone().text()).toBe(
      200,
    );
    expect(
      (
        await prisma.twoFactor.findUniqueOrThrow({
          where: { userId: stored.userId },
        })
      ).verified,
    ).toBe(true);
    const enrollmentCookie =
      responseCookie(verifyEnrollment, "smarthire.session") ?? sessionCookie;
    await request("/sign-out", { cookie: enrollmentCookie, body: {} });
    expect(
      await prisma.session.count({ where: { userId: stored.userId } }),
    ).toBe(0);

    const challengeA = await signIn();
    const challengeB = await signIn();
    expect(challengeA.status).toBe(200);
    expect(
      ((await challengeA.json()) as { twoFactorRedirect: boolean })
        .twoFactorRedirect,
    ).toBe(true);
    const preAuthA = responseCookie(challengeA, "smarthire.pre-auth")!;
    const preAuthB = responseCookie(challengeB, "smarthire.pre-auth")!;
    expect(preAuthA).toBeTruthy();
    const challengeSessionHeaders = challengeA.headers
      .getSetCookie()
      .filter((value) => value.startsWith("smarthire.session="));
    expect(challengeSessionHeaders.at(-1)).toMatch(/Max-Age=0/);
    expect(
      await prisma.session.count({ where: { userId: stored.userId } }),
    ).toBe(0);

    const attempts = await Promise.all([
      request("/two-factor/verify-backup-code", {
        cookie: preAuthA,
        body: { code: enrollment.backupCodes[0] },
      }),
      request("/two-factor/verify-backup-code", {
        cookie: preAuthB,
        body: { code: enrollment.backupCodes[0] },
      }),
    ]);
    expect(attempts.filter((response) => response.status === 200)).toHaveLength(
      1,
    );
    expect(attempts.filter((response) => response.status !== 200)).toHaveLength(
      1,
    );
    const authenticated = attempts.find((response) => response.status === 200)!;
    const authenticatedCookie = responseCookie(
      authenticated,
      "smarthire.session",
    )!;
    authoritativeCookie = authenticatedCookie;

    const regenerate = await request("/two-factor/generate-backup-codes", {
      cookie: authenticatedCookie,
      body: { password },
    });
    expect(regenerate.status).toBe(200);
    const replacement = (await regenerate.json()) as { backupCodes: string[] };
    expect(replacement.backupCodes).toHaveLength(10);
    expect(replacement.backupCodes).not.toContain(enrollment.backupCodes[1]);
    const storedReplacement = await prisma.twoFactor.findUniqueOrThrow({
      where: { userId: stored.userId },
    });
    expect(storedReplacement.backupCodes).not.toBe(stored.backupCodes);
    expect(storedReplacement.backupCodes).not.toContain(
      replacement.backupCodes[0],
    );
    const oldCodeChallenge = await signIn();
    const oldCodeCookie = responseCookie(
      oldCodeChallenge,
      "smarthire.pre-auth",
    )!;
    const oldCodeAttempt = await request("/two-factor/verify-backup-code", {
      cookie: oldCodeCookie,
      body: { code: enrollment.backupCodes[1] },
    });
    expect(oldCodeAttempt.status).not.toBe(200);
  });

  it("rejects Suspended and Deleted sessions and has no email OTP implementation", async () => {
    await prisma.userAccount.update({
      where: { normalizedEmail: email },
      data: { state: "SUSPENDED" },
    });
    await expect(
      getActiveSession(new Headers({ cookie: authoritativeCookie })),
    ).resolves.toBeNull();
    await prisma.userAccount.update({
      where: { normalizedEmail: email },
      data: { state: "ACTIVE", twoFactorEnabled: false },
    });
    await prisma.twoFactor.deleteMany({
      where: { user: { normalizedEmail: email } },
    });
    const activeLogin = await signIn();
    const activeCookie = responseCookie(activeLogin, "smarthire.session")!;
    expect(activeCookie).toBeTruthy();
    await prisma.userAccount.update({
      where: { normalizedEmail: email },
      data: { state: "DELETED", deletedAt: new Date() },
    });
    await expect(
      getActiveSession(new Headers({ cookie: activeCookie })),
    ).resolves.toBeNull();
    const emailOtp = await request("/two-factor/send-otp", { body: {} });
    expect(emailOtp.status).not.toBe(200);
  });
});
