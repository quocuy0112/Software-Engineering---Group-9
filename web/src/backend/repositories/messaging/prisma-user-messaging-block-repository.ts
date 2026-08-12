import "server-only";
import { prisma } from "@/backend/database/prisma";
import { canonicalParticipantPair } from "@/backend/messaging/ports/messaging-repository";
import type { MessagingBlockRepositoryPort } from "@/backend/messaging/ports/messaging-repository";

export class PrismaUserMessagingBlockRepository
  implements MessagingBlockRepositoryPort
{
  constructor(private readonly db: typeof prisma = prisma) {}

  async isEitherDirectionBlocked(userA: string, userB: string) {
    if (userA === userB) return true;
    return Boolean(
      await this.db.userMessagingBlock.findFirst({
        where: {
          OR: [
            { blockerUserId: userA, blockedUserId: userB },
            { blockerUserId: userB, blockedUserId: userA },
          ],
        },
        select: { blockerUserId: true },
      }),
    );
  }

  async createOwned(blockerUserId: string, blockedUserId: string, now = new Date()) {
    await this.db.userMessagingBlock.upsert({
      where: { blockerUserId_blockedUserId: { blockerUserId, blockedUserId } },
      create: { blockerUserId, blockedUserId, createdAt: now },
      update: {},
    });
  }

  async deleteOwned(blockerUserId: string, blockedUserId: string) {
    await this.db.userMessagingBlock.deleteMany({
      where: { blockerUserId, blockedUserId },
    });
  }

  async sharedConversationIds(userA: string, userB: string) {
    const pair = canonicalParticipantPair(userA, userB);
    const rows = await this.db.messagingConversation.findMany({
      where: pair,
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }
}
