import "server-only";
import { Prisma } from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";
import {
  canonicalParticipantPair,
  type MessagingConversationRepositoryPort,
} from "@/backend/messaging/ports/messaging-repository";
import type {
  ConversationDetail,
  ConversationSummary,
} from "@/shared/contracts/messaging/conversations";
import type { MessagingMessage, ReadBoundary } from "@/shared/contracts/messaging/messages";
import { messagingParticipantProjection } from "@/backend/messaging/services/apply-messaging-data-lifecycle";

type ListCursor = { lastMessageAt: string | null; id: string };

export function encodeConversationCursor(cursor: ListCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeConversationCursor(cursor?: string): ListCursor | null {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as ListCursor;
    return typeof value.id === "string" &&
      (value.lastMessageAt === null || typeof value.lastMessageAt === "string")
      ? value
      : null;
  } catch {
    return null;
  }
}

export class PrismaMessagingConversationRepository
  implements MessagingConversationRepositoryPort
{
  constructor(private readonly db: typeof prisma = prisma) {}

  async findAccess(conversationId: string, userId: string) {
    return this.db.messagingConversation.findFirst({
      where: {
        id: conversationId,
        OR: [{ participantLowId: userId }, { participantHighId: userId }],
      },
      select: {
        id: true,
        participantLowId: true,
        participantHighId: true,
        contextType: true,
        contextReference: true,
        applicationId: true,
        companyId: true,
        professionalConnectionId: true,
        lastMessageSequence: true,
      },
    });
  }

  async listAuthorizedConversationIds(userId: string) {
    const rows = await this.db.messagingConversationParticipant.findMany({
      where: { userId },
      select: { conversationId: true },
    });
    return rows.map((row) => row.conversationId);
  }

  async open(input: Parameters<MessagingConversationRepositoryPort["open"]>[0]) {
    const pair = canonicalParticipantPair(input.actorUserId, input.targetUserId);
    const unique = {
      ...pair,
      contextType: input.context.type,
      contextReference: input.context.reference,
    };
    const existing = await this.db.messagingConversation.findUnique({
      where: { participantLowId_participantHighId_contextType_contextReference: unique },
      select: { id: true },
    });
    if (existing) return { conversationId: existing.id, created: false };

    try {
      const created = await this.db.$transaction(
        async (tx) =>
          tx.messagingConversation.create({
            data: {
              ...unique,
              createdAt: input.now,
              applicationId:
                input.context.type === "APPLICATION" ? input.context.applicationId : null,
              companyId:
                input.context.type === "APPLICATION" ? input.context.companyId : null,
              professionalConnectionId:
                input.context.type === "PROFESSIONAL_CONNECTION"
                  ? input.context.professionalConnectionId
                  : null,
              participants: {
                create: [
                  { userId: pair.participantLowId, createdAt: input.now },
                  { userId: pair.participantHighId, createdAt: input.now },
                ],
              },
            },
            select: { id: true },
          }),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return { conversationId: created.id, created: true };
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        throw error;
      }
      const winner = await this.db.messagingConversation.findUnique({
        where: { participantLowId_participantHighId_contextType_contextReference: unique },
        select: { id: true },
      });
      if (!winner) throw error;
      return { conversationId: winner.id, created: false };
    }
  }

  async getDetail(conversationId: string, userId: string): Promise<ConversationDetail | null> {
    const row = await this.db.messagingConversation.findFirst({
      where: {
        id: conversationId,
        participants: { some: { userId } },
      },
      select: {
        id: true,
        participantLowId: true,
        participantLow: { select: { id: true, name: true, image: true } },
        participantHigh: { select: { id: true, name: true, image: true } },
        contextType: true,
        contextReference: true,
        application: {
          select: {
            jobPosting: { select: { title: true, company: { select: { displayName: true } } } },
          },
        },
        lastMessageSequence: true,
        createdAt: true,
        participants: { where: { userId }, select: { lastReadSequence: true } },
        messages: {
          orderBy: { sequence: "desc" },
          take: 1,
          select: { senderId: true, content: true, createdAt: true },
        },
      },
    });
    if (!row) return null;
    const other = row.participantLowId === userId ? row.participantHigh : row.participantLow;
    const lastSequence = row.lastMessageSequence ?? 0;
    const lastReadSequence = row.participants[0]?.lastReadSequence ?? 0;
    const [blocked, unreadCount] = await Promise.all([this.db.userMessagingBlock.findFirst({
      where: {
        OR: [
          { blockerUserId: userId, blockedUserId: other.id },
          { blockerUserId: other.id, blockedUserId: userId },
        ],
      },
      select: { blockerUserId: true },
    }), this.db.messagingMessage.count({
      where: {
        conversationId: row.id,
        sequence: { gt: lastReadSequence },
        senderId: { not: userId },
      },
    })]);
    const job = row.application?.jobPosting;
    const lastMessage = row.messages[0];
    return {
      id: row.id,
      otherParticipant: other,
      context: {
        type: row.contextType,
        reference: row.contextReference,
        label: job?.title ?? "Professional connection",
        companyName: job?.company.displayName ?? null,
        jobTitle: job?.title ?? null,
      },
      lastMessage: lastMessage
        ? {
            senderId: lastMessage.senderId,
            content: lastMessage.content,
            createdAt: lastMessage.createdAt.toISOString(),
          }
        : null,
      unreadCount,
      blocked: Boolean(blocked),
      presence: "OFFLINE",
      createdAt: row.createdAt.toISOString(),
      currentLastSequence: lastSequence,
      currentUserLastReadSequence: lastReadSequence,
    };
  }

  async listSummaries(input: {
    userId: string;
    cursor?: string;
    limit: number;
  }): Promise<{ items: ConversationSummary[]; nextCursor: string | null }> {
    const cursor = decodeConversationCursor(input.cursor);
    if (input.cursor && !cursor) throw new Error("INVALID_CURSOR");
    const cursorWhere = cursor
      ? cursor.lastMessageAt === null
        ? { lastMessageAt: null, id: { lt: cursor.id } }
        : {
            OR: [
              { lastMessageAt: { lt: new Date(cursor.lastMessageAt) } },
              { lastMessageAt: new Date(cursor.lastMessageAt), id: { lt: cursor.id } },
              { lastMessageAt: null },
            ],
          }
      : {};
    const rows = await this.db.messagingConversation.findMany({
      where: {
        participants: { some: { userId: input.userId } },
        ...cursorWhere,
      },
      orderBy: [
        { lastMessageAt: { sort: "desc", nulls: "last" } },
        { id: "desc" },
      ],
      take: input.limit + 1,
      select: {
        id: true,
        participantLowId: true,
        participantLow: { select: { id: true, name: true, image: true, state: true } },
        participantHigh: { select: { id: true, name: true, image: true, state: true } },
        contextType: true,
        contextReference: true,
        application: {
          select: {
            jobPosting: { select: { title: true, company: { select: { displayName: true } } } },
          },
        },
        lastMessageAt: true,
        createdAt: true,
        participants: { where: { userId: input.userId }, select: { lastReadSequence: true } },
        messages: {
          orderBy: { sequence: "desc" },
          take: 1,
          select: { senderId: true, content: true, createdAt: true },
        },
      },
    });
    const pageRows = rows.slice(0, input.limit);
    const items = await Promise.all(
      pageRows.map(async (row) => {
        const otherRaw =
          row.participantLowId === input.userId ? row.participantHigh : row.participantLow;
        const other = messagingParticipantProjection(otherRaw);
        const boundary = row.participants[0]?.lastReadSequence ?? 0;
        const [blocked, unreadCount] = await Promise.all([
          this.db.userMessagingBlock.findFirst({
            where: {
              OR: [
                { blockerUserId: input.userId, blockedUserId: other.id },
                { blockerUserId: other.id, blockedUserId: input.userId },
              ],
            },
            select: { blockerUserId: true },
          }),
          this.db.messagingMessage.count({
            where: {
              conversationId: row.id,
              sequence: { gt: boundary },
              senderId: { not: input.userId },
            },
          }),
        ]);
        const last = row.messages[0];
        const job = row.application?.jobPosting;
        return {
          id: row.id,
          otherParticipant: other,
          context: {
            type: row.contextType,
            reference: row.contextReference,
            label: job?.title ?? "Professional connection",
            companyName: job?.company.displayName ?? null,
            jobTitle: job?.title ?? null,
          },
          lastMessage: last
            ? {
                senderId: last.senderId,
                content: last.content,
                createdAt: last.createdAt.toISOString(),
              }
            : null,
          unreadCount,
          blocked: Boolean(blocked),
          presence: "OFFLINE" as const,
          createdAt: row.createdAt.toISOString(),
        };
      }),
    );
    const last = pageRows.at(-1);
    return {
      items,
      nextCursor:
        rows.length > input.limit && last
          ? encodeConversationCursor({
              lastMessageAt: last.lastMessageAt?.toISOString() ?? null,
              id: last.id,
            })
          : null,
    };
  }

  async getHistory(input: {
    conversationId: string;
    userId: string;
    cursor?: string;
    limit: number;
  }): Promise<{ conversation: ConversationDetail; items: MessagingMessage[]; nextCursor: string | null } | null> {
    const conversation = await this.getDetail(input.conversationId, input.userId);
    if (!conversation) return null;
    const before = input.cursor ? Number.parseInt(input.cursor, 10) : undefined;
    if (input.cursor && (!Number.isSafeInteger(before) || before! < 1)) {
      throw new Error("INVALID_CURSOR");
    }
    const rows = await this.db.messagingMessage.findMany({
      where: {
        conversationId: input.conversationId,
        ...(before ? { sequence: { lt: before } } : {}),
      },
      orderBy: { sequence: "desc" },
      take: input.limit + 1,
      select: {
        id: true,
        conversationId: true,
        sequence: true,
        senderId: true,
        content: true,
        createdAt: true,
      },
    });
    const page = rows.slice(0, input.limit);
    const otherBoundary = await this.db.messagingConversationParticipant.findFirst({
      where: {
        conversationId: input.conversationId,
        userId: { not: input.userId },
      },
      select: { lastReadSequence: true },
    });
    return {
      conversation,
      items: page
        .map((message) => ({
          ...message,
          createdAt: message.createdAt.toISOString(),
          delivery:
            message.senderId === input.userId &&
            (otherBoundary?.lastReadSequence ?? 0) >= message.sequence
              ? ("READ" as const)
              : ("SENT" as const),
        }))
        .reverse(),
      nextCursor:
        rows.length > input.limit ? String(page.at(-1)?.sequence ?? "") : null,
    };
  }

  async markRead(input: {
    conversationId: string;
    userId: string;
    lastReadSequence: number;
    now: Date;
  }): Promise<ReadBoundary | null> {
    const access = await this.findAccess(input.conversationId, input.userId);
    if (!access) return null;
    const maximum = access.lastMessageSequence ?? 0;
    if (input.lastReadSequence > maximum) throw new Error("READ_SEQUENCE_CONFLICT");
    await this.db.messagingConversationParticipant.updateMany({
      where: {
        conversationId: input.conversationId,
        userId: input.userId,
        lastReadSequence: { lt: input.lastReadSequence },
      },
      data: { lastReadSequence: input.lastReadSequence, lastReadAt: input.now },
    });
    const participant = await this.db.messagingConversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId: input.conversationId,
          userId: input.userId,
        },
      },
      select: { lastReadSequence: true, lastReadAt: true },
    });
    if (!participant) return null;
    return {
      conversationId: input.conversationId,
      readerId: input.userId,
      lastReadSequence: participant.lastReadSequence,
      readAt: (participant.lastReadAt ?? input.now).toISOString(),
    };
  }
}
