import "server-only";
import { MessagingEligibilityService } from "@/backend/messaging/authorization/messaging-eligibility-service";
import { PrismaMessagingConversationRepository } from "@/backend/repositories/messaging/prisma-messaging-conversation-repository";
import {
  MessagingError,
  unavailableConversation,
} from "@/backend/messaging/messaging-errors";

export class GetMessageHistoryService {
  constructor(
    private readonly repository = new PrismaMessagingConversationRepository(),
    private readonly eligibility = new MessagingEligibilityService(),
  ) {}

  async execute(input: {
    conversationId: string;
    userId: string;
    cursor?: string;
    limit: number;
  }) {
    const access = await this.repository.findAccess(
      input.conversationId,
      input.userId,
    );
    if (!access) throw unavailableConversation();
    const otherUserId =
      access.participantLowId === input.userId
        ? access.participantHighId
        : access.participantLowId;
    const current = await this.eligibility.authorizeContext({
      userA: input.userId,
      userB: otherUserId,
      type: access.contextType,
      reference: access.contextReference,
    });
    const archivedProfessionalHistory =
      access.contextType === "PROFESSIONAL_CONNECTION" &&
      Boolean(access.archivedAt);
    if (!current && !archivedProfessionalHistory) {
      throw unavailableConversation();
    }
    try {
      const history = await this.repository.getHistory(input);
      if (!history) throw unavailableConversation();
      return history;
    } catch (error) {
      if (error instanceof Error && error.message === "INVALID_CURSOR") {
        throw new MessagingError("VALIDATION_ERROR", 400);
      }
      throw error;
    }
  }
}
