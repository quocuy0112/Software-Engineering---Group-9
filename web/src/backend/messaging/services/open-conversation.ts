import "server-only";
import { randomUUID } from "node:crypto";
import type { AuthenticationAuditEvent } from "@/backend/audit/events";
import type { MessagingEligibilityPort } from "@/backend/messaging/ports/eligibility-provider";
import type {
  MessagingBlockRepositoryPort,
  MessagingConversationRepositoryPort,
} from "@/backend/messaging/ports/messaging-repository";
import { MessagingEligibilityService } from "@/backend/messaging/authorization/messaging-eligibility-service";
import { PrismaMessagingBlockRepository } from "@/backend/repositories/messaging/prisma-messaging-block-repository";
import { PrismaMessagingConversationRepository } from "@/backend/repositories/messaging/prisma-messaging-conversation-repository";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import { MessagingError, unavailableConversation } from "@/backend/messaging/messaging-errors";
import type { ConversationContextInput } from "@/shared/contracts/messaging/conversations";
import { admitActiveMessagingConversationSockets } from "@/backend/messaging/realtime/messaging-realtime-hub";

type MessagingActor = { userId: string; sessionId: string };
type AuditPort = { append(input: AuthenticationAuditEvent): Promise<unknown> };

function contextReference(context: ConversationContextInput) {
  return context.type === "APPLICATION"
    ? context.applicationId
    : context.professionalConnectionId;
}

export class OpenConversationService {
  constructor(
    private readonly eligibility: MessagingEligibilityPort = new MessagingEligibilityService(),
    private readonly blocks: MessagingBlockRepositoryPort = new PrismaMessagingBlockRepository(),
    private readonly conversations: MessagingConversationRepositoryPort =
      new PrismaMessagingConversationRepository(),
    private readonly audit: AuditPort = new PrismaAuditRepository(),
  ) {}

  async execute(
    actor: MessagingActor,
    targetUserId: string,
    contextInput: ConversationContextInput,
    now = new Date(),
  ) {
    const available = await this.eligibility.canMessage(actor.userId, targetUserId);
    const context = available
      ? await this.eligibility.authorizeContext({
          userA: actor.userId,
          userB: targetUserId,
          type: contextInput.type,
          reference: contextReference(contextInput),
        })
      : null;
    if (!context) {
      await this.writeAudit(actor, "messaging.conversation.denied", null, "DENIED", now);
      throw unavailableConversation();
    }
    if (await this.blocks.isEitherDirectionBlocked(actor.userId, targetUserId)) {
      await this.writeAudit(actor, "messaging.conversation.denied", null, "DENIED", now);
      throw new MessagingError("BLOCKED", 403);
    }

    const outcome = await this.conversations.open({
      actorUserId: actor.userId,
      targetUserId,
      context,
      now,
    });
    await this.writeAudit(
      actor,
      "messaging.conversation.opened",
      outcome.conversationId,
      "SUCCESS",
      now,
    );
    await admitActiveMessagingConversationSockets({
      conversationId: outcome.conversationId,
      userIds: [actor.userId, targetUserId],
    });
    return outcome;
  }

  private writeAudit(
    actor: MessagingActor,
    action: "messaging.conversation.opened" | "messaging.conversation.denied",
    targetId: string | null,
    result: "SUCCESS" | "DENIED",
    occurredAt: Date,
  ) {
    return this.audit.append({
      occurredAt,
      actorType: "user",
      actorUserId: actor.userId,
      actorSessionId: actor.sessionId,
      action,
      targetType: "messaging_conversation",
      targetId,
      result,
      correlationId: randomUUID(),
      context: {},
    });
  }
}
