import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { TokenProtector } from "@/lib/security/security-tokens";
import { BetterAuthPasswordGateway } from "@/server/auth/identity/better-auth-password-gateway";
import { PrismaPasswordResetRepository } from "@/server/repositories/identity/prisma-password-reset-repository";
import { PrismaSessionPolicyRepository } from "@/server/repositories/identity/prisma-session-policy-repository";
import { ResetPasswordService } from "@/server/services/identity/reset-password";
import {
  authRequest,
  cleanupFixture,
  cookie,
} from "../auth/backup-code-fixture";
import { createCredentialFixture } from "../../helpers/credential-fixture";

const protector = new TokenProtector();
const oldPassword = "Failure fixture password 2026!";
const newPassword = "Failure replacement password 2026!";
const users: string[] = [];
const quietAudit = { append: vi.fn().mockResolvedValue("failure-audit") };
const acceptedPolicy = {
  evaluate: vi.fn().mockResolvedValue({ accepted: true }),
};

afterEach(async () => {
  vi.restoreAllMocks();
  for (const userId of users) await cleanupFixture(userId);
  users.length = 0;
});

async function fixture() {
  const id = randomUUID();
  const email = `reset-failure-${id}@example.test`;
  const user = await createCredentialFixture({
    name: "Reset Failure User",
    email,
    password: oldPassword,
  });
  users.push(user.id);
  const login = await authRequest("/sign-in/email", {
    email,
    password: oldPassword,
  });
  const sessionCookie = cookie(login, "smarthire.session");
  if (!sessionCookie) throw new Error("fixture session failed");
  const rawToken = protector.generate();
  const now = new Date();
  await new PrismaPasswordResetRepository().replaceForActiveUser({
    normalizedEmail: email,
    rawToken,
    protectedToken: protector.seal(rawToken),
    correlationId: randomUUID(),
    now,
  });
  return { userId: user.id, email, rawToken, now, sessionCookie };
}

async function operation(userId: string) {
  return prisma.passwordResetOperation.findFirstOrThrow({ where: { userId } });
}

describe("password reset fail-closed failure injection", () => {
  it("blocks mutation when token claim persistence fails", async () => {
    const gateway = {
      updatePassword: vi.fn(),
      revokeAllSessions: vi.fn(),
    };
    const repository = {
      claimOrResume: vi.fn().mockRejectedValue(new Error("injected claim")),
    };
    const result = await new ResetPasswordService(
      repository as never,
      gateway as never,
      quietAudit as never,
      acceptedPolicy as never,
    ).execute("never-logged-token", newPassword);
    expect(result).toMatchObject({ ok: false, retryable: true });
    expect(gateway.updatePassword).not.toHaveBeenCalled();
  });

  it("rolls back the claim and blocks mutation when audit intent cannot be written", async () => {
    const f = await fixture();
    const repository = new PrismaPasswordResetRepository(
      protector,
      () =>
        ({
          appendIdempotent: vi
            .fn()
            .mockRejectedValue(new Error("injected audit intent")),
        }) as never,
    );
    const gateway = {
      updatePassword: vi.fn(),
      revokeAllSessions: vi.fn(),
    };
    const result = await new ResetPasswordService(
      repository,
      gateway as never,
      quietAudit as never,
      acceptedPolicy as never,
    ).execute(f.rawToken, newPassword, new Date(f.now.getTime() + 1));
    expect(result).toMatchObject({ ok: false, retryable: true });
    expect(gateway.updatePassword).not.toHaveBeenCalled();
    expect(
      await prisma.passwordResetOperation.count({
        where: { userId: f.userId },
      }),
    ).toBe(0);
    const token = await prisma.securityToken.findFirstOrThrow({
      where: { userId: f.userId, purpose: "RESET_PASSWORD" },
    });
    expect(token.status).toBe("ACTIVE");
    expect(token.consumedAt).toBeNull();
  });

  it("converges an ambiguous password update without repeating the credential write", async () => {
    const f = await fixture();
    const realGateway = new BetterAuthPasswordGateway();
    let first = true;
    const gateway = {
      updatePassword: vi.fn(async (userId: string, password: string) => {
        const changed = await realGateway.updatePassword(userId, password);
        if (first) {
          first = false;
          throw new Error("injected ambiguous password result");
        }
        return changed;
      }),
      revokeAllSessions: (userId: string) =>
        realGateway.revokeAllSessions(userId),
    };
    const service = new ResetPasswordService(
      new PrismaPasswordResetRepository(),
      gateway as never,
      quietAudit as never,
      acceptedPolicy as never,
    );
    await expect(
      service.execute(
        f.rawToken,
        newPassword,
        new Date(f.now.getTime() + 1),
      ),
    ).resolves.toMatchObject({ ok: false, retryable: true });
    expect(await operation(f.userId)).toMatchObject({
      status: "FAILED_RETRYABLE",
      failureCode: "PASSWORD_UPDATE_FAILED",
      passwordUpdatedAt: null,
    });
    const hashAfterAmbiguous = (
      await prisma.authProviderAccount.findFirstOrThrow({
        where: { userId: f.userId, providerId: "credential" },
      })
    ).password;

    await expect(
      service.execute(
        f.rawToken,
        newPassword,
        new Date(f.now.getTime() + 2),
      ),
    ).resolves.toMatchObject({ ok: true });
    const hashAfterRetry = (
      await prisma.authProviderAccount.findFirstOrThrow({
        where: { userId: f.userId, providerId: "credential" },
      })
    ).password;
    expect(hashAfterRetry).toBe(hashAfterAmbiguous);
    expect(gateway.updatePassword).toHaveBeenCalledTimes(2);
  });

  it("persists session-revocation failure and blocks new and existing sessions until retry", async () => {
    const f = await fixture();
    const realGateway = new BetterAuthPasswordGateway();
    const gateway = {
      updatePassword: (userId: string, password: string) =>
        realGateway.updatePassword(userId, password),
      revokeAllSessions: vi
        .fn()
        .mockRejectedValueOnce(new Error("injected session revocation"))
        .mockImplementation((userId: string) =>
          realGateway.revokeAllSessions(userId),
        ),
    };
    const service = new ResetPasswordService(
      new PrismaPasswordResetRepository(),
      gateway as never,
      quietAudit as never,
      acceptedPolicy as never,
    );
    await expect(
      service.execute(
        f.rawToken,
        newPassword,
        new Date(f.now.getTime() + 1),
      ),
    ).resolves.toMatchObject({ ok: false, retryable: true });
    expect(await operation(f.userId)).toMatchObject({
      status: "FAILED_RETRYABLE",
      failureCode: "SESSION_REVOCATION_FAILED",
      passwordUpdatedAt: expect.any(Date),
      sessionsRevokedAt: null,
    });
    const oldSession = await prisma.session.findFirstOrThrow({
      where: { userId: f.userId },
    });
    expect(
      await new PrismaSessionPolicyRepository().validateAndTouch(
        oldSession.id,
        f.userId,
        new Date(f.now.getTime() + 2),
      ),
    ).toBeNull();
    const blockedLogin = await authRequest("/sign-in/email", {
      email: f.email,
      password: newPassword,
    });
    expect(cookie(blockedLogin, "smarthire.session")).toBeNull();

    await expect(
      service.execute(
        f.rawToken,
        newPassword,
        new Date(f.now.getTime() + 3),
      ),
    ).resolves.toMatchObject({ ok: true });
    expect(
      await prisma.session.count({ where: { userId: f.userId } }),
    ).toBe(0);
  });

  it("persists challenge invalidation failure and resumes cleanup", async () => {
    const f = await fixture();
    await prisma.authenticationChallenge.create({
      data: {
        userId: f.userId,
        handleDigest: `failure-${randomUUID()}`,
        purpose: "PASSWORD_LOGIN_2FA",
        expiresAt: new Date(f.now.getTime() + 300_000),
      },
    });
    const repository = new PrismaPasswordResetRepository();
    vi.spyOn(repository, "invalidateChallengesAndResetProofs")
      .mockRejectedValueOnce(new Error("injected challenge cleanup"));
    const service = new ResetPasswordService(
      repository,
      new BetterAuthPasswordGateway(),
      quietAudit as never,
      acceptedPolicy as never,
    );
    await expect(
      service.execute(
        f.rawToken,
        newPassword,
        new Date(f.now.getTime() + 1),
      ),
    ).resolves.toMatchObject({ ok: false, retryable: true });
    expect(await operation(f.userId)).toMatchObject({
      failureCode: "CHALLENGE_INVALIDATION_FAILED",
      challengesInvalidatedAt: null,
    });
    expect(
      await prisma.authenticationChallenge.count({
        where: { userId: f.userId },
      }),
    ).toBe(1);
    await expect(
      service.execute(
        f.rawToken,
        newPassword,
        new Date(f.now.getTime() + 2),
      ),
    ).resolves.toMatchObject({ ok: true });
    expect(
      await prisma.authenticationChallenge.count({
        where: { userId: f.userId },
      }),
    ).toBe(0);
  });

  it("retries notification enqueue without duplication", async () => {
    const f = await fixture();
    const repository = new PrismaPasswordResetRepository();
    vi.spyOn(repository, "enqueueNotification").mockRejectedValueOnce(
      new Error("injected notification"),
    );
    const service = new ResetPasswordService(
      repository,
      new BetterAuthPasswordGateway(),
      quietAudit as never,
      acceptedPolicy as never,
    );
    await expect(
      service.execute(
        f.rawToken,
        newPassword,
        new Date(f.now.getTime() + 1),
      ),
    ).resolves.toMatchObject({ ok: false, retryable: true });
    expect(await operation(f.userId)).toMatchObject({
      failureCode: "NOTIFICATION_ENQUEUE_FAILED",
      notificationEnqueuedAt: null,
    });
    await expect(
      service.execute(
        f.rawToken,
        newPassword,
        new Date(f.now.getTime() + 2),
      ),
    ).resolves.toMatchObject({ ok: true });
    expect(
      await prisma.emailOutbox.count({
        where: { userId: f.userId, kind: "PASSWORD_CHANGED" },
      }),
    ).toBe(1);
  });

  it("retries final audit emission without duplication", async () => {
    const f = await fixture();
    const repository = new PrismaPasswordResetRepository();
    vi.spyOn(repository, "appendFinalAudit").mockRejectedValueOnce(
      new Error("injected final audit"),
    );
    const service = new ResetPasswordService(
      repository,
      new BetterAuthPasswordGateway(),
      quietAudit as never,
      acceptedPolicy as never,
    );
    await expect(
      service.execute(
        f.rawToken,
        newPassword,
        new Date(f.now.getTime() + 1),
      ),
    ).resolves.toMatchObject({ ok: false, retryable: true });
    expect(await operation(f.userId)).toMatchObject({
      failureCode: "AUDIT_FINALIZATION_FAILED",
      auditFinalizedAt: null,
    });
    await expect(
      service.execute(
        f.rawToken,
        newPassword,
        new Date(f.now.getTime() + 2),
      ),
    ).resolves.toMatchObject({ ok: true });
    const completed = await operation(f.userId);
    expect(
      await prisma.auditEvent.count({
        where: { id: completed.finalAuditId! },
      }),
    ).toBe(1);
  });

  it("retries operation finalization without duplicating audit or notification", async () => {
    const f = await fixture();
    const repository = new PrismaPasswordResetRepository();
    vi.spyOn(repository, "finalize").mockRejectedValueOnce(
      new Error("injected finalization"),
    );
    const service = new ResetPasswordService(
      repository,
      new BetterAuthPasswordGateway(),
      quietAudit as never,
      acceptedPolicy as never,
    );
    await expect(
      service.execute(
        f.rawToken,
        newPassword,
        new Date(f.now.getTime() + 1),
      ),
    ).resolves.toMatchObject({ ok: false, retryable: true });
    expect(await operation(f.userId)).toMatchObject({
      failureCode: "OPERATION_FINALIZATION_FAILED",
      auditFinalizedAt: expect.any(Date),
      finalizedAt: null,
    });
    await expect(
      service.execute(
        f.rawToken,
        newPassword,
        new Date(f.now.getTime() + 2),
      ),
    ).resolves.toMatchObject({ ok: true });
    const completed = await operation(f.userId);
    expect(completed.status).toBe("FINALIZED");
    expect(
      await prisma.emailOutbox.count({
        where: { id: completed.notificationOutboxId! },
      }),
    ).toBe(1);
    expect(
      await prisma.auditEvent.count({
        where: { id: completed.finalAuditId! },
      }),
    ).toBe(1);
  });

  it("never logs raw reset, password, cookie, TOTP, or backup-code values", async () => {
    const secrets = [
      "raw-reset-token-value",
      newPassword,
      "smarthire.session=raw-cookie",
      "123456",
      "unused-backup-code",
    ];
    const consoleSpies = [
      vi.spyOn(console, "log").mockImplementation(() => undefined),
      vi.spyOn(console, "info").mockImplementation(() => undefined),
      vi.spyOn(console, "warn").mockImplementation(() => undefined),
      vi.spyOn(console, "error").mockImplementation(() => undefined),
    ];
    const result = await new ResetPasswordService(
      {
        claimOrResume: vi.fn().mockRejectedValue(new Error("safe injected")),
      } as never,
      {} as never,
      quietAudit as never,
      acceptedPolicy as never,
    ).execute(secrets[0], secrets[1]);
    expect(result).toMatchObject({ ok: false, retryable: true });
    const output = consoleSpies.flatMap((spy) => spy.mock.calls).flat().join(" ");
    for (const secret of secrets) expect(output).not.toContain(secret);
    for (const call of quietAudit.append.mock.calls) {
      const serialized = JSON.stringify(call);
      for (const secret of secrets) expect(serialized).not.toContain(secret);
    }
  });
});
