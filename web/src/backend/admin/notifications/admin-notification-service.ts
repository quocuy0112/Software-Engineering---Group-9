import "server-only";

import type { Prisma } from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";
import { NotificationService } from "@/backend/notifications/notification-service";
import { PrismaNotificationRepository } from "@/backend/repositories/notifications/prisma-notification-repository";
import { renderNotificationCopy } from "@/backend/notifications/event-policy";
import {
  notificationItemSchema,
  type NotificationCategory,
  type NotificationItem,
} from "@/shared/contracts/notifications";

const notificationSelect = {
  id: true,
  kind: true,
  category: true,
  severity: true,
  title: true,
  summary: true,
  variables: true,
  href: true,
  contextType: true,
  contextId: true,
  occurrenceCount: true,
  readAt: true,
  createdAt: true,
  lastOccurredAt: true,
  expiresAt: true,
} satisfies Prisma.InAppNotificationSelect;

type NotificationRow = Prisma.InAppNotificationGetPayload<{
  select: typeof notificationSelect;
}>;

const toItem = (row: NotificationRow): NotificationItem => {
  const { variables, ...publicRow } = row;
  return notificationItemSchema.parse({
    ...publicRow,
    ...renderNotificationCopy(row.kind, variables, "EN"),
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    lastOccurredAt: row.lastOccurredAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  });
};

export class AdminNotificationService {
  constructor(
    private readonly notifications = new NotificationService(
      new PrismaNotificationRepository(prisma, "ALL"),
    ),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(
    recipientUserId: string,
    input: {
      page: number;
      perPage: number;
      state: "all" | "unread" | "read";
      category?: NotificationCategory;
    },
  ) {
    const observedAt = this.now();
    const where: Prisma.InAppNotificationWhereInput = {
      recipientUserId,
      expiresAt: { gt: observedAt },
      ...(input.category ? { category: input.category } : {}),
      ...(input.state === "unread"
        ? { readAt: null }
        : input.state === "read"
          ? { readAt: { not: null } }
          : {}),
    };
    const [rows, total, unreadCount] = await prisma.$transaction([
      prisma.inAppNotification.findMany({
        where,
        select: notificationSelect,
        orderBy: [{ lastOccurredAt: "desc" }, { id: "desc" }],
        skip: (input.page - 1) * input.perPage,
        take: input.perPage,
      }),
      prisma.inAppNotification.count({ where }),
      prisma.inAppNotification.count({
        where: {
          recipientUserId,
          readAt: null,
          expiresAt: { gt: observedAt },
        },
      }),
    ]);
    return {
      data: rows.map(toItem),
      total,
      meta: { unreadCount, observedAt: observedAt.toISOString() },
    };
  }

  markRead(recipientUserId: string, notificationId: string) {
    return this.notifications.markRead(recipientUserId, notificationId);
  }

  markAllRead(recipientUserId: string) {
    return this.notifications.markAllRead(recipientUserId);
  }
}
