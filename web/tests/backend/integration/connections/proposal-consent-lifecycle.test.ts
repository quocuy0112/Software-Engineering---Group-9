import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/backend/database/prisma";
import { PrismaConnectionRepository } from "@/backend/repositories/connections/prisma-connection-repository";
import { canonicalParticipantPair } from "@/backend/messaging/ports/messaging-repository";

const prefixes: string[] = [];

async function fixture() {
  const prefix = `connection-${randomUUID()}`;
  prefixes.push(prefix);
  const adminId = `${prefix}-admin`;
  const firstId = `${prefix}-a`;
  const secondId = `${prefix}-b`;
  await prisma.userAccount.createMany({
    data: [
      {
        id: adminId,
        name: "Platform Admin",
        email: `${adminId}@example.test`,
        normalizedEmail: `${adminId}@example.test`,
        emailVerified: true,
        state: "ACTIVE",
      },
      {
        id: firstId,
        name: "First Participant",
        email: `${firstId}@example.test`,
        normalizedEmail: `${firstId}@example.test`,
        emailVerified: true,
        state: "ACTIVE",
      },
      {
        id: secondId,
        name: "Second Participant",
        email: `${secondId}@example.test`,
        normalizedEmail: `${secondId}@example.test`,
        emailVerified: true,
        state: "ACTIVE",
      },
    ],
  });
  return { prefix, adminId, firstId, secondId };
}

afterEach(async () => {
  for (const prefix of prefixes.splice(0)) {
    const users = await prisma.userAccount.findMany({
      where: { id: { startsWith: prefix } },
      select: { id: true },
    });
    const userIds = users.map((user) => user.id);
    const proposals = await prisma.professionalConnectionProposal.findMany({
      where: {
        OR: [
          { participantLowId: { in: userIds } },
          { participantHighId: { in: userIds } },
        ],
      },
      select: { id: true },
    });
    const proposalIds = proposals.map((proposal) => proposal.id);
    const connections = await prisma.professionalConnection.findMany({
      where: {
        OR: [
          { participantLowId: { in: userIds } },
          { participantHighId: { in: userIds } },
        ],
      },
      select: { id: true },
    });
    const connectionIds = connections.map((connection) => connection.id);
    await prisma.emailOutbox.deleteMany({
      where: {
        OR: [
          { userId: { in: userIds } },
          { professionalConnectionProposalId: { in: proposalIds } },
          { professionalConnectionId: { in: connectionIds } },
        ],
      },
    });
    await prisma.professionalConnectionNotification.deleteMany({
      where: { recipientUserId: { in: userIds } },
    });
    await prisma.messagingConversation.deleteMany({
      where: { professionalConnectionId: { in: connectionIds } },
    });
    await prisma.professionalConnection.deleteMany({
      where: { id: { in: connectionIds } },
    });
    await prisma.professionalConnectionProposal.deleteMany({
      where: { id: { in: proposalIds } },
    });
    await prisma.professionalConnectionCommandReceipt.deleteMany({
      where: { actorUserId: { in: userIds } },
    });
    await prisma.userMessagingBlock.deleteMany({
      where: {
        OR: [
          { blockerUserId: { in: userIds } },
          { blockedUserId: { in: userIds } },
        ],
      },
    });
    await prisma.userAccount.deleteMany({ where: { id: { in: userIds } } });
  }
});

describe("professional connection consent lifecycle", () => {
  it("creates no connection before two accepts, then archives on participant disconnect", async () => {
    const { adminId, firstId, secondId } = await fixture();
    const repository = new PrismaConnectionRepository();
    const now = new Date("2026-08-13T00:00:00.000Z");
    const created = await repository.runTransaction((transaction) =>
      transaction.createProposal({
        admin: { userId: adminId, sessionId: "admin-session" },
        participantAId: secondId,
        participantBId: firstId,
        reason: "Discuss a relevant professional engineering opportunity",
        expiryDays: 7,
        idempotencyKey: randomUUID(),
        now,
      }),
    );
    expect(created.data.state).toBe("PENDING_BOTH");
    expect(
      await prisma.professionalConnection.count({
        where: { sourceProposalId: created.data.id },
      }),
    ).toBe(0);

    const first = await repository.runTransaction((transaction) =>
      transaction.decideProposal({
        actor: { userId: firstId, sessionId: "first-session" },
        proposalId: created.data.id,
        decision: "ACCEPTED",
        expectedVersion: 1,
        idempotencyKey: randomUUID(),
        now: new Date(now.getTime() + 1_000),
      }),
    );
    expect(first.data.state).toBe("PARTIALLY_ACCEPTED");
    expect(
      await prisma.professionalConnection.count({
        where: { sourceProposalId: created.data.id },
      }),
    ).toBe(0);

    const second = await repository.runTransaction((transaction) =>
      transaction.decideProposal({
        actor: { userId: secondId, sessionId: "second-session" },
        proposalId: created.data.id,
        decision: "ACCEPTED",
        expectedVersion: 2,
        idempotencyKey: randomUUID(),
        now: new Date(now.getTime() + 2_000),
      }),
    );
    expect(second.data.state).toBe("ACCEPTED");
    expect(second.connectionId).toBeTruthy();
    expect(
      await prisma.professionalConnection.count({
        where: { sourceProposalId: created.data.id, state: "ACCEPTED" },
      }),
    ).toBe(1);

    const pair = canonicalParticipantPair(firstId, secondId);
    const conversation = await prisma.messagingConversation.create({
      data: {
        ...pair,
        contextType: "PROFESSIONAL_CONNECTION",
        contextReference: second.connectionId!,
        professionalConnectionId: second.connectionId,
        participants: { create: [{ userId: firstId }, { userId: secondId }] },
      },
    });
    const disconnected = await repository.runTransaction((transaction) =>
      transaction.disconnect({
        actor: { userId: firstId, sessionId: "first-session" },
        connectionId: second.connectionId!,
        expectedVersion: 1,
        idempotencyKey: randomUUID(),
        now: new Date(now.getTime() + 3_000),
      }),
    );
    expect(disconnected.data.state).toBe("REVOKED");
    expect(disconnected.conversationIds).toContain(conversation.id);
    expect(
      await prisma.messagingConversation.findUnique({
        where: { id: conversation.id },
        select: { archivedAt: true, archiveReason: true },
      }),
    ).toMatchObject({ archiveReason: "PROFESSIONAL_CONNECTION_REVOKED" });
  });

  it("serializes block creation and active proposal cancellation", async () => {
    const { adminId, firstId, secondId } = await fixture();
    const repository = new PrismaConnectionRepository();
    const created = await repository.runTransaction((transaction) =>
      transaction.createProposal({
        admin: { userId: adminId },
        participantAId: firstId,
        participantBId: secondId,
        reason: "Discuss a relevant professional engineering opportunity",
        expiryDays: 7,
        idempotencyKey: randomUUID(),
        now: new Date(),
      }),
    );
    const events = await repository.runTransaction((transaction) =>
      transaction.createBlockAndInvalidatePair({
        blockerUserId: firstId,
        blockedUserId: secondId,
        correlationId: randomUUID(),
        now: new Date(),
      }),
    );
    expect(events).toHaveLength(1);
    expect(
      (await repository.detailParticipant(created.data.id, firstId))?.state,
    ).toBe("CANCELLED");
    expect(
      await prisma.professionalConnection.count({
        where: { sourceProposalId: created.data.id },
      }),
    ).toBe(0);
  });

  it("suppresses ordinary detail at 90 days and irreversibly scrubs it at 365 days", async () => {
    const { adminId, firstId, secondId } = await fixture();
    const repository = new PrismaConnectionRepository();
    const createdAt = new Date("2025-01-01T00:00:00.000Z");
    const created = await repository.runTransaction((transaction) =>
      transaction.createProposal({
        admin: { userId: adminId },
        participantAId: firstId,
        participantBId: secondId,
        reason: "Discuss a retained professional engineering opportunity",
        expiryDays: 7,
        idempotencyKey: randomUUID(),
        now: createdAt,
      }),
    );
    const terminalAt = new Date(createdAt.getTime() + 1_000);
    const declined = await repository.runTransaction((transaction) =>
      transaction.decideProposal({
        actor: { userId: firstId },
        proposalId: created.data.id,
        decision: "DECLINED",
        expectedVersion: 1,
        idempotencyKey: randomUUID(),
        now: terminalAt,
      }),
    );
    expect(declined.data.reason).toContain("retained professional");

    const exactOrdinaryBoundary = new Date(
      terminalAt.getTime() + 90 * 24 * 60 * 60_000,
    );
    expect(
      (
        await repository.detailParticipant(
          created.data.id,
          firstId,
          exactOrdinaryBoundary,
        )
      )?.reason,
    ).toBeNull();
    expect(
      (await repository.detailAdmin(created.data.id, exactOrdinaryBoundary))
        ?.reason,
    ).toBeNull();

    const exactProtectedBoundary = new Date(
      terminalAt.getTime() + 365 * 24 * 60 * 60_000,
    );
    const purge = await repository.runTransaction((transaction) =>
      transaction.purgeDue(exactProtectedBoundary, 100),
    );
    expect(purge.proposalCount).toBe(1);
    const tombstone = await prisma.professionalConnectionProposal.findUnique({
      where: { id: created.data.id },
      select: {
        participantLowId: true,
        participantHighId: true,
        createdByAdminUserId: true,
        reason: true,
        protectedDeletedAt: true,
      },
    });
    expect(tombstone).toMatchObject({
      participantLowId: null,
      participantHighId: null,
      createdByAdminUserId: null,
      reason: null,
      protectedDeletedAt: exactProtectedBoundary,
    });
    await prisma.professionalConnectionProposal.delete({
      where: { id: created.data.id },
    });
  });
});
