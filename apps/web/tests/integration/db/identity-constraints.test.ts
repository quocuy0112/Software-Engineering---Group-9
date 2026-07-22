import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, verifyDatabaseConnectivity } from "@/lib/db/prisma";

const runId = randomUUID();
const userId = `constraint-user-${runId}`;
const secondUserId = `constraint-user-2-${runId}`;

beforeAll(async () => {
  await verifyDatabaseConnectivity();
  await prisma.userAccount.createMany({
    data: [
      {
        id: userId,
        name: "Constraint User",
        email: `${runId}@example.test`,
        normalizedEmail: `${runId}@example.test`,
        state: "ACTIVE",
      },
      {
        id: secondUserId,
        name: "Second User",
        email: `second-${runId}@example.test`,
        normalizedEmail: `second-${runId}@example.test`,
        state: "ACTIVE",
      },
    ],
  });
});

afterAll(async () => {
  await prisma.emailOutbox.deleteMany({
    where: { idempotencyKey: { contains: runId } },
  });
  await prisma.authenticationChallenge.deleteMany({
    where: { userId: { in: [userId, secondUserId] } },
  });
  await prisma.securityToken.deleteMany({
    where: { userId: { in: [userId, secondUserId] } },
  });
  await prisma.session.deleteMany({
    where: { userId: { in: [userId, secondUserId] } },
  });
  await prisma.authProviderAccount.deleteMany({
    where: { userId: { in: [userId, secondUserId] } },
  });
  await prisma.candidateIdentity.deleteMany({
    where: { userId: { in: [userId, secondUserId] } },
  });
  await prisma.userAccount.deleteMany({
    where: { id: { in: [userId, secondUserId] } },
  });
  await prisma.$disconnect();
});

describe("PostgreSQL identity invariants", () => {
  it("reaches Compose PostgreSQL through the generated client", async () => {
    await expect(verifyDatabaseConnectivity()).resolves.toBeUndefined();
  });

  it("rejects duplicate normalized email and duplicate Candidate identity", async () => {
    await expect(
      prisma.userAccount.create({
        data: {
          id: `duplicate-${runId}`,
          name: "Duplicate",
          email: `unique-${runId}@example.test`,
          normalizedEmail: `${runId}@example.test`,
        },
      }),
    ).rejects.toThrow();
    await prisma.candidateIdentity.create({ data: { userId } });
    await expect(
      prisma.candidateIdentity.create({ data: { userId } }),
    ).rejects.toThrow();
  });

  it("rejects duplicate provider identities, session tokens, and outbox keys", async () => {
    await prisma.authProviderAccount.create({
      data: {
        id: `account-1-${runId}`,
        accountId: `credential-${runId}`,
        providerId: "credential",
        userId,
      },
    });
    await expect(
      prisma.authProviderAccount.create({
        data: {
          id: `account-2-${runId}`,
          accountId: `credential-${runId}`,
          providerId: "credential",
          userId: secondUserId,
        },
      }),
    ).rejects.toThrow();
    const now = new Date();
    const expiry = new Date(now.getTime() + 60_000);
    await prisma.session.create({
      data: {
        id: `session-1-${runId}`,
        token: `token-${runId}`,
        userId,
        expiresAt: expiry,
        absoluteExpiresAt: expiry,
      },
    });
    await expect(
      prisma.session.create({
        data: {
          id: `session-2-${runId}`,
          token: `token-${runId}`,
          userId,
          expiresAt: expiry,
          absoluteExpiresAt: expiry,
        },
      }),
    ).rejects.toThrow();
    await prisma.emailOutbox.create({
      data: {
        kind: "SECURITY_ALERT",
        idempotencyKey: `outbox-${runId}`,
        recipientRef: userId,
        templateVersion: "1",
        payloadRef: {},
      },
    });
    await expect(
      prisma.emailOutbox.create({
        data: {
          kind: "SECURITY_ALERT",
          idempotencyKey: `outbox-${runId}`,
          recipientRef: userId,
          templateVersion: "1",
          payloadRef: {},
        },
      }),
    ).rejects.toThrow();
  });

  it("enforces account-state, expiry, attempt, and nonnegative checks", async () => {
    await expect(
      prisma.userAccount.update({
        where: { id: userId },
        data: { state: "DELETED" },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.session.create({
        data: {
          id: `bad-session-${runId}`,
          token: `bad-token-${runId}`,
          userId,
          expiresAt: new Date(0),
          absoluteExpiresAt: new Date(0),
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.authenticationChallenge.create({
        data: {
          userId,
          handleDigest: `challenge-${runId}`,
          purpose: "RECENT_AUTH",
          expiresAt: new Date(Date.now() + 60_000),
          attemptCount: 6,
          maxAttempts: 5,
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.rateLimitBucket.create({
        data: {
          scope: "login",
          subjectDigest: runId,
          windowStart: new Date(),
          count: -1,
        },
      }),
    ).rejects.toThrow();
  });

  it("allows only one concurrent active token per user and purpose", async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    const results = await Promise.allSettled(
      [1, 2].map((number) =>
        prisma.securityToken.create({
          data: {
            userId,
            purpose: "VERIFY_EMAIL",
            tokenDigest: `digest-${number}-${runId}`,
            expiresAt,
            createdByRequestId: `request-${number}-${runId}`,
          },
        }),
      ),
    );
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
  });

  it("prevents AuditEvent update and delete", async () => {
    const id = `audit-${runId}`;
    await prisma.auditEvent.create({
      data: {
        id,
        actorType: "SYSTEM",
        action: "compatibility.test",
        targetType: "Database",
        result: "SUCCESS",
        correlationId: runId,
        context: {},
      },
    });
    await expect(
      prisma.auditEvent.update({ where: { id }, data: { action: "mutated" } }),
    ).rejects.toThrow(/append-only/);
    await expect(prisma.auditEvent.delete({ where: { id } })).rejects.toThrow(
      /append-only/,
    );
  });
});
