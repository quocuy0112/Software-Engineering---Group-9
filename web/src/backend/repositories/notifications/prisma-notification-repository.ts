import "server-only";
import type { Prisma, PrismaClient } from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";
import type { BuiltNotification } from "@/backend/notifications/event-policy";
import type { NotificationCategory } from "@/shared/contracts/notifications";
import { NotificationError } from "@/backend/notifications/notification-errors";

type NotificationDb = PrismaClient | Prisma.TransactionClient;
const retentionMs = 90 * 24 * 60 * 60 * 1000;

type Cursor = { at: string; id: string };
const encodeCursor = (value: Cursor) =>
  Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
const decodeCursor = (value?: string): Cursor | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Partial<Cursor>;
    if (
      typeof parsed.at !== "string" ||
      typeof parsed.id !== "string" ||
      parsed.id.length > 128 ||
      Number.isNaN(new Date(parsed.at).getTime())
    )
      throw new Error();
    return { at: parsed.at, id: parsed.id };
  } catch {
    throw new NotificationError("INVALID_REQUEST", 400);
  }
};

export class PrismaNotificationRepository {
  constructor(
    private readonly db: NotificationDb = prisma,
    private readonly audienceScope: "USER" | "ALL" = "USER",
  ) {}

  private audienceWhere(): Prisma.InAppNotificationWhereInput {
    return this.audienceScope === "ALL" ? {} : { audience: "USER" };
  }

  async create(input: BuiltNotification & { recipientUserId: string }) {
    const expiresAt = new Date(input.occurredAt.getTime() + retentionMs);
    if (!input.groupable) {
      return this.db.inAppNotification.upsert({
        where: { deduplicationKey: input.deduplicationKey },
        update: {},
        create: {
          recipientUserId: input.recipientUserId,
          kind: input.kind,
          category: input.category,
          severity: input.severity,
          audience: input.audience,
          recipientRole: input.recipientRole ?? "CANDIDATE",
          title: input.title,
          summary: input.summary,
          variables: input.variables ?? {},
          href: input.href,
          contextType: input.contextType,
          contextId: input.contextId,
          deduplicationKey: input.deduplicationKey,
          correlationId: input.correlationId,
          expiresAt,
          createdAt: input.occurredAt,
          lastOccurredAt: input.occurredAt,
        },
      });
    }
    const existing = await this.db.inAppNotification.findUnique({
      where: { deduplicationKey: input.deduplicationKey },
      select: { id: true, readAt: true },
    });
    if (!existing) {
      return this.db.inAppNotification.create({
        data: {
          recipientUserId: input.recipientUserId,
          kind: input.kind,
          category: input.category,
          severity: input.severity,
          audience: input.audience,
          recipientRole: input.recipientRole ?? "CANDIDATE",
          title: input.title,
          summary: input.summary,
          variables: input.variables ?? {},
          href: input.href,
          contextType: input.contextType,
          contextId: input.contextId,
          deduplicationKey: input.deduplicationKey,
          correlationId: input.correlationId,
          expiresAt,
          createdAt: input.occurredAt,
          lastOccurredAt: input.occurredAt,
        },
      });
    }
    if (existing.readAt) {
      return this.db.inAppNotification.update({
        where: { id: existing.id },
        data: {
          readAt: null,
          occurrenceCount: 1,
          correlationId: input.correlationId,
          title: input.title,
          summary: input.summary,
          variables: input.variables ?? {},
          lastOccurredAt: input.occurredAt,
          expiresAt,
        },
      });
    }
    return this.db.inAppNotification.update({
      where: { id: existing.id },
      data: {
        occurrenceCount: { increment: 1 },
        variables: input.variables ?? {},
        summary: input.summary,
        lastOccurredAt: input.occurredAt,
      },
    });
  }

  async language(recipientUserId: string) {
    const preferences = await this.db.accountPreferences.findUnique({
      where: { userId: recipientUserId },
      select: { language: true },
    });
    return preferences?.language ?? null;
  }

  async list(input: {
    recipientUserId: string;
    cursor?: string;
    limit: number;
    state: "all" | "unread" | "read";
    category?: NotificationCategory;
    now: Date;
  }) {
    const cursor = decodeCursor(input.cursor);
    const where: Prisma.InAppNotificationWhereInput = {
      ...this.audienceWhere(),
      recipientUserId: input.recipientUserId,
      expiresAt: { gt: input.now },
      ...(input.category ? { category: input.category } : {}),
      ...(input.state === "unread"
        ? { readAt: null }
        : input.state === "read"
          ? { readAt: { not: null } }
          : {}),
      ...(cursor
        ? {
            OR: [
              { lastOccurredAt: { lt: new Date(cursor.at) } },
              {
                lastOccurredAt: new Date(cursor.at),
                id: { lt: cursor.id },
              },
            ],
          }
        : {}),
    };
    const rows = await this.db.inAppNotification.findMany({
      where,
      orderBy: [{ lastOccurredAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
    });
    const hasMore = rows.length > input.limit;
    const items = hasMore ? rows.slice(0, input.limit) : rows;
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        hasMore && last
          ? encodeCursor({ at: last.lastOccurredAt.toISOString(), id: last.id })
          : null,
    };
  }

  unreadCount(recipientUserId: string, now: Date) {
    return this.db.inAppNotification.count({
      where: {
        ...this.audienceWhere(),
        recipientUserId,
        readAt: null,
        expiresAt: { gt: now },
      },
    });
  }

  markRead(recipientUserId: string, notificationId: string, now: Date) {
    return this.db.inAppNotification.updateMany({
      where: {
        ...this.audienceWhere(),
        id: notificationId,
        recipientUserId,
        readAt: null,
        expiresAt: { gt: now },
      },
      data: { readAt: now },
    });
  }

  hasAvailable(recipientUserId: string, notificationId: string, now: Date) {
    return this.db.inAppNotification.findFirst({
      where: {
        ...this.audienceWhere(),
        id: notificationId,
        recipientUserId,
        expiresAt: { gt: now },
      },
      select: { id: true },
    });
  }

  markAllRead(recipientUserId: string, now: Date) {
    return this.db.inAppNotification.updateMany({
      where: {
        ...this.audienceWhere(),
        recipientUserId,
        readAt: null,
        expiresAt: { gt: now },
      },
      data: { readAt: now },
    });
  }

  markContextRead(
    recipientUserId: string,
    contextType: BuiltNotification["contextType"],
    contextId: string,
    now: Date,
  ) {
    return this.db.inAppNotification.updateMany({
      where: {
        ...this.audienceWhere(),
        recipientUserId,
        contextType,
        contextId,
        readAt: null,
        expiresAt: { gt: now },
      },
      data: { readAt: now },
    });
  }

  deleteExpired(now: Date, limit = 500) {
    return this.db.$executeRaw`
      DELETE FROM "InAppNotification"
      WHERE "id" IN (
        SELECT "id" FROM "InAppNotification"
        WHERE "expiresAt" <= ${now}
        ORDER BY "expiresAt", "id"
        LIMIT ${limit}
      )
    `;
  }
}
