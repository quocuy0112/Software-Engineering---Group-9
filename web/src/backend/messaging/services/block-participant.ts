import "server-only";
import { randomUUID } from "node:crypto";
import { PrismaUserMessagingBlockRepository } from "@/backend/repositories/messaging/prisma-user-messaging-block-repository";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import { unavailableConversation } from "@/backend/messaging/messaging-errors";
import { revokeMessagingConversationAccess } from "@/backend/messaging/realtime/messaging-realtime-hub";
import { ProposalAuthorityInvalidationService } from "@/backend/connections/services/proposal-authority-invalidation-service";

export class BlockParticipantService {
  constructor(
    private readonly blocks = new PrismaUserMessagingBlockRepository(),
    private readonly audit = new PrismaAuditRepository(),
  ) {}

  async execute(
    actor: { userId: string; sessionId: string },
    targetUserId: string,
  ) {
    const conversationIds = await this.blocks.sharedConversationIds(
      actor.userId,
      targetUserId,
    );
    if (conversationIds.length === 0) throw unavailableConversation();
    const now = new Date();
    const correlationId = randomUUID();
    await new ProposalAuthorityInvalidationService().block(
      actor.userId,
      targetUserId,
      correlationId,
    );
    await this.audit.append({
      occurredAt: now,
      actorType: "user",
      actorUserId: actor.userId,
      actorSessionId: actor.sessionId,
      action: "messaging.participant.blocked",
      targetType: "messaging_conversation",
      targetId: conversationIds[0] ?? null,
      result: "SUCCESS",
      correlationId,
      context: { count: conversationIds.length },
    });
    await revokeMessagingConversationAccess({
      affectedUserIds: [actor.userId, targetUserId],
      affectedConversationIds: conversationIds,
      cause: "BLOCK",
      correlationId,
    });
    return { targetUserId, blocked: true };
  }
}
