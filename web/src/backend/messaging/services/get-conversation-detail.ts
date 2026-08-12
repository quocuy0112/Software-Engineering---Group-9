import "server-only";
import { unavailableConversation } from "@/backend/messaging/messaging-errors";
import { PrismaMessagingConversationRepository } from "@/backend/repositories/messaging/prisma-messaging-conversation-repository";

export class GetConversationDetailService {
  constructor(
    private readonly repository = new PrismaMessagingConversationRepository(),
  ) {}

  async execute(conversationId: string, userId: string) {
    const detail = await this.repository.getDetail(conversationId, userId);
    if (!detail) throw unavailableConversation();
    return detail;
  }
}
