import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, verifyDatabaseConnectivity } from "@/lib/db/prisma";
import { TokenProtector } from "@/lib/security/security-tokens";
import {
  PASSWORD_RESET_LIFETIME_MS,
  PrismaPasswordResetRepository,
} from "@/server/repositories/identity/prisma-password-reset-repository";

const runId = randomUUID();
const userId = `reset-repo-${runId}`;
const email = `reset-repo-${runId}@example.test`;
const protector = new TokenProtector();
const repository = new PrismaPasswordResetRepository(protector);

beforeAll(async () => {
  await verifyDatabaseConnectivity();
  await prisma.userAccount.create({
    data: { id: userId, name: "Reset User", email, normalizedEmail: email, state: "ACTIVE", emailVerified: true },
  });
});

afterAll(async () => {
  await prisma.emailOutbox.deleteMany({ where: { userId } });
  await prisma.securityToken.deleteMany({ where: { userId } });
  await prisma.userAccount.delete({ where: { id: userId } }).catch(() => undefined);
  await prisma.$disconnect();
});

describe("PostgreSQL password-reset repository", () => {
  it("stores only an HMAC digest, expires at exactly 30 minutes, and supersedes the prior token", async () => {
    const now = new Date();
    const first = protector.generate();
    await repository.replaceForActiveUser({ normalizedEmail: email, rawToken: first, protectedToken: protector.seal(first), correlationId: `first-${runId}`, now });
    const firstRow = await prisma.securityToken.findFirstOrThrow({ where: { userId, purpose: "RESET_PASSWORD" } });
    expect(firstRow.tokenDigest).not.toBe(first);
    expect(firstRow.tokenDigest).toBe(protector.digest(first));
    expect(firstRow.expiresAt.getTime()).toBe(now.getTime() + PASSWORD_RESET_LIFETIME_MS);

    const second = protector.generate();
    await repository.replaceForActiveUser({ normalizedEmail: email, rawToken: second, protectedToken: protector.seal(second), correlationId: `second-${runId}`, now: new Date(now.getTime() + 1) });
    expect((await repository.consume(first, new Date(now.getTime() + 2))).status).toBe("used");
    expect((await repository.consume(second, new Date(now.getTime() + PASSWORD_RESET_LIFETIME_MS + 1))).status).toBe("expired");
  });

  it("allows exactly one concurrent consume and rejects replay", async () => {
    const now = new Date();
    const raw = protector.generate();
    await repository.replaceForActiveUser({ normalizedEmail: email, rawToken: raw, protectedToken: protector.seal(raw), correlationId: `concurrent-${runId}`, now });
    const results = await Promise.all([
      repository.consume(raw, new Date(now.getTime() + 1)),
      repository.consume(raw, new Date(now.getTime() + 1)),
    ]);
    expect(results.filter((result) => result.status === "consumed")).toHaveLength(1);
    expect(results.filter((result) => result.status === "used")).toHaveLength(1);
    expect((await repository.consume(raw, new Date(now.getTime() + 2))).status).toBe("used");
  });
});
