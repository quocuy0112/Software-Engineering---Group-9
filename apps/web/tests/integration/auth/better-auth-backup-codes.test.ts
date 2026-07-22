import { afterEach, describe, expect, it, vi } from "vitest";
import { symmetricDecrypt } from "better-auth/crypto";
import { auth } from "@/server/auth/config";
import { prisma } from "@/lib/db/prisma";
import { serverEnvironment } from "@/lib/env/runtime";
import {
  authRequest,
  cleanupFixture,
  enabledFixture,
  fixturePassword,
  preAuth,
  requestHeaders,
} from "./backup-code-fixture";
const users: string[] = [];
afterEach(async () => {
  for (const id of users) await cleanupFixture(id);
  users.length = 0;
  vi.restoreAllMocks();
});
describe("Better Auth backup-code storage and regeneration", () => {
  it("protects plaintext at rest and replaces the authoritative set", async () => {
    const f = await enabledFixture();
    users.push(f.userId);
    const stored = await prisma.twoFactor.findUniqueOrThrow({
      where: { userId: f.userId },
    });
    for (const code of f.backupCodes)
      expect(stored.backupCodes).not.toContain(code);
    const decrypted = JSON.parse(
      await symmetricDecrypt({
        key: serverEnvironment.BETTER_AUTH_SECRET,
        data: stored.backupCodes,
      }),
    ) as string[];
    expect(decrypted).toEqual(expect.arrayContaining(f.backupCodes));
    const generated = await auth.api.generateBackupCodes({
      headers: requestHeaders(f.session),
      body: { password: fixturePassword },
    });
    expect(generated.backupCodes).toHaveLength(10);
    const replaced = await prisma.twoFactor.findUniqueOrThrow({
      where: { userId: f.userId },
    });
    expect(replaced.backupCodes).not.toBe(stored.backupCodes);
    for (const old of f.backupCodes) {
      const proof = await preAuth(f.email),
        response = await authRequest(
          "/two-factor/verify-backup-code",
          { code: old },
          proof,
        );
      expect(response.ok).toBe(false);
    }
    const proof = await preAuth(f.email),
      valid = await authRequest(
        "/two-factor/verify-backup-code",
        { code: generated.backupCodes[0] },
        proof,
      );
    expect(valid.ok).toBe(true);
  }, 30000);
  it("does not log or expose persisted backup-code material", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined),
      f = await enabledFixture();
    users.push(f.userId);
    const proof = await preAuth(f.email);
    await authRequest(
      "/two-factor/verify-backup-code",
      { code: "invalid-backup-code" },
      proof,
    );
    expect(log.mock.calls.flat().join(" ")).not.toContain(
      "invalid-backup-code",
    );
    const tables = await prisma.$queryRaw<
      Array<{ table_name: string }>
    >`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name ILIKE '%backup%'`;
    expect(tables).toHaveLength(0);
  });
});
