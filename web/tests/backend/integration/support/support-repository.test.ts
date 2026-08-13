import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/backend/database/prisma";
import { PrismaSupportRepository } from "@/backend/repositories/support/prisma-support-repository";

const prefixes: string[] = [];

async function fixture() {
  const prefix = `support-${randomUUID()}`;
  prefixes.push(prefix);
  const requesterId = `${prefix}-requester`;
  const adminAId = `${prefix}-admin-a`;
  const adminBId = `${prefix}-admin-b`;
  await prisma.userAccount.createMany({
    data: [
      {
        id: requesterId,
        name: "Support Requester",
        email: `${requesterId}@example.test`,
        normalizedEmail: `${requesterId}@example.test`,
        emailVerified: true,
        state: "ACTIVE",
      },
      {
        id: adminAId,
        name: "Support Admin A",
        email: `${adminAId}@example.test`,
        normalizedEmail: `${adminAId}@example.test`,
        emailVerified: true,
        state: "ACTIVE",
      },
      {
        id: adminBId,
        name: "Support Admin B",
        email: `${adminBId}@example.test`,
        normalizedEmail: `${adminBId}@example.test`,
        emailVerified: true,
        state: "ACTIVE",
      },
    ],
  });
  await prisma.platformAdministratorGrant.createMany({
    data: [{ userId: adminAId }, { userId: adminBId }],
  });
  return { prefix, requesterId, adminAId, adminBId };
}

afterEach(async () => {
  for (const prefix of prefixes.splice(0)) {
    const cases = await prisma.supportConversation.findMany({
      where: { requesterUserId: { startsWith: prefix } },
      select: { id: true },
    });
    const caseIds = cases.map((item) => item.id);
    await prisma.emailOutbox.deleteMany({
      where: { supportConversationId: { in: caseIds } },
    });
    await prisma.supportConversation.deleteMany({
      where: { id: { in: caseIds } },
    });
    await prisma.platformAdministratorGrant.deleteMany({
      where: { userId: { startsWith: prefix } },
    });
    await prisma.userAccount.deleteMany({
      where: { id: { startsWith: prefix } },
    });
  }
});

describe("PrismaSupportRepository", () => {
  it("creates one idempotent case and redacts administrator identity", async () => {
    const { requesterId } = await fixture();
    const repository = new PrismaSupportRepository();
    const operationId = randomUUID();
    const create = () =>
      repository.runTransaction((tx) =>
        tx.createRequesterCase({
          userId: requesterId,
          category: "MESSAGING",
          subject: "Cannot send messages",
          message: "Please help with messaging.",
          clientOperationId: operationId,
          now: new Date("2026-08-13T00:00:00.000Z"),
        }),
      );
    const first = await create();
    const replay = await create();
    expect(first.deduplicated).toBe(false);
    expect(replay.deduplicated).toBe(true);
    expect(replay.detail.id).toBe(first.detail.id);
    expect(first.detail.correspondent).toBe("SmartHire Support");
    expect(first.detail).not.toHaveProperty("currentAssigneeUserId");
    expect(
      await prisma.supportConversation.count({
        where: { requesterUserId: requesterId },
      }),
    ).toBe(1);
  });

  it("permits one race winner, replies, resolves, and reopens", async () => {
    const { requesterId, adminAId, adminBId } = await fixture();
    const repository = new PrismaSupportRepository();
    const created = await repository.runTransaction((tx) =>
      tx.createRequesterCase({
        userId: requesterId,
        category: "ACCOUNT_ACCESS",
        subject: "Account access issue",
        message: "I cannot update my account.",
        clientOperationId: randomUUID(),
        now: new Date("2026-08-13T00:00:00.000Z"),
      }),
    );
    const claims = await Promise.allSettled([
      repository.runTransaction((tx) =>
        tx.claim({
          caseId: created.detail.id,
          adminUserId: adminAId,
          expectedVersion: 1,
          now: new Date("2026-08-13T00:01:00.000Z"),
        }),
      ),
      repository.runTransaction((tx) =>
        tx.claim({
          caseId: created.detail.id,
          adminUserId: adminBId,
          expectedVersion: 1,
          now: new Date("2026-08-13T00:01:00.000Z"),
        }),
      ),
    ]);
    expect(claims.filter((item) => item.status === "fulfilled")).toHaveLength(
      1,
    );
    const current = await prisma.supportConversation.findUniqueOrThrow({
      where: { id: created.detail.id },
    });
    const assignee = current.currentAssigneeUserId!;
    const replied = await repository.runTransaction((tx) =>
      tx.reply({
        caseId: current.id,
        adminUserId: assignee,
        content: "We restored the affected workflow.",
        clientOperationId: randomUUID(),
        expectedVersion: 2,
        now: new Date("2026-08-13T00:02:00.000Z"),
      }),
    );
    expect(replied.detail.state).toBe("WAITING_FOR_USER");
    const requesterDetail = await repository.detailRequester(
      current.id,
      requesterId,
    );
    expect(requesterDetail?.messages.at(-1)?.author).toBe("SMART_HIRE_SUPPORT");
    expect(requesterDetail).not.toHaveProperty("currentAssigneeUserId");
    await repository.runTransaction((tx) =>
      tx.transition({
        caseId: current.id,
        adminUserId: assignee,
        action: "resolve",
        expectedVersion: 3,
        now: new Date("2026-08-13T00:03:00.000Z"),
      }),
    );
    const reopened = await repository.runTransaction((tx) =>
      tx.sendRequesterMessage({
        caseId: current.id,
        userId: requesterId,
        content: "Thank you, one more question.",
        clientOperationId: randomUUID(),
        expectedVersion: 4,
        now: new Date("2026-08-14T00:00:00.000Z"),
      }),
    );
    expect(reopened.detail.state).toBe("WAITING_FOR_SUPPORT");
    expect(
      await prisma.supportAssignment.count({
        where: { conversationId: current.id, endedAt: null },
      }),
    ).toBe(1);
  });

  it("auto-closes and deletes content atomically after retention", async () => {
    const { requesterId, adminAId } = await fixture();
    const repository = new PrismaSupportRepository();
    const created = await repository.runTransaction((tx) =>
      tx.createRequesterCase({
        userId: requesterId,
        category: "PRIVACY_SAFETY",
        subject: "Privacy question",
        message: "How is support content retained?",
        clientOperationId: randomUUID(),
        now: new Date("2025-08-01T00:00:00.000Z"),
      }),
    );
    await repository.runTransaction((tx) =>
      tx.claim({
        caseId: created.detail.id,
        adminUserId: adminAId,
        expectedVersion: 1,
        now: new Date("2025-08-01T00:01:00.000Z"),
      }),
    );
    await repository.runTransaction((tx) =>
      tx.transition({
        caseId: created.detail.id,
        adminUserId: adminAId,
        action: "resolve",
        expectedVersion: 2,
        now: new Date("2025-08-01T00:02:00.000Z"),
      }),
    );
    expect(
      (await repository.closeDue(new Date("2025-08-09T00:00:00.000Z"))).closed,
    ).toBe(1);
    await prisma.supportConversation.update({
      where: { id: created.detail.id },
      data: { contentDeleteAfter: new Date("2026-08-01T00:00:00.000Z") },
    });
    const inaccessible = await repository.detailRequester(
      created.detail.id,
      requesterId,
    );
    expect(inaccessible?.contentAvailable).toBe(false);
    expect(inaccessible?.messages).toEqual([]);
    expect(
      (await repository.purgeDueContent(new Date("2026-08-02T00:00:00.000Z")))
        .purged,
    ).toBe(1);
    const after = await repository.detailRequester(
      created.detail.id,
      requesterId,
    );
    expect(after?.contentAvailable).toBe(false);
    expect(after?.messages).toEqual([]);
    expect(
      await prisma.supportMessage.count({
        where: { conversationId: created.detail.id },
      }),
    ).toBe(0);
  });
});
