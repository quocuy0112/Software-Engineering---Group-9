import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/backend/database/prisma";
import { TokenProtector } from "@/backend/security/security-token/security-tokens";
import { PrismaAccountRecoveryRepository } from "@/backend/repositories/identity/prisma-account-recovery-repository";
import { ConfirmFullAccountRecoveryService } from "@/backend/services/recovery/confirm-full-account-recovery";
import { CompleteFullAccountRecoveryService } from "@/backend/services/recovery/complete-full-account-recovery";
import { BetterAuthPasswordGateway } from "@/backend/auth/better-auth/better-auth-password-gateway";
import { BetterAuthTwoFactorGateway } from "@/backend/auth/better-auth/better-auth-two-factor-gateway";
import { cleanupFixture, enabledFixture } from "../auth/backup-code-fixture";

const protector = new TokenProtector();
const users: string[] = [];
const password = "Recovery failure retry 2026!";

afterEach(async () => {
  for (const userId of users) await cleanupFixture(userId);
  users.length = 0;
});

async function issue(email: string, now: Date) {
  const proof = protector.generate();
  await new PrismaAccountRecoveryRepository().replaceConfirmationForEligibleUser({
    normalizedEmail: email,
    rawProof: proof,
    protectedProof: protector.seal(proof),
    correlationId: randomUUID(),
    now,
  });
  return proof;
}

async function started(email: string, now: Date) {
  const confirmation = await issue(email, now);
  const result = await new ConfirmFullAccountRecoveryService().execute(
    confirmation,
    new Date(now.getTime() + 1),
  );
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("hold did not start");
  return prisma.fullAccountRecoveryOperation.findUniqueOrThrow({
    where: { id: result.operationId },
  });
}

describe("full account recovery failure injection", () => {
  it("fails closed before credential mutation when audit intent cannot persist", async () => {
    const fixture = await enabledFixture();
    users.push(fixture.userId);
    const operation = await started(
      fixture.email,
      new Date("2026-07-23T05:00:00.000Z"),
    );
    const proof = protector.unseal(operation.completionProofCiphertext);
    const failingRepository = new PrismaAccountRecoveryRepository(
      protector,
      () =>
        ({
          appendIdempotent: async () => {
            throw new Error("injected audit failure");
          },
        }) as never,
    );
    const updatePassword = vi.fn();
    const result = await new CompleteFullAccountRecoveryService(
      failingRepository,
      { updatePassword } as unknown as BetterAuthPasswordGateway,
      {} as BetterAuthTwoFactorGateway,
    ).execute(
      proof,
      password,
      new Date(operation.holdEndsAt.getTime() + 1),
    );
    expect(result).toMatchObject({ ok: false, retryable: true });
    expect(updatePassword).not.toHaveBeenCalled();
    const unchanged = await prisma.fullAccountRecoveryOperation.findUniqueOrThrow({
      where: { id: operation.id },
    });
    expect(unchanged.status).toBe("CONFIRMED_HOLD");
    expect(unchanged.completionConsumedAt).toBeNull();
  });

  it("persists a hold revocation failure and retries it without changing factors", async () => {
    const fixture = await enabledFixture();
    users.push(fixture.userId);
    const now = new Date("2026-07-23T06:00:00.000Z");
    const confirmation = await issue(fixture.email, now);
    const failingSessions = {
      revokeAllSessions: vi.fn(async () => {
        throw new Error("injected session revocation failure");
      }),
    };
    const failed = await new ConfirmFullAccountRecoveryService(
      new PrismaAccountRecoveryRepository(),
      failingSessions as unknown as BetterAuthPasswordGateway,
    ).execute(confirmation, new Date(now.getTime() + 1));
    expect(failed).toMatchObject({ ok: false, retryable: true });
    const operation = await prisma.fullAccountRecoveryOperation.findFirstOrThrow({
      where: { userId: fixture.userId },
    });
    expect(operation.failureCode).toBe("HOLD_SESSION_REVOCATION_FAILED");
    expect(operation.status).toBe("CONFIRMED_HOLD");
    const retried = await new ConfirmFullAccountRecoveryService().execute(
      confirmation,
      new Date(now.getTime() + 2),
    );
    expect(retried.ok).toBe(true);
    expect(
      await prisma.fullAccountRecoveryOperation.findUniqueOrThrow({
        where: { id: operation.id },
      }),
    ).toMatchObject({
      status: "CONFIRMED_HOLD",
      failureCode: null,
      confirmationFinalizedAt: expect.any(Date),
    });
  });

  it("retries a password-update failure against the same completion claim", async () => {
    const fixture = await enabledFixture();
    users.push(fixture.userId);
    const operation = await started(
      fixture.email,
      new Date("2026-07-23T07:00:00.000Z"),
    );
    const proof = protector.unseal(operation.completionProofCiphertext);
    const failingPasswords = {
      updatePassword: vi.fn(async () => {
        throw new Error("injected password failure");
      }),
      revokeAllSessions: vi.fn(),
    };
    const failed = await new CompleteFullAccountRecoveryService(
      new PrismaAccountRecoveryRepository(),
      failingPasswords as unknown as BetterAuthPasswordGateway,
      {} as BetterAuthTwoFactorGateway,
    ).execute(
      proof,
      password,
      new Date(operation.holdEndsAt.getTime() + 1),
    );
    expect(failed).toMatchObject({ ok: false, retryable: true });
    const partial = await prisma.fullAccountRecoveryOperation.findUniqueOrThrow({
      where: { id: operation.id },
    });
    expect(partial.status).toBe("COMPLETING");
    expect(partial.passwordUpdatedAt).toBeNull();

    const retried = await new CompleteFullAccountRecoveryService().execute(
      proof,
      password,
      new Date(operation.holdEndsAt.getTime() + 2),
    );
    expect(retried.ok).toBe(true);
    expect(
      await prisma.fullAccountRecoveryOperation.findUniqueOrThrow({
        where: { id: operation.id },
      }),
    ).toMatchObject({ status: "COMPLETED" });
  });
});
