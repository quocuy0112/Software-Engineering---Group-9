import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, verifyDatabaseConnectivity } from "@/backend/database/prisma";

const runId = randomUUID();
const ownerId = `profile-constraint-owner-${runId}`;
const secondOwnerId = `profile-constraint-second-${runId}`;
let profileId = "";

beforeAll(async () => {
  await verifyDatabaseConnectivity();
  await prisma.userAccount.createMany({
    data: [
      {
        id: ownerId,
        name: "Profile Constraint Owner",
        email: `profile-owner-${runId}@example.test`,
        normalizedEmail: `profile-owner-${runId}@example.test`,
        state: "ACTIVE",
      },
      {
        id: secondOwnerId,
        name: "Second Profile Constraint Owner",
        email: `profile-second-${runId}@example.test`,
        normalizedEmail: `profile-second-${runId}@example.test`,
        state: "ACTIVE",
      },
    ],
  });
  const ownerIdentity = await prisma.candidateIdentity.create({
    data: { userId: ownerId, profile: { create: {} } },
    include: { profile: true },
  });
  await prisma.candidateIdentity.create({
    data: { userId: secondOwnerId, profile: { create: {} } },
  });
  profileId = ownerIdentity.profile?.id ?? "";
});

afterAll(async () => {
  await prisma.emailChangeRequest.deleteMany({
    where: { userId: { in: [ownerId, secondOwnerId] } },
  });
  await prisma.accountPreferences.deleteMany({
    where: { userId: { in: [ownerId, secondOwnerId] } },
  });
  await prisma.skill.deleteMany({
    where: { normalizedName: `typescript-${runId}` },
  });
  await prisma.candidateIdentity.deleteMany({
    where: { userId: { in: [ownerId, secondOwnerId] } },
  });
  await prisma.userAccount.deleteMany({
    where: { id: { in: [ownerId, secondOwnerId] } },
  });
  await prisma.$disconnect();
});

describe("Feature 002 PostgreSQL invariants", () => {
  it("backfills exactly one profile for every pre-existing candidate identity", async () => {
    const missing = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count
      FROM "CandidateIdentity" identity
      LEFT JOIN "CandidateProfile" profile
        ON profile."candidateUserId" = identity."userId"
      WHERE profile."id" IS NULL
    `;
    expect(Number(missing[0]?.count)).toBe(0);
  });

  it("enforces one profile per candidate identity", async () => {
    await expect(
      prisma.candidateProfile.create({
        data: { candidateUserId: ownerId },
      }),
    ).rejects.toThrow();
  });

  it("enforces ordered-child uniqueness and position bounds", async () => {
    await prisma.profileExperience.create({
      data: {
        profileId,
        title: "Engineer",
        company: "SmartHire",
        startDate: new Date("2025-01-01T00:00:00.000Z"),
        isCurrent: true,
        position: 0,
      },
    });
    await expect(
      prisma.profileExperience.create({
        data: {
          profileId,
          title: "Duplicate position",
          company: "SmartHire",
          startDate: new Date("2025-02-01T00:00:00.000Z"),
          isCurrent: true,
          position: 0,
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.socialLink.create({
        data: {
          profileId,
          url: "https://example.test/out-of-range",
          normalizedUrl: "https://example.test/out-of-range",
          position: 10,
        },
      }),
    ).rejects.toThrow();
  });

  it("enforces one normalized skill and immutable security mail", async () => {
    const normalizedName = `typescript-${runId}`;
    await prisma.skill.create({
      data: { name: "TypeScript", normalizedName },
    });
    await expect(
      prisma.skill.create({
        data: { name: "TYPESCRIPT", normalizedName },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.accountPreferences.create({
        data: { userId: ownerId, accountSecurityEmail: false },
      }),
    ).rejects.toThrow();
  });

  it("preserves immutable outbox intents while retention cleanup nulls legacy relations", async () => {
    const cleanupOwnerId = `outbox-cleanup-owner-${runId}`;
    const tokenId = `outbox-cleanup-token-${runId}`;
    const outboxId = `outbox-cleanup-intent-${runId}`;
    const createdAt = new Date();
    await prisma.userAccount.create({
      data: {
        id: cleanupOwnerId,
        name: "Outbox Cleanup Owner",
        email: `outbox-cleanup-${runId}@example.test`,
        normalizedEmail: `outbox-cleanup-${runId}@example.test`,
        state: "ACTIVE",
      },
    });
    await prisma.securityToken.create({
      data: {
        id: tokenId,
        userId: cleanupOwnerId,
        purpose: "VERIFY_EMAIL",
        tokenDigest: `outbox-cleanup-digest-${runId}`,
        createdAt,
        expiresAt: new Date(createdAt.getTime() + 30 * 60_000),
        createdByRequestId: `outbox-cleanup-request-${runId}`,
      },
    });
    await prisma.emailOutbox.create({
      data: {
        id: outboxId,
        kind: "VERIFY_EMAIL",
        userId: cleanupOwnerId,
        securityTokenId: tokenId,
        recipientRef: cleanupOwnerId,
        templateVersion: "verify-email.v1",
        payloadRef: { source: "constraint-regression" },
        idempotencyKey: `outbox-cleanup-${runId}`,
      },
    });

    try {
      await expect(
        prisma.emailOutbox.update({
          where: { id: outboxId },
          data: { userId: ownerId },
        }),
      ).rejects.toThrow(/delivery envelope is immutable/i);

      await prisma.securityToken.delete({ where: { id: tokenId } });
      await prisma.userAccount.delete({ where: { id: cleanupOwnerId } });
      const retained = await prisma.emailOutbox.findUniqueOrThrow({
        where: { id: outboxId },
      });
      expect(retained).toMatchObject({
        userId: null,
        securityTokenId: null,
        recipientRef: cleanupOwnerId,
        idempotencyKey: `outbox-cleanup-${runId}`,
      });
    } finally {
      await prisma.emailOutbox.deleteMany({ where: { id: outboxId } });
      await prisma.securityToken.deleteMany({ where: { id: tokenId } });
      await prisma.userAccount.deleteMany({ where: { id: cleanupOwnerId } });
    }
  });

  it("allows at most one pending request per user and proposed email", async () => {
    const proposed = `reserved-${runId}@example.test`;
    const createdAt = new Date();
    await prisma.emailChangeRequest.create({
      data: {
        userId: ownerId,
        proposedEmail: proposed,
        normalizedProposedEmail: proposed,
        tokenDigest: `digest-a-${runId}`,
        createdAt,
        expiresAt: new Date(createdAt.getTime() + 30 * 60_000),
        idempotencyKey: `request-a-${runId}`,
        correlationId: `correlation-a-${runId}`,
        createdBySessionId: `session-a-${runId}`,
      },
    });
    await expect(
      prisma.emailChangeRequest.create({
        data: {
          userId: ownerId,
          proposedEmail: `other-${runId}@example.test`,
          normalizedProposedEmail: `other-${runId}@example.test`,
          tokenDigest: `digest-b-${runId}`,
          createdAt,
          expiresAt: new Date(createdAt.getTime() + 30 * 60_000),
          idempotencyKey: `request-b-${runId}`,
          correlationId: `correlation-b-${runId}`,
          createdBySessionId: `session-b-${runId}`,
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.emailChangeRequest.create({
        data: {
          userId: secondOwnerId,
          proposedEmail: proposed,
          normalizedProposedEmail: proposed,
          tokenDigest: `digest-c-${runId}`,
          createdAt,
          expiresAt: new Date(createdAt.getTime() + 30 * 60_000),
          idempotencyKey: `request-c-${runId}`,
          correlationId: `correlation-c-${runId}`,
          createdBySessionId: `session-c-${runId}`,
        },
      }),
    ).rejects.toThrow();
  });

  it("rolls back an incomplete aggregate transaction", async () => {
    const normalizedUrl = `https://example.test/${runId}/rollback`;
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.socialLink.create({
          data: {
            profileId,
            url: normalizedUrl,
            normalizedUrl,
            position: 1,
          },
        });
        throw new Error("force rollback");
      }),
    ).rejects.toThrow("force rollback");
    expect(await prisma.socialLink.count({ where: { normalizedUrl } })).toBe(0);
  });
});
