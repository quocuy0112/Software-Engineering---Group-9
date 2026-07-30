import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/backend/database/prisma";
import { TokenProtector } from "@/backend/security/security-token/security-tokens";
import { requireSession } from "@/backend/auth/session/require-session";
import { PrismaAccountRecoveryRepository } from "@/backend/repositories/identity/prisma-account-recovery-repository";
import { ConfirmFullAccountRecoveryService } from "@/backend/services/recovery/confirm-full-account-recovery";
import { CancelFullAccountRecoveryService } from "@/backend/services/recovery/cancel-full-account-recovery";
import { LoginWithPasswordService } from "@/backend/services/identity/login-with-password";
import {
  cleanupFixture,
  cookie,
  enabledFixture,
  fixturePassword,
  requestHeaders,
} from "../auth/backup-code-fixture";

const protector = new TokenProtector();
const users: string[] = [];

afterEach(async () => {
  for (const userId of users) await cleanupFixture(userId);
  users.length = 0;
});

describe("account recovery login and protected-route gate", () => {
  it("blocks session/challenge creation until one-time cancellation removes the gate", async () => {
    const fixture = await enabledFixture();
    users.push(fixture.userId);
    const now = new Date("2026-07-23T08:00:00.000Z");
    const confirmation = protector.generate();
    await new PrismaAccountRecoveryRepository().replaceConfirmationForEligibleUser({
      normalizedEmail: fixture.email,
      rawProof: confirmation,
      protectedProof: protector.seal(confirmation),
      correlationId: randomUUID(),
      now,
    });
    const confirmed = await new ConfirmFullAccountRecoveryService().execute(
      confirmation,
      new Date(now.getTime() + 1),
    );
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) throw new Error("hold did not start");
    const operation = await prisma.fullAccountRecoveryOperation.findUniqueOrThrow({
      where: { id: confirmed.operationId },
    });

    const blockedLogin = await new LoginWithPasswordService().execute(
      { email: fixture.email, password: fixturePassword },
      {
        headers: requestHeaders(),
        subject: `recovery-login:${randomUUID()}`,
        now: new Date(now.getTime() + 2),
      },
    );
    expect(blockedLogin.status).toBe(401);
    expect(cookie(blockedLogin, "smarthire.session")).toBeNull();
    expect(cookie(blockedLogin, "smarthire.pre-auth")).toBeNull();
    expect(
      await prisma.authenticationChallenge.count({
        where: { userId: fixture.userId },
      }),
    ).toBe(0);

    const rawSessionToken = `forced-${randomUUID()}`;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await prisma.session.create({
      data: {
        id: randomUUID(),
        token: rawSessionToken,
        userId: fixture.userId,
        expiresAt,
        absoluteExpiresAt: expiresAt,
      },
    });
    await expect(
      requireSession(
        new Headers({ cookie: `smarthire.session=${rawSessionToken}` }),
      ),
    ).resolves.toBeNull();

    const cancellationProof = protector.unseal(
      operation.cancellationProofCiphertext,
    );
    await expect(
      new CancelFullAccountRecoveryService().execute(
        cancellationProof,
        new Date(now.getTime() + 3),
      ),
    ).resolves.toMatchObject({ ok: true });
    const unblockedLogin = await new LoginWithPasswordService().execute(
      { email: fixture.email, password: fixturePassword },
      {
        headers: requestHeaders(),
        subject: `recovery-login:${randomUUID()}`,
        now: new Date(now.getTime() + 4),
      },
    );
    expect(unblockedLogin.status).toBe(200);
    expect(await unblockedLogin.json()).toMatchObject({
      requiresTwoFactor: true,
    });
    expect(cookie(unblockedLogin, "smarthire.pre-auth")).not.toBeNull();
    expect(cookie(unblockedLogin, "smarthire.session")).toBeNull();
  });
});
