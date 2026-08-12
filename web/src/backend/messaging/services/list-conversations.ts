import "server-only";
import { MessagingEligibilityService } from "@/backend/messaging/authorization/messaging-eligibility-service";
import { PrismaMessagingConversationRepository } from "@/backend/repositories/messaging/prisma-messaging-conversation-repository";
import { MessagingError } from "@/backend/messaging/messaging-errors";

export class ListConversationsService {
  constructor(
    private readonly repository = new PrismaMessagingConversationRepository(),
    private readonly eligibility = new MessagingEligibilityService(),
  ) {}

  async execute(input: { userId: string; cursor?: string; limit: number }) {
    try {
      const page = await this.repository.listSummaries(input);
      const authorized = [];
      for (const conversation of page.items) {
        const context = await this.eligibility.authorizeContext({
          userA: input.userId,
          userB: conversation.otherParticipant.id,
          type: conversation.context.type,
          reference: conversation.context.reference,
        });
        if (context) authorized.push(conversation);
      }
      return { items: authorized, nextCursor: page.nextCursor };
    } catch (error) {
      if (error instanceof Error && error.message === "INVALID_CURSOR") {
        throw new MessagingError("VALIDATION_ERROR", 400);
      }
      throw error;
    }
  }
}
