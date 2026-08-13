import "server-only";
import { Prisma } from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";
import { MessagingError } from "@/backend/messaging/messaging-errors";
import type { MessagingMessageRepositoryPort } from "@/backend/messaging/ports/messaging-repository";

export class PrismaMessagingMessageRepository implements MessagingMessageRepositoryPort {
  constructor(private readonly db: typeof prisma = prisma) {}

  async accept(input: Parameters<MessagingMessageRepositoryPort["accept"]>[0]) {
    const replay = await this.findReplay(input);
    if (replay) return replay;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const message = await this.db.$transaction(
          async (tx) => {
            const initial = await tx.messagingConversation.findUnique({
              where: { id: input.conversationId },
              select: { professionalConnectionId: true },
            });
            if (initial?.professionalConnectionId) {
              await tx.$queryRaw(
                Prisma.sql`SELECT "id" FROM "ProfessionalConnection" WHERE "id" = ${initial.professionalConnectionId} FOR UPDATE`,
              );
            }
            await tx.$queryRaw(
              Prisma.sql`SELECT "id" FROM "MessagingConversation" WHERE "id" = ${input.conversationId} FOR UPDATE`,
            );
            const authority = await tx.messagingConversation.findUnique({
              where: { id: input.conversationId },
              select: {
                archivedAt: true,
                professionalConnection: { select: { state: true } },
              },
            });
            if (
              !authority ||
              authority.archivedAt ||
              (authority.professionalConnection &&
                authority.professionalConnection.state !== "ACCEPTED")
            ) {
              throw new MessagingError("CONFLICT", 409);
            }
            const updated = await tx.messagingConversation.update({
              where: { id: input.conversationId },
              data: { nextMessageSequence: { increment: 1 } },
              select: { nextMessageSequence: true },
            });
            const sequence = updated.nextMessageSequence - 1;
            const created = await tx.messagingMessage.create({
              data: {
                conversationId: input.conversationId,
                sequence,
                senderId: input.senderId,
                clientOperationId: input.clientOperationId,
                content: input.content,
                createdAt: input.now,
              },
              select: {
                id: true,
                conversationId: true,
                sequence: true,
                senderId: true,
                content: true,
                createdAt: true,
              },
            });
            await tx.messagingConversation.update({
              where: { id: input.conversationId },
              data: {
                lastMessageSequence: sequence,
                lastMessageAt: input.now,
              },
            });
            return created;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        return { message, deduplicated: false };
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          const replayAfterConflict = await this.findReplay(input);
          if (replayAfterConflict) return replayAfterConflict;
        }
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2034" &&
          attempt < 2
        ) {
          continue;
        }
        throw error;
      }
    }
    throw new MessagingError("PERSISTENCE_UNAVAILABLE", 503, true);
  }

  private async findReplay(
    input: Parameters<MessagingMessageRepositoryPort["accept"]>[0],
  ) {
    const existing = await this.db.messagingMessage.findUnique({
      where: {
        senderId_clientOperationId: {
          senderId: input.senderId,
          clientOperationId: input.clientOperationId,
        },
      },
      select: {
        id: true,
        conversationId: true,
        sequence: true,
        senderId: true,
        content: true,
        createdAt: true,
      },
    });
    if (!existing) return null;
    if (
      existing.conversationId !== input.conversationId ||
      existing.content !== input.content
    ) {
      throw new MessagingError("CONFLICT", 409);
    }
    return { message: existing, deduplicated: true };
  }
}
