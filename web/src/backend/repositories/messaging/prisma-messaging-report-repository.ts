import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";
import { MessagingError, unavailableConversation } from "@/backend/messaging/messaging-errors";
import type { MessagingReportInput } from "@/shared/contracts/messaging/safety";
import { createInAppNotification } from "@/backend/notifications/notification-service";

const REPORT_WINDOW_MS = 24 * 60 * 60 * 1_000;
const REPORT_QUOTA = 10;

function reportKey(input: {
  reporterUserId: string;
  conversationId: string;
  targetUserId: string;
  targetType: string;
  category: string;
}) {
  return createHash("sha256")
    .update(
      [
        input.reporterUserId,
        input.conversationId,
        input.targetUserId,
        input.targetType,
        input.category,
      ].join("\0"),
    )
    .digest("hex");
}

export class PrismaMessagingReportRepository {
  constructor(private readonly db: typeof prisma = prisma) {}

  async submit(input: MessagingReportInput & { reporterUserId: string; now: Date }) {
    const threshold = new Date(input.now.getTime() - REPORT_WINDOW_MS);
    const unresolvedKey = reportKey(input);
    try {
      return await this.db.$transaction(
        async (tx) => {
          const conversation = await tx.messagingConversation.findFirst({
            where: {
              id: input.conversationId,
              participants: { some: { userId: input.reporterUserId } },
            },
            select: { participantLowId: true, participantHighId: true },
          });
          if (!conversation) throw unavailableConversation();
          const expectedTarget =
            conversation.participantLowId === input.reporterUserId
              ? conversation.participantHighId
              : conversation.participantLowId;
          if (expectedTarget !== input.targetUserId) throw unavailableConversation();

          if (input.evidenceMessageId) {
            const evidence = await tx.messagingMessage.findFirst({
              where: {
                id: input.evidenceMessageId,
                conversationId: input.conversationId,
              },
              select: { id: true },
            });
            if (!evidence) throw unavailableConversation();
          }

          const duplicate = await tx.messagingReport.findFirst({
            where: {
              reporterUserId: input.reporterUserId,
              conversationId: input.conversationId,
              targetUserId: input.targetUserId,
              targetType: input.targetType,
              category: input.category,
              state: "PENDING_REVIEW",
              createdAt: { gte: threshold },
            },
            select: { id: true },
          });
          if (duplicate) return { reportId: duplicate.id, deduplicated: true };

          const count = await tx.messagingReport.count({
            where: {
              reporterUserId: input.reporterUserId,
              createdAt: { gte: threshold },
            },
          });
          if (count >= REPORT_QUOTA) {
            throw new MessagingError("RATE_LIMITED", 429, false, 24 * 60 * 60);
          }

          await tx.messagingReport.updateMany({
            where: { unresolvedKey, createdAt: { lt: threshold } },
            data: { unresolvedKey: null },
          });
          const report = await tx.messagingReport.create({
            data: {
              reporterUserId: input.reporterUserId,
              targetUserId: input.targetUserId,
              conversationId: input.conversationId,
              targetType: input.targetType,
              evidenceMessageId: input.evidenceMessageId ?? null,
              category: input.category,
              normalizedDetail: input.detail || null,
              unresolvedKey,
              createdAt: input.now,
            },
            select: { id: true },
          });
          await createInAppNotification(tx, {
            recipientUserId: input.reporterUserId,
            kind: "MESSAGE_REPORT_RECEIVED",
            deduplicationKey: `messaging-report:${report.id}:received`,
            correlationId: report.id,
            occurredAt: input.now,
            contextType: "MESSAGING_REPORT",
            contextId: report.id,
          });
          return { reportId: report.id, deduplicated: false };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await this.db.messagingReport.findUnique({
          where: { unresolvedKey },
          select: { id: true },
        });
        if (existing) return { reportId: existing.id, deduplicated: true };
      }
      throw error;
    }
  }
}
