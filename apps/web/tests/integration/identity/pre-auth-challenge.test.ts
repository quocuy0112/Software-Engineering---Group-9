import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  PrismaPreAuthRepository,
  PRE_AUTH_LIFETIME_MS,
} from "@/server/repositories/identity/prisma-pre-auth-repository";
const users: string[] = [];
async function user() {
  const id = randomUUID();
  users.push(id);
  await prisma.userAccount.create({
    data: {
      id,
      name: "Challenge",
      email: `${id}@example.test`,
      normalizedEmail: `${id}@example.test`,
      emailVerified: true,
      state: "ACTIVE",
      twoFactorEnabled: true,
    },
  });
  return id;
}
afterEach(async () => {
  await prisma.authenticationChallenge.deleteMany({
    where: { userId: { in: users } },
  });
  await prisma.userAccount.deleteMany({ where: { id: { in: users } } });
  users.length = 0;
});
describe("PostgreSQL pre-auth challenges", () => {
  it("protects the raw token, binds account/browser, and expires at exactly five minutes", async () => {
    const r = new PrismaPreAuthRepository(),
      id = await user(),
      now = new Date("2026-07-21T00:00:00Z"),
      c = await r.create(id, "browser-a", now),
      row = await prisma.authenticationChallenge.findFirstOrThrow({
        where: { userId: id },
      });
    expect(row.handleDigest).not.toContain(c.token);
    expect(row.contextDigest).not.toContain("browser-a");
    expect(row.expiresAt.getTime() - now.getTime()).toBe(PRE_AUTH_LIFETIME_MS);
    expect(await r.claimAttempt(c.token, "browser-b", now)).toBeNull();
    expect(
      await r.claimAttempt(
        c.token,
        "browser-a",
        new Date(now.getTime() + PRE_AUTH_LIFETIME_MS),
      ),
    ).toBeNull();
  });
  it("permits at most five failed attempts", async () => {
    const r = new PrismaPreAuthRepository(),
      id = await user(),
      now = new Date(),
      c = await r.create(id, "b", now);
    for (let i = 0; i < 5; i++) {
      const claim = await r.claimAttempt(c.token, "b", now);
      expect(claim).not.toBeNull();
      await r.releaseFailed(claim!.id, claim!.claimTime);
    }
    expect(await r.claimAttempt(c.token, "b", now)).toBeNull();
  });
  it("uses PostgreSQL atomic claim so concurrent consume succeeds once and cannot replay", async () => {
    const r = new PrismaPreAuthRepository(),
      id = await user(),
      now = new Date(),
      c = await r.create(id, "b", now),
      claims = await Promise.all(
        Array.from({ length: 12 }, () => r.claimAttempt(c.token, "b", now)),
      );
    expect(claims.filter(Boolean)).toHaveLength(1);
    const claim = claims.find(Boolean)!;
    expect(await r.finalize(claim.id, id, claim.claimTime, BigInt(123))).toBe(true);
    expect(await r.claimAttempt(c.token, "b", now)).toBeNull();
  });
});
