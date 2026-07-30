import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, verifyDatabaseConnectivity } from "@/backend/database/prisma";
import { TokenProtector } from "@/backend/security/security-token/security-tokens";
import {
  PASSWORD_RESET_LIFETIME_MS,
  PrismaPasswordResetRepository,
} from "@/backend/repositories/identity/prisma-password-reset-repository";

const runId = randomUUID();
const userId = `reset-repo-${runId}`;
const email = `reset-repo-${runId}@example.test`;
const protector = new TokenProtector();
const repository = new PrismaPasswordResetRepository(protector);
const replacementPassword = "Repository replacement password 2026!";

beforeAll(async () => {
  await verifyDatabaseConnectivity();
  await prisma.userAccount.create({
    data: {
      id: userId,
      name: "Reset User",
      email,
      normalizedEmail: email,
      state: "ACTIVE",
      emailVerified: true,
    },
  });
});

afterAll(async () => {
  await prisma.passwordResetOperation.deleteMany({ where: { userId } });
  await prisma.emailOutbox.deleteMany({ where: { userId } });
  await prisma.securityToken.deleteMany({ where: { userId } });
  await prisma.userAccount
    .delete({ where: { id: userId } })
    .catch(() => undefined);
  await prisma.$disconnect();
});

async function issue(rawToken: string, now: Date, correlationId: string) {
  return repository.replaceForActiveUser({
    normalizedEmail: email,
    rawToken,
    protectedToken: protector.seal(rawToken),
    correlationId,
    now,
  });
}

describe("PostgreSQL password-reset operation repository", () => {
  it("stores only an HMAC token digest, expires at 30 minutes, and supersedes prior proof", async () => {
    const now = new Date();
    const first = protector.generate();
    await issue(first, now, `first-${runId}`);
    const firstRow = await prisma.securityToken.findFirstOrThrow({
      where: { userId, tokenDigest: protector.digest(first) },
    });
    expect(firstRow.tokenDigest).not.toBe(first);
    expect(firstRow.expiresAt.getTime()).toBe(
      now.getTime() + PASSWORD_RESET_LIFETIME_MS,
    );

    const second = protector.generate();
    await issue(second, new Date(now.getTime() + 1), `second-${runId}`);
    await expect(
      repository.claimOrResume(first, replacementPassword, new Date(now.getTime() + 2)),
    ).resolves.toEqual({ status: "used" });
    await expect(
      repository.claimOrResume(
        second,
        replacementPassword,
        new Date(now.getTime() + PASSWORD_RESET_LIFETIME_MS + 1),
      ),
    ).resolves.toEqual({ status: "expired" });
  });

  it("allows one PostgreSQL claim owner, binds retries to the same submission, and rejects replay", async () => {
    const now = new Date();
    const raw = protector.generate();
    await issue(raw, now, `concurrent-${runId}`);

    const results = await Promise.all([
      repository.claimOrResume(
        raw,
        replacementPassword,
        new Date(now.getTime() + 1),
      ),
      repository.claimOrResume(
        raw,
        replacementPassword,
        new Date(now.getTime() + 1),
      ),
    ]);
    const winners = results.filter(
      (result) => result.status === "acquired" && result.claimed,
    );
    expect(winners).toHaveLength(1);
    expect(results.filter((result) => result.status === "busy")).toHaveLength(1);

    const winner = winners[0];
    if (!winner || winner.status !== "acquired") throw new Error("missing winner");
    await repository.fail(
      winner.operation.id,
      winner.executionOwner,
      "PASSWORD_UPDATE_FAILED",
      new Date(now.getTime() + 2),
    );

    const resumed = await repository.claimOrResume(
      raw,
      replacementPassword,
      new Date(now.getTime() + 3),
    );
    expect(resumed).toMatchObject({
      status: "acquired",
      claimed: false,
      operation: { id: winner.operation.id },
    });
    await expect(
      repository.claimOrResume(
        raw,
        "A different replacement password 2026!",
        new Date(now.getTime() + 4),
      ),
    ).resolves.toEqual({ status: "used" });

    expect(
      await prisma.passwordResetOperation.count({
        where: { securityTokenId: winner.operation.securityTokenId },
      }),
    ).toBe(1);
    expect(
      await prisma.auditEvent.count({
        where: { id: winner.operation.auditIntentKey },
      }),
    ).toBe(1);
    const token = await prisma.securityToken.findUniqueOrThrow({
      where: { id: winner.operation.securityTokenId },
    });
    expect(token.status).toBe("CONSUMED");
    expect(token.consumedAt).not.toBeNull();
  });
});
