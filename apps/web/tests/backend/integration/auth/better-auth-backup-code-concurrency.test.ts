import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/backend/database/prisma";
import {
  authRequest,
  cleanupFixture,
  enabledFixture,
  preAuth,
} from "./backup-code-fixture";
let userId: string | undefined;
afterEach(async () => {
  if (userId) await cleanupFixture(userId);
  userId = undefined;
});
describe("Better Auth PostgreSQL atomic backup-code consumption", () => {
  it("allows exactly one concurrent use and creates one session", async () => {
    const f = await enabledFixture();
    userId = f.userId;
    await prisma.session.deleteMany({ where: { userId } });
    const proof = await preAuth(f.email),
      code = f.backupCodes[0];
    const [a, b] = await Promise.all([
      authRequest("/two-factor/verify-backup-code", { code }, proof),
      authRequest("/two-factor/verify-backup-code", { code }, proof),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(await prisma.session.count({ where: { userId } })).toBe(1);
    const replay = await authRequest(
      "/two-factor/verify-backup-code",
      { code },
      await preAuth(f.email),
    );
    expect(replay.ok).toBe(false);
  });
});
