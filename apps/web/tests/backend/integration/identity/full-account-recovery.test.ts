import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/backend/database/prisma";
import { TokenProtector } from "@/backend/security/security-token/security-tokens";
import { PrismaAccountRecoveryRepository } from "@/backend/repositories/identity/prisma-account-recovery-repository";
import { RequestFullAccountRecoveryService } from "@/backend/services/recovery/request-full-account-recovery";
import { ConfirmFullAccountRecoveryService } from "@/backend/services/recovery/confirm-full-account-recovery";
import { CancelFullAccountRecoveryService } from "@/backend/services/recovery/cancel-full-account-recovery";
import { CompleteFullAccountRecoveryService } from "@/backend/services/recovery/complete-full-account-recovery";
import { LoginWithPasswordService } from "@/backend/services/identity/login-with-password";
import { getActiveSession } from "@/backend/auth/session/get-session";
import {
  authRequest,
  cleanupFixture,
  cookie,
  enabledFixture,
  preAuth,
  requestHeaders,
} from "../auth/backup-code-fixture";

const protector = new TokenProtector();
const replacementPassword = "Full recovery replacement 2026!";
const users: string[] = [];

afterEach(async () => {
  for (const userId of users) await cleanupFixture(userId);
  users.length = 0;
});

async function issueConfirmation(email: string, now: Date) {
  const proof = protector.generate();
  await new PrismaAccountRecoveryRepository().replaceConfirmationForEligibleUser(
    {
      normalizedEmail: email,
      rawProof: proof,
      protectedProof: protector.seal(proof),
      correlationId: randomUUID(),
      now,
    },
  );
  return proof;
}

async function confirm(proof: string, now: Date) {
  const result = await new ConfirmFullAccountRecoveryService().execute(
    proof,
    now,
  );
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("confirmation failed");
  return prisma.fullAccountRecoveryOperation.findUniqueOrThrow({
    where: { id: result.operationId },
  });
}

function noSessionHeaders() {
  return requestHeaders();
}

describe("full account recovery controlled-clock integration", () => {
  it("distinguishes eligibility, rate-limits, and queues only eligible verified 2FA accounts", async () => {
    const fixture = await enabledFixture();
    users.push(fixture.userId);
    const service = new RequestFullAccountRecoveryService();
    const now = new Date("2026-07-23T00:00:00.000Z");
    const known = await service.execute(fixture.email, now);
    const unknown = await service.execute(
      `unknown-${randomUUID()}@example.test`,
      now,
    );
    expect(known).toMatchObject({ accepted: true, status: 202 });
    expect(unknown).toMatchObject({ accepted: false, status: 404 });
    expect(known.message).not.toBe(unknown.message);
    expect(
      await prisma.emailOutbox.count({
        where: {
          userId: fixture.userId,
          templateVersion: "account-recovery-confirmation.v1",
        },
      }),
    ).toBe(1);

    const throttled = await Promise.all([
      service.execute(fixture.email, new Date(now.getTime() + 1)),
      service.execute(fixture.email, new Date(now.getTime() + 2)),
      service.execute(fixture.email, new Date(now.getTime() + 3)),
    ]);
    expect(throttled.some((result) => result.status === 429)).toBe(true);
    const outbox = await prisma.emailOutbox.findFirstOrThrow({
      where: {
        userId: fixture.userId,
        templateVersion: "account-recovery-confirmation.v1",
      },
    });
    const persisted = JSON.stringify(outbox);
    expect(persisted).not.toContain(fixture.email);
  });

  it("starts one exact 24-hour hold, revokes access, blocks login, and leaves 2FA unchanged", async () => {
    const fixture = await enabledFixture();
    users.push(fixture.userId);
    const stalePreAuth = await preAuth(fixture.email);
    const beforeFactor = await prisma.twoFactor.findUniqueOrThrow({
      where: { userId: fixture.userId },
    });
    const now = new Date("2026-07-23T01:00:00.000Z");
    const confirmation = await issueConfirmation(fixture.email, now);
    const operation = await confirm(confirmation, new Date(now.getTime() + 1));
    expect(
      operation.holdEndsAt.getTime() - operation.holdStartedAt.getTime(),
    ).toBe(24 * 60 * 60 * 1000);
    expect(
      await prisma.session.count({ where: { userId: fixture.userId } }),
    ).toBe(0);
    expect(
      await prisma.authenticationChallenge.count({
        where: { userId: fixture.userId },
      }),
    ).toBe(0);
    expect(
      (
        await prisma.userAccount.findUniqueOrThrow({
          where: { id: fixture.userId },
          select: { twoFactorEnabled: true },
        })
      ).twoFactorEnabled,
    ).toBe(true);
    expect(
      await prisma.twoFactor.findUniqueOrThrow({
        where: { userId: fixture.userId },
      }),
    ).toEqual(beforeFactor);
    const blockedToken = `blocked-session-${randomUUID()}`;
    const blockedExpiry = new Date(Date.now() + 60 * 60 * 1000);
    await prisma.session.create({
      data: {
        id: randomUUID(),
        token: blockedToken,
        userId: fixture.userId,
        expiresAt: blockedExpiry,
        absoluteExpiresAt: blockedExpiry,
      },
    });
    await expect(
      getActiveSession(
        new Headers({ cookie: `smarthire.session=${blockedToken}` }),
      ),
    ).resolves.toBeNull();

    const blocked = await new LoginWithPasswordService().execute(
      { email: fixture.email, password: "Backup Code Fixture 2026!" },
      {
        headers: noSessionHeaders(),
        subject: "recovery-test",
        now: new Date(operation.holdStartedAt.getTime() + 1000),
      },
    );
    expect(blocked.status).toBe(401);
    expect(cookie(blocked, "smarthire.session")).toBeNull();
    expect(cookie(blocked, "smarthire.pre-auth")).toBeNull();

    const staleFactor = await authRequest(
      "/two-factor/verify-totp",
      { code: "000000" },
      stalePreAuth,
    );
    expect(staleFactor.ok).toBe(false);
  });

  it("cancels exactly once and preserves existing password and 2FA", async () => {
    const fixture = await enabledFixture();
    users.push(fixture.userId);
    const now = new Date("2026-07-23T02:00:00.000Z");
    const confirmation = await issueConfirmation(fixture.email, now);
    const operation = await confirm(confirmation, new Date(now.getTime() + 1));
    const cancellationProof = protector.unseal(
      operation.cancellationProofCiphertext,
    );
    const results = await Promise.all([
      new CancelFullAccountRecoveryService().execute(
        cancellationProof,
        new Date(operation.holdStartedAt.getTime() + 1000),
      ),
      new CancelFullAccountRecoveryService().execute(
        cancellationProof,
        new Date(operation.holdStartedAt.getTime() + 1000),
      ),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toHaveLength(1);
    const cancelled =
      await prisma.fullAccountRecoveryOperation.findUniqueOrThrow({
        where: { id: operation.id },
      });
    expect(cancelled.status).toBe("CANCELLED");
    expect(
      await prisma.emailOutbox.count({
        where: {
          idempotencyKey: cancelled.cancellationNotificationIdempotencyKey,
        },
      }),
    ).toBe(1);
    expect(
      await prisma.userAccount.findUniqueOrThrow({
        where: { id: fixture.userId },
        select: { twoFactorEnabled: true },
      }),
    ).toMatchObject({ twoFactorEnabled: true });
    expect(
      await new CancelFullAccountRecoveryService().execute(
        cancellationProof,
        new Date(operation.holdStartedAt.getTime() + 2000),
      ),
    ).toMatchObject({ ok: false });
  });

  it("rejects completion before the hold and completes once after it, disabling old factors only then", async () => {
    const fixture = await enabledFixture();
    users.push(fixture.userId);
    const staleTotpPreAuth = await preAuth(fixture.email);
    const staleBackupPreAuth = await preAuth(fixture.email);
    const now = new Date("2026-07-23T03:00:00.000Z");
    const confirmation = await issueConfirmation(fixture.email, now);
    const operation = await confirm(confirmation, new Date(now.getTime() + 1));
    const completionProof = protector.unseal(
      operation.completionProofCiphertext,
    );
    const beforeHold = await new CompleteFullAccountRecoveryService().execute(
      completionProof,
      replacementPassword,
      new Date(operation.holdEndsAt.getTime() - 1),
    );
    expect(beforeHold).toMatchObject({
      ok: false,
      holdEndsAt: operation.holdEndsAt,
    });

    const completed = await Promise.all([
      new CompleteFullAccountRecoveryService().execute(
        completionProof,
        replacementPassword,
        new Date(operation.holdEndsAt.getTime() + 1),
      ),
      new CompleteFullAccountRecoveryService().execute(
        completionProof,
        replacementPassword,
        new Date(operation.holdEndsAt.getTime() + 1),
      ),
    ]);
    expect(completed.filter((result) => result.ok)).toHaveLength(1);
    const final = await prisma.fullAccountRecoveryOperation.findUniqueOrThrow({
      where: { id: operation.id },
    });
    expect(final.status).toBe("COMPLETED");
    expect(final.passwordUpdatedAt).not.toBeNull();
    expect(final.twoFactorDisabledAt).not.toBeNull();
    expect(final.completionSessionsRevokedAt).not.toBeNull();
    expect(final.completionChallengesInvalidatedAt).not.toBeNull();
    expect(
      await prisma.emailOutbox.count({
        where: { idempotencyKey: final.completionNotificationIdempotencyKey },
      }),
    ).toBe(1);
    expect(
      await prisma.session.count({ where: { userId: fixture.userId } }),
    ).toBe(0);
    expect(
      await prisma.twoFactor.findUnique({ where: { userId: fixture.userId } }),
    ).toBeNull();
    expect(
      await prisma.userAccount.findUniqueOrThrow({
        where: { id: fixture.userId },
        select: { twoFactorEnabled: true },
      }),
    ).toMatchObject({ twoFactorEnabled: false });

    expect(
      (
        await authRequest(
          "/two-factor/verify-backup-code",
          { code: fixture.backupCodes[0], trustDevice: false },
          staleBackupPreAuth,
        )
      ).ok,
    ).toBe(false);
    expect(
      (
        await authRequest(
          "/two-factor/verify-totp",
          { code: "000000", trustDevice: false },
          staleTotpPreAuth,
        )
      ).ok,
    ).toBe(false);
    const login = await authRequest("/sign-in/email", {
      email: fixture.email,
      password: replacementPassword,
    });
    expect(login.ok).toBe(true);
    expect(cookie(login, "smarthire.session")).not.toBeNull();
    await expect(
      new CompleteFullAccountRecoveryService().execute(
        completionProof,
        replacementPassword,
        new Date(operation.holdEndsAt.getTime() + 2),
      ),
    ).resolves.toMatchObject({ ok: false });
  });

  it("keeps raw proofs out of operation, outbox, audit, and failure records", async () => {
    const fixture = await enabledFixture();
    users.push(fixture.userId);
    const now = new Date("2026-07-23T04:00:00.000Z");
    const confirmation = await issueConfirmation(fixture.email, now);
    const operation = await confirm(confirmation, new Date(now.getTime() + 1));
    const completion = protector.unseal(operation.completionProofCiphertext);
    const cancellation = protector.unseal(
      operation.cancellationProofCiphertext,
    );
    const evidence = JSON.stringify({
      operation,
      outbox: await prisma.emailOutbox.findMany({
        where: { userId: fixture.userId },
      }),
      audits: await prisma.auditEvent.findMany({
        where: { targetType: "account_recovery", targetId: operation.id },
      }),
    });
    for (const secret of [
      confirmation,
      completion,
      cancellation,
      fixture.secret,
      ...fixture.backupCodes,
    ]) {
      expect(evidence).not.toContain(secret);
    }
  });
});
