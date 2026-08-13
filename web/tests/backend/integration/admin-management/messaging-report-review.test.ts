import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/backend/database/prisma";
import { AdminMessagingReportReviewService } from "@/backend/admin/messaging-reports/admin-messaging-report-review-service";

const suffix = crypto.randomUUID();
const reporterId = `message-report-reporter-${suffix}`;
const targetId = `message-report-target-${suffix}`;
const adminId = `message-report-admin-${suffix}`;
const conversationId = `message-report-conversation-${suffix}`;
const evidenceId = `message-report-evidence-${suffix}`;
const otherMessageId = `message-report-other-${suffix}`;
const reportId = `message-report-${suffix}`;
const authority = {
  userId: adminId,
  sessionId: `session-${suffix}`,
  grantId: `grant-${suffix}`,
  proofAt: new Date(),
};

const account = (id: string, name: string) => ({
  id,
  name,
  email: `${id}@example.test`,
  normalizedEmail: `${id}@example.test`,
  emailVerified: true,
  state: "ACTIVE" as const,
});

describe("administrator messaging-report review", () => {
  beforeEach(async () => {
    await prisma.userAccount.createMany({
      data: [
        account(reporterId, "Reporting User"),
        account(targetId, "Reported User"),
        account(adminId, "Review Administrator"),
      ],
    });
    await prisma.messagingConversation.create({
      data: {
        id: conversationId,
        participantLowId: [reporterId, targetId].sort()[0]!,
        participantHighId: [reporterId, targetId].sort()[1]!,
        contextType: "PROFESSIONAL_CONNECTION",
        contextReference: `connection-${suffix}`,
      },
    });
    await prisma.messagingMessage.createMany({
      data: [
        {
          id: evidenceId,
          conversationId,
          sequence: 1,
          senderId: targetId,
          clientOperationId: `evidence-operation-${suffix}`,
          content: "Selected harmful evidence",
        },
        {
          id: otherMessageId,
          conversationId,
          sequence: 2,
          senderId: reporterId,
          clientOperationId: `other-operation-${suffix}`,
          content: "Conversation content that must stay hidden",
        },
      ],
    });
    await prisma.messagingReport.create({
      data: {
        id: reportId,
        reporterUserId: reporterId,
        targetUserId: targetId,
        conversationId,
        targetType: "CONVERSATION",
        evidenceMessageId: evidenceId,
        category: "ABUSE_OR_THREATS",
        normalizedDetail: "Private reporter context",
        unresolvedKey: `messaging-review-${suffix}`,
      },
    });
  });

  afterEach(async () => {
    await prisma.adminCommandReceipt.deleteMany({
      where: { targetReference: reportId },
    });
    await prisma.messagingReport.deleteMany({ where: { id: reportId } });
    await prisma.messagingMessage.deleteMany({ where: { conversationId } });
    await prisma.messagingConversation.deleteMany({ where: { id: conversationId } });
    await prisma.userAccount.deleteMany({
      where: { id: { in: [reporterId, targetId, adminId] } },
    });
  });

  it("keeps list metadata-only and returns exactly the selected evidence", async () => {
    const service = new AdminMessagingReportReviewService();
    const list = await service.list({ page: 1, perPage: 25, filter: {} });
    const item = list.data.find((candidate) => candidate.id === reportId);
    expect(item).toMatchObject({
      reporterDisplayName: "Reporting User",
      targetDisplayName: "Reported User",
      evidenceAvailable: true,
    });
    expect(item).not.toHaveProperty("detail");
    expect(item).not.toHaveProperty("content");
    expect(item).not.toHaveProperty("conversationId");

    const detail = await service.detail(reportId);
    expect(detail?.evidence?.content).toBe("Selected harmful evidence");
    expect(JSON.stringify(detail)).not.toContain(
      "Conversation content that must stay hidden",
    );
  });

  it("applies atomic versioned commands and exactly replays a receipt", async () => {
    const service = new AdminMessagingReportReviewService();
    const assignKey = crypto.randomUUID();
    const assigned = await service.execute(authority, reportId, "assign", {
      expectedVersion: 1,
      idempotencyKey: assignKey,
    });
    const replayed = await service.execute(authority, reportId, "assign", {
      expectedVersion: 1,
      idempotencyKey: assignKey,
    });
    expect(replayed).toMatchObject({
      version: assigned.version,
      state: assigned.state,
      assignedAdministratorId: adminId,
      replayed: true,
    });

    await service.execute(authority, reportId, "note", {
      expectedVersion: 2,
      idempotencyKey: crypto.randomUUID(),
      note: "  Reviewed <b>selected</b> evidence.  ",
    });
    await service.execute(authority, reportId, "resolve", {
      expectedVersion: 3,
      idempotencyKey: crypto.randomUUID(),
    });
    const row = await prisma.messagingReport.findUniqueOrThrow({
      where: { id: reportId },
      include: { reviewEvents: true, privateNotes: true },
    });
    expect(row).toMatchObject({
      state: "RESOLVED",
      version: 4,
      assignedAdminUserId: adminId,
      handledByAdminUserId: adminId,
      unresolvedKey: null,
    });
    expect(row.reviewEvents).toHaveLength(3);
    expect(row.privateNotes[0]?.normalizedText).toBe(
      "Reviewed selected evidence.",
    );
    await expect(
      service.execute(authority, reportId, "dismiss", {
        expectedVersion: 4,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toThrow("INVALID_STATE");
  });
});
