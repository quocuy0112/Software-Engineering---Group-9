import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { auth } from "@/server/auth/config";
import { prisma } from "@/lib/db/prisma";
import { TokenProtector } from "@/lib/security/security-tokens";
import { PrismaPasswordResetRepository } from "@/server/repositories/identity/prisma-password-reset-repository";
import { ResetPasswordService } from "@/server/services/identity/reset-password";
import { LoginWithPasswordService } from "@/server/services/identity/login-with-password";
import {
  authRequest,
  cleanupFixture,
  cookie,
  enabledFixture,
} from "../auth/backup-code-fixture";

const protector = new TokenProtector();
const replacementPassword = "Preserved factors password 2026!";
const users: string[] = [];

afterEach(async () => {
  for (const userId of users) await cleanupFixture(userId);
  users.length = 0;
});

async function issue(email: string, rawToken: string, now: Date) {
  await new PrismaPasswordResetRepository().replaceForActiveUser({
    normalizedEmail: email,
    rawToken,
    protectedToken: protector.seal(rawToken),
    correlationId: randomUUID(),
    now,
  });
}

async function preAuthWithPassword(email: string, password: string) {
  const response = await authRequest("/sign-in/email", { email, password });
  return {
    response,
    preAuth: cookie(response, "smarthire.pre-auth"),
    session: cookie(response, "smarthire.session"),
  };
}

describe("password reset preservation saga", () => {
  it("preserves Better Auth TOTP and unused backup codes while revoking every old session and challenge", async () => {
    const fixture = await enabledFixture();
    users.push(fixture.userId);
    const beforeFactor = await prisma.twoFactor.findUniqueOrThrow({
      where: { userId: fixture.userId },
    });
    const extraLogin = await preAuthWithPassword(
      fixture.email,
      "Backup Code Fixture 2026!",
    );
    expect(extraLogin.preAuth).not.toBeNull();
    expect(
      await prisma.session.count({ where: { userId: fixture.userId } }),
    ).toBeGreaterThan(0);
    await prisma.authenticationChallenge.createMany({
      data: [
        {
          userId: fixture.userId,
          handleDigest: `reset-challenge-${randomUUID()}`,
          purpose: "PASSWORD_LOGIN_2FA",
          expiresAt: new Date(Date.now() + 300_000),
        },
        {
          userId: fixture.userId,
          handleDigest: `recent-challenge-${randomUUID()}`,
          purpose: "RECENT_AUTH",
          expiresAt: new Date(Date.now() + 300_000),
        },
      ],
    });

    const rawToken = protector.generate();
    const now = new Date();
    await issue(fixture.email, rawToken, now);
    const result = await new ResetPasswordService().execute(
      rawToken,
      replacementPassword,
      new Date(now.getTime() + 1),
    );
    expect(result).toMatchObject({ ok: true, userId: fixture.userId });

    expect(
      await prisma.session.count({ where: { userId: fixture.userId } }),
    ).toBe(0);
    expect(
      await prisma.authenticationChallenge.count({
        where: { userId: fixture.userId },
      }),
    ).toBe(0);
    const account = await prisma.userAccount.findUniqueOrThrow({
      where: { id: fixture.userId },
      select: { twoFactorEnabled: true },
    });
    expect(account.twoFactorEnabled).toBe(true);
    const afterFactor = await prisma.twoFactor.findUniqueOrThrow({
      where: { userId: fixture.userId },
    });
    expect(afterFactor).toEqual(beforeFactor);
    expect(
      await prisma.emailOutbox.count({
        where: { userId: fixture.userId, kind: "PASSWORD_CHANGED" },
      }),
    ).toBe(1);
    const operation = await prisma.passwordResetOperation.findFirstOrThrow({
      where: { userId: fixture.userId },
    });
    expect(operation).toMatchObject({
      status: "FINALIZED",
      failureCode: null,
      executionOwner: null,
    });
    expect(operation.passwordUpdatedAt).not.toBeNull();
    expect(operation.sessionsRevokedAt).not.toBeNull();
    expect(operation.challengesInvalidatedAt).not.toBeNull();
    expect(operation.notificationEnqueuedAt).not.toBeNull();
    expect(operation.auditFinalizedAt).not.toBeNull();
    expect(operation.finalizedAt).not.toBeNull();
    expect(
      await prisma.auditEvent.count({
        where: { id: { in: [operation.auditIntentKey, operation.finalAuditId!] } },
      }),
    ).toBe(2);
    const persistedEvidence = JSON.stringify({
      operation,
      audits: await prisma.auditEvent.findMany({
        where: {
          id: { in: [operation.auditIntentKey, operation.finalAuditId!] },
        },
      }),
    });
    for (const secret of [
      rawToken,
      replacementPassword,
      fixture.secret,
      ...fixture.backupCodes,
      fixture.session,
    ]) {
      expect(persistedEvidence).not.toContain(secret);
    }

    await expect(
      new ResetPasswordService().execute(
        rawToken,
        replacementPassword,
        new Date(now.getTime() + 2),
      ),
    ).resolves.toMatchObject({ ok: false, retryable: false });
    expect(
      await prisma.emailOutbox.count({
        where: { userId: fixture.userId, kind: "PASSWORD_CHANGED" },
      }),
    ).toBe(1);

    const oldPassword = await preAuthWithPassword(
      fixture.email,
      "Backup Code Fixture 2026!",
    );
    expect(oldPassword.response.ok).toBe(false);
    const smartHireLogin = await new LoginWithPasswordService().execute(
      { email: fixture.email, password: replacementPassword },
      {
        headers: new Headers({
          origin: "http://localhost:3001",
          "sec-fetch-site": "same-origin",
        }),
        subject: `reset-preservation:${randomUUID()}`,
      },
    );
    expect(await smartHireLogin.json()).toMatchObject({
      requiresTwoFactor: true,
    });
    expect(
      smartHireLogin.headers
        .getSetCookie()
        .some((value) => /^smarthire\.session=/.test(value)),
    ).toBe(false);
    expect(
      smartHireLogin.headers
        .getSetCookie()
        .some((value) => /^smarthire\.pre-auth=/.test(value)),
    ).toBe(true);
    const totpLogin = await preAuthWithPassword(
      fixture.email,
      replacementPassword,
    );
    expect(totpLogin.response.ok).toBe(true);
    expect(totpLogin.preAuth).not.toBeNull();

    const totp = await auth.api.generateTOTP({
      body: { secret: fixture.secret },
    });
    const totpCompletion = await authRequest(
      "/two-factor/verify-totp",
      { code: totp.code, trustDevice: false },
      totpLogin.preAuth!,
    );
    expect(totpCompletion.ok).toBe(true);
    expect(cookie(totpCompletion, "smarthire.session")).not.toBeNull();

    const backupLogin = await preAuthWithPassword(
      fixture.email,
      replacementPassword,
    );
    const backupCompletion = await authRequest(
      "/two-factor/verify-backup-code",
      { code: fixture.backupCodes[0], trustDevice: false },
      backupLogin.preAuth!,
    );
    expect(backupCompletion.ok).toBe(true);
    expect(cookie(backupCompletion, "smarthire.session")).not.toBeNull();
  }, 60_000);
});
