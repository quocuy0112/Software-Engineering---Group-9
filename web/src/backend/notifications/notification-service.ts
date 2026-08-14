import "server-only";
import type { Prisma, PrismaClient } from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";
import {
  buildNotification,
  type NotificationEventInput,
} from "@/backend/notifications/event-policy";
import { NotificationError } from "@/backend/notifications/notification-errors";
import { PrismaNotificationRepository } from "@/backend/repositories/notifications/prisma-notification-repository";
import type {
  NotificationCategory,
  NotificationContextType,
  NotificationItem,
} from "@/shared/contracts/notifications";
import { emitNotificationOperation } from "@/backend/notifications/notification-operations";

type NotificationDb = PrismaClient | Prisma.TransactionClient;

const toItem = (row: {
  id: string;
  kind: NotificationItem["kind"];
  category: NotificationItem["category"];
  severity: NotificationItem["severity"];
  title: string;
  summary: string;
  href: string | null;
  contextType: NotificationItem["contextType"];
  contextId: string | null;
  occurrenceCount: number;
  readAt: Date | null;
  createdAt: Date;
  lastOccurredAt: Date;
  expiresAt: Date;
}): NotificationItem => ({
  ...row,
  readAt: row.readAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  lastOccurredAt: row.lastOccurredAt.toISOString(),
  expiresAt: row.expiresAt.toISOString(),
});

export async function createInAppNotification(
  db: NotificationDb,
  input: NotificationEventInput,
) {
  const startedAt = performance.now();
  try {
    const preferences = await db.accountPreferences.findUnique({
      where: { userId: input.recipientUserId },
      select: { language: true },
    });
    const built = buildNotification(input, preferences?.language ?? "VI");
    const result = await new PrismaNotificationRepository(db).create({
      ...built,
      recipientUserId: input.recipientUserId,
    });
    emitNotificationOperation({
      operation: "create",
      outcome: "success",
      correlationId: input.correlationId,
      durationMs: performance.now() - startedAt,
      affectedCount: 1,
    });
    return result;
  } catch (error) {
    emitNotificationOperation({
      operation: "create",
      outcome: "failure",
      correlationId: input.correlationId,
      durationMs: performance.now() - startedAt,
      errorCode:
        error instanceof NotificationError
          ? error.code
          : "NOTIFICATION_OPERATION_FAILED",
    });
    throw error;
  }
}

export class NotificationService {
  constructor(
    private readonly repository = new PrismaNotificationRepository(prisma),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(
    recipientUserId: string,
    input: {
      cursor?: string;
      limit: number;
      state: "all" | "unread" | "read";
      category?: NotificationCategory;
    },
  ) {
    const observedAt = this.now();
    const [page, unreadCount] = await Promise.all([
      this.repository.list({ recipientUserId, ...input, now: observedAt }),
      this.repository.unreadCount(recipientUserId, observedAt),
    ]);
    return {
      items: page.items.map(toItem),
      nextCursor: page.nextCursor,
      unreadCount,
      observedAt: observedAt.toISOString(),
    };
  }

  async unreadCount(recipientUserId: string) {
    const observedAt = this.now();
    return {
      unreadCount: await this.repository.unreadCount(
        recipientUserId,
        observedAt,
      ),
      observedAt: observedAt.toISOString(),
    };
  }

  async markRead(recipientUserId: string, notificationId: string) {
    const observedAt = this.now();
    const changed = await this.repository.markRead(
      recipientUserId,
      notificationId,
      observedAt,
    );
    if (
      changed.count === 0 &&
      !(await this.repository.hasAvailable(
        recipientUserId,
        notificationId,
        observedAt,
      ))
    ) {
      throw new NotificationError("NOTIFICATION_UNAVAILABLE", 404);
    }
    return this.readResult(recipientUserId, changed.count, observedAt);
  }

  async markAllRead(recipientUserId: string) {
    const observedAt = this.now();
    const changed = await this.repository.markAllRead(
      recipientUserId,
      observedAt,
    );
    return this.readResult(recipientUserId, changed.count, observedAt);
  }

  async markContextRead(
    recipientUserId: string,
    contextType: NotificationContextType,
    contextId: string,
  ) {
    const observedAt = this.now();
    if (contextType === "CONVERSATION") {
      const changedCount = await prisma.$transaction(async (tx) => {
        const conversation = await tx.messagingConversation.findFirst({
          where: {
            id: contextId,
            participants: { some: { userId: recipientUserId } },
          },
          select: { lastMessageSequence: true },
        });
        if (conversation) {
          const lastMessageSequence = conversation.lastMessageSequence ?? 0;
          await tx.messagingConversationParticipant.updateMany({
            where: {
              conversationId: contextId,
              userId: recipientUserId,
              lastReadSequence: { lt: lastMessageSequence },
            },
            data: {
              lastReadSequence: lastMessageSequence,
              lastReadAt: observedAt,
            },
          });
        }
        const changed = await new PrismaNotificationRepository(
          tx,
        ).markContextRead(
          recipientUserId,
          contextType,
          contextId,
          observedAt,
        );
        return changed.count;
      });
      return this.readResult(recipientUserId, changedCount, observedAt);
    }
    const changed = await this.repository.markContextRead(
      recipientUserId,
      contextType,
      contextId,
      observedAt,
    );
    return this.readResult(recipientUserId, changed.count, observedAt);
  }

  private async readResult(
    recipientUserId: string,
    changedCount: number,
    observedAt: Date,
  ) {
    return {
      changedCount,
      unreadCount: await this.repository.unreadCount(
        recipientUserId,
        observedAt,
      ),
      observedAt: observedAt.toISOString(),
    };
  }
}
