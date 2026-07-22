import { afterEach, describe, expect, it } from "vitest";
import { auth } from "@/server/auth/config";
import { prisma } from "@/lib/db/prisma";
import {
  authRequest,
  cleanupFixture,
  enabledFixture,
  fixturePassword,
  preAuth,
  requestHeaders,
} from "./backup-code-fixture";
let userId: string | undefined;
afterEach(async () => {
  if (userId) await cleanupFixture(userId);
  userId = undefined;
});
describe("Better Auth backup-code management", () => {
  it("regenerates exactly ten codes and invalidates the old set", async () => {
    const f = await enabledFixture();
    userId = f.userId;
    const generated = await auth.api.generateBackupCodes({
      headers: requestHeaders(f.session),
      body: { password: fixturePassword },
    });
    expect(generated.backupCodes).toHaveLength(10);
    const oldProof = await preAuth(f.email),
      old = await authRequest(
        "/two-factor/verify-backup-code",
        { code: f.backupCodes[0] },
        oldProof,
      );
    expect(old.ok).toBe(false);
    const newProof = await preAuth(f.email),
      fresh = await authRequest(
        "/two-factor/verify-backup-code",
        { code: generated.backupCodes[0] },
        newProof,
      );
    expect(fresh.ok).toBe(true);
  });
  it("disables 2FA through Better Auth after password and valid TOTP", async () => {
    const f = await enabledFixture();
    userId = f.userId;
    const totp = await auth.api.generateTOTP({ body: { secret: f.secret } });
    await auth.api.verifyTOTP({
      headers: requestHeaders(f.session),
      body: { code: totp.code },
    });
    const disabled = await auth.api
      .disableTwoFactor({
        headers: requestHeaders(f.session),
        body: { password: fixturePassword },
      })
      .catch(() => null);
    expect(disabled?.status).toBe(true);
    const user = await prisma.userAccount.findUniqueOrThrow({
      where: { id: f.userId },
      select: { twoFactorEnabled: true },
    });
    expect(user.twoFactorEnabled).toBe(false);
    expect(
      await prisma.twoFactor.findUnique({ where: { userId: f.userId } }),
    ).toBeNull();
  });
});
