import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { TokenProtector } from "@/lib/security/security-tokens";
import { BetterAuthGateway } from "@/server/auth/identity/better-auth-gateway";
import { BetterAuthSessionGateway } from "@/server/auth/identity/better-auth-session-gateway";
import { PrismaRegistrationRepository } from "@/server/repositories/identity/prisma-registration-repository";
import { PrismaPasswordResetRepository } from "@/server/repositories/identity/prisma-password-reset-repository";
import { ResetPasswordService } from "@/server/services/identity/reset-password";

const createdUserIds: string[] = [];
const protector = new TokenProtector();

async function activeUser() {
  const id = randomUUID();
  const email = `reset-service-${id}@example.test`;
  const password = "correct horse 2026";
  const made = await new PrismaRegistrationRepository().create({
    name: "Reset Service User",
    email,
    normalizedEmail: email,
    credentialPassword: await new BetterAuthGateway().preparePasswordForCredential(password),
    tokenDigest: protector.digest(protector.generate()),
    protectedToken: protector.seal(protector.generate()),
    expiresAt: new Date(Date.now() + 86_400_000),
    correlationId: id,
  });
  createdUserIds.push(made.userId);
  await prisma.userAccount.update({ where: { id: made.userId }, data: { state: "ACTIVE", emailVerified: true } });
  return { email, password, userId: made.userId };
}

afterAll(async () => {
  await prisma.emailOutbox.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.securityToken.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.session.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.authProviderAccount.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.candidateIdentity.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.userAccount.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("password reset service", () => {
  it("uses Better Auth hashing, changes the credential once, and rejects token reuse", async () => {
    const user = await activeUser();
    const raw = protector.generate();
    const now = new Date();
    await new PrismaPasswordResetRepository().replaceForActiveUser({ normalizedEmail: user.email, rawToken: raw, protectedToken: protector.seal(raw), correlationId: randomUUID(), now });
    const newPassword = "new correct horse 2026";
    const sessionHeaders = new Headers({ origin: "http://localhost:3001", "sec-fetch-site": "same-origin" });
    await new BetterAuthSessionGateway().signIn(user.email, user.password, sessionHeaders);
    await prisma.authenticationChallenge.create({ data: { userId: user.userId, handleDigest: `reset-challenge-${randomUUID()}`, purpose: "PASSWORD_LOGIN_2FA", expiresAt: new Date(Date.now() + 300000) } });
    await prisma.userAccount.update({
      where: { id: user.userId },
      data: { twoFactorEnabled: true },
    });
    await prisma.twoFactor.create({
      data: { id: randomUUID(), userId: user.userId, secret: "encrypted-secret", backupCodes: "encrypted-backup-codes", verified: true },
    });
    await expect(new ResetPasswordService().execute(raw, newPassword, new Date(now.getTime() + 1))).resolves.toMatchObject({ ok: true, userId: user.userId });
    expect(await prisma.session.count({ where: { userId: user.userId } })).toBe(0);
    expect(await prisma.authenticationChallenge.count({ where: { userId: user.userId } })).toBe(0);
    const resetAccount = await prisma.userAccount.findUniqueOrThrow({
      where: { id: user.userId },
      select: { twoFactorEnabled: true },
    });
    expect(resetAccount.twoFactorEnabled).toBe(false);
    expect(await prisma.twoFactor.findUnique({ where: { userId: user.userId } })).toBeNull();
    const notification = await prisma.emailOutbox.findMany({ where: { userId: user.userId, kind: "PASSWORD_CHANGED" } });
    expect(notification).toHaveLength(1);
    expect(notification[0].idempotencyKey).toMatch(/^password-changed:/);
    expect(notification[0].payloadRef).toEqual({});
    expect(await prisma.auditEvent.count({ where: { action: "password_reset.succeeded", targetId: { not: null } } })).toBeGreaterThan(0);
    await expect(new ResetPasswordService().execute(raw, "another correct horse 2026", new Date(now.getTime() + 2))).resolves.toMatchObject({ ok: false });

    const credential = await prisma.authProviderAccount.findFirstOrThrow({ where: { userId: user.userId, providerId: "credential" } });
    expect(credential.password).not.toBe(newPassword);
    const headers = new Headers({ origin: "http://localhost:3001", "sec-fetch-site": "same-origin" });
    expect((await new BetterAuthSessionGateway().signIn(user.email, user.password, headers)).ok).toBe(false);
    expect((await new BetterAuthSessionGateway().signIn(user.email, newPassword, headers)).ok).toBe(true);
  });

  it("rejects an exactly expired token without changing the password", async () => {
    const user = await activeUser();
    const raw = protector.generate();
    const now = new Date();
    await new PrismaPasswordResetRepository().replaceForActiveUser({ normalizedEmail: user.email, rawToken: raw, protectedToken: protector.seal(raw), correlationId: randomUUID(), now });
    await expect(new ResetPasswordService().execute(raw, "new correct horse 2026", new Date(now.getTime() + 30 * 60 * 1000))).resolves.toMatchObject({ ok: false });
    const headers = new Headers({ origin: "http://localhost:3001", "sec-fetch-site": "same-origin" });
    expect((await new BetterAuthSessionGateway().signIn(user.email, user.password, headers)).ok).toBe(true);
  });
});
