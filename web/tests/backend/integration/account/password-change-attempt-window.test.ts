import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/backend/database/prisma";
import {
  PASSWORD_CHANGE_LOCK_MS,
  PrismaPasswordChangeAttemptRepository,
  shouldCountPasswordChangeFailure,
} from "@/backend/repositories/account/prisma-password-change-attempt-repository";
import {
  createProfileDatabaseAccount,
  deleteProfileDatabaseAccounts,
} from "../../../helpers/profile-database-fixture";

let owner: Awaited<ReturnType<typeof createProfileDatabaseAccount>>;
const now = new Date("2026-07-31T05:00:00.000Z");

beforeAll(async () => {
  owner = await createProfileDatabaseAccount("password-attempt-window");
});

afterAll(async () => {
  await deleteProfileDatabaseAccounts([owner.userId]);
});

describe("password-change attempt window", () => {
  it("does not create shared state for policy, confirmation, or reuse failures", async () => {
    for (const code of [
      "PASSWORD_POLICY",
      "PASSWORD_COMPROMISED",
      "PASSWORD_CONFIRMATION_MISMATCH",
      "PASSWORD_REUSE",
    ] as const) {
      expect(shouldCountPasswordChangeFailure(code)).toBe(false);
    }
    expect(
      await prisma.passwordChangeAttemptWindow.findUnique({
        where: { userId: owner.userId },
      }),
    ).toBeNull();
  });

  it("serializes concurrent failures so exactly the fifth locks and audits", async () => {
    const repository = new PrismaPasswordChangeAttemptRepository();
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        repository.recordWrongCurrent({
          userId: owner.userId,
          sessionId: `session-${index}`,
          correlationId: `password-failure-${owner.userId}-${index}`,
          ipPrefixDigest: `protected-prefix-${index}`,
          now: new Date(now.getTime() + index),
        }),
      ),
    );
    expect(results.filter((result) => result.locked)).toHaveLength(1);
    const row = await prisma.passwordChangeAttemptWindow.findUniqueOrThrow({
      where: { userId: owner.userId },
    });
    expect(row.failureTimestamps).toHaveLength(5);
    expect(row.lockedUntil).toEqual(
      new Date(now.getTime() + 4 + PASSWORD_CHANGE_LOCK_MS),
    );
    expect(
      await prisma.auditEvent.count({
        where: {
          actorUserId: owner.userId,
          action: "password_change.failed",
          result: "DENIED",
        },
      }),
    ).toBe(5);
    expect(
      await prisma.auditEvent.count({
        where: {
          actorUserId: owner.userId,
          action: "password_change.locked",
          result: "DENIED",
        },
      }),
    ).toBe(1);
  });

  it("reports the lock until the exact expiry and successful clearing removes it", async () => {
    const repository = new PrismaPasswordChangeAttemptRepository();
    const locked = await repository.status(
      owner.userId,
      new Date(now.getTime() + PASSWORD_CHANGE_LOCK_MS - 1),
    );
    expect(locked).toMatchObject({
      locked: true,
      retryAfterSeconds: 1,
    });
    const expired = await repository.status(
      owner.userId,
      new Date(now.getTime() + PASSWORD_CHANGE_LOCK_MS + 10),
    );
    expect(expired.locked).toBe(false);
    await repository.clear(owner.userId);
    await expect(repository.status(owner.userId, now)).resolves.toEqual({
      locked: false,
      failureCount: 0,
    });
  });
});
