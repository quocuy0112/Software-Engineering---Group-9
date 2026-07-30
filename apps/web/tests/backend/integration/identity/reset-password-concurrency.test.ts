import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/backend/database/prisma";
import { TokenProtector } from "@/backend/security/security-token/security-tokens";
import { BetterAuthPasswordGateway } from "@/backend/auth/better-auth/better-auth-password-gateway";
import { PrismaPasswordResetRepository } from "@/backend/repositories/identity/prisma-password-reset-repository";
import { ResetPasswordService } from "@/backend/services/recovery/reset-password";
import {
  authRequest,
  cleanupFixture,
  cookie,
} from "../auth/backup-code-fixture";
import { createCredentialFixture } from "../../../helpers/credential-fixture";

const protector = new TokenProtector();
const originalPassword = "Concurrent fixture password 2026!";
const replacementPassword = "Concurrent replacement password 2026!";
const users: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  for (const userId of users) await cleanupFixture(userId);
  users.length = 0;
});

describe("concurrent password reset saga on PostgreSQL", () => {
  it("has one claim winner and one terminal credential/notification/audit outcome", async () => {
    const id = randomUUID();
    const email = `reset-race-${id}@example.test`;
    const user = await createCredentialFixture({
      name: "Concurrent Reset User",
      email,
      password: originalPassword,
    });
    users.push(user.id);
    const initialLogin = await authRequest("/sign-in/email", {
      email,
      password: originalPassword,
    });
    expect(cookie(initialLogin, "smarthire.session")).not.toBeNull();

    const rawToken = protector.generate();
    const now = new Date();
    await new PrismaPasswordResetRepository().replaceForActiveUser({
      normalizedEmail: email,
      rawToken,
      protectedToken: protector.seal(rawToken),
      correlationId: randomUUID(),
      now,
    });

    let enterUpdate!: () => void;
    let releaseUpdate!: () => void;
    const updateEntered = new Promise<void>((resolve) => {
      enterUpdate = resolve;
    });
    const updateReleased = new Promise<void>((resolve) => {
      releaseUpdate = resolve;
    });
    const realGateway = new BetterAuthPasswordGateway();
    const gateway = {
      updatePassword: vi.fn(async (userId: string, password: string) => {
        enterUpdate();
        await updateReleased;
        return realGateway.updatePassword(userId, password);
      }),
      revokeAllSessions: (userId: string) =>
        realGateway.revokeAllSessions(userId),
    };
    const firstService = new ResetPasswordService(
      new PrismaPasswordResetRepository(),
      gateway as never,
    );
    const secondService = new ResetPasswordService(
      new PrismaPasswordResetRepository(),
      gateway as never,
    );

    const first = firstService.execute(
      rawToken,
      replacementPassword,
      new Date(now.getTime() + 1),
    );
    await updateEntered;
    const second = await secondService.execute(
      rawToken,
      replacementPassword,
      new Date(now.getTime() + 1),
    );
    releaseUpdate();
    const winner = await first;

    expect(winner).toMatchObject({ ok: true, userId: user.id });
    expect(second).toMatchObject({ ok: false, retryable: true });
    expect(gateway.updatePassword).toHaveBeenCalledTimes(1);
    const operations = await prisma.passwordResetOperation.findMany({
      where: { userId: user.id },
    });
    expect(operations).toHaveLength(1);
    expect(operations[0]).toMatchObject({
      status: "FINALIZED",
      failureCode: null,
    });
    expect(
      await prisma.emailOutbox.count({
        where: { userId: user.id, kind: "PASSWORD_CHANGED" },
      }),
    ).toBe(1);
    expect(
      await prisma.auditEvent.count({
        where: {
          id: {
            in: [
              operations[0]!.auditIntentKey,
              operations[0]!.finalAuditId!,
            ],
          },
        },
      }),
    ).toBe(2);
    expect(
      await prisma.session.count({ where: { userId: user.id } }),
    ).toBe(0);
    await expect(
      new ResetPasswordService().execute(
        rawToken,
        replacementPassword,
        new Date(now.getTime() + 2),
      ),
    ).resolves.toMatchObject({ ok: false, retryable: false });
  }, 30_000);
});
