import "server-only";
import { randomUUID } from "node:crypto";
import { PrismaUserMessagingBlockRepository } from "@/backend/repositories/messaging/prisma-user-messaging-block-repository";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import { MessagingEligibilityService } from "@/backend/messaging/authorization/messaging-eligibility-service";
import { unavailableConversation } from "@/backend/messaging/messaging-errors";

export class UnblockParticipantService {
  constructor(
    private readonly blocks = new PrismaUserMessagingBlockRepository(),
    private readonly eligibility = new MessagingEligibilityService(),
    private readonly audit = new PrismaAuditRepository(),
  ) {}

  async execute(actor: { userId: string; sessionId: string }, targetUserId: string) {
    const conversationIds = await this.blocks.sharedConversationIds(actor.userId, targetUserId);
    if (conversationIds.length === 0) throw unavailableConversation();
    await this.blocks.deleteOwned(actor.userId, targetUserId);
    const [blocked, eligible] = await Promise.all([
      this.blocks.isEitherDirectionBlocked(actor.userId, targetUserId),
      this.eligibility.canMessage(actor.userId, targetUserId),
    ]);
    const now = new Date();
    await this.audit.append({
      occurredAt: now,
      actorType: "user",
      actorUserId: actor.userId,
      actorSessionId: actor.sessionId,
      action: "messaging.participant.unblocked",
      targetType: "messaging_conversation",
      targetId: conversationIds[0] ?? null,
      result: "SUCCESS",
      correlationId: randomUUID(),
      context: { eligible },
    });
    return { targetUserId, blocked };
  }
}
