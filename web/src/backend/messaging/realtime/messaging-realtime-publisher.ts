import "server-only";
import type { Namespace } from "socket.io";
import type { MessagingEligibilityPort } from "@/backend/messaging/ports/eligibility-provider";
import type {
  MessagingBlockRepositoryPort,
  MessagingConversationRepositoryPort,
} from "@/backend/messaging/ports/messaging-repository";
import type {
  MessagingRealtimePublisherPort,
  MessagingSocketRegistryPort,
} from "@/backend/messaging/ports/realtime-publisher";
import type {
  ChatClientToServerEvents,
  ChatInterServerEvents,
  ChatServerToClientEvents,
  ChatSocketData,
} from "@/shared/contracts/messaging/socket-events";
import type { MessagingMessage, ReadBoundary } from "@/shared/contracts/messaging/messages";

type ChatNamespace = Namespace<
  ChatClientToServerEvents,
  ChatServerToClientEvents,
  ChatInterServerEvents,
  ChatSocketData
>;

export class MessagingRealtimePublisher implements MessagingRealtimePublisherPort {
  constructor(
    private readonly namespace: ChatNamespace,
    private readonly registry: MessagingSocketRegistryPort,
    private readonly conversations: MessagingConversationRepositoryPort,
    private readonly eligibility: MessagingEligibilityPort,
    private readonly blocks: MessagingBlockRepositoryPort,
  ) {}

  async admitConversationSockets(input: {
    conversationId: string;
    userIds: string[];
  }) {
    for (const userId of input.userIds) {
      const access = await this.conversations.findAccess(input.conversationId, userId);
      if (!access) continue;
      const otherId =
        access.participantLowId === userId
          ? access.participantHighId
          : access.participantLowId;
      const [context, blocked] = await Promise.all([
        this.eligibility.authorizeContext({
          userA: userId,
          userB: otherId,
          type: access.contextType,
          reference: access.contextReference,
        }),
        this.blocks.isEitherDirectionBlocked(userId, otherId),
      ]);
      if (!context || blocked) continue;
      for (const socketId of this.registry.socketIdsForUser(userId)) {
        const socket = this.namespace.sockets.get(socketId);
        if (!socket) continue;
        await socket.join(conversationRoom(input.conversationId));
        this.registry.joinConversation(socketId, input.conversationId);
      }
    }
  }

  async publishMessage(message: MessagingMessage, senderId: string) {
    const sockets = [...this.registry.socketIdsForConversation(message.conversationId)];
    for (const socketId of sockets) {
      const recipientId = this.registry.userIdForSocket(socketId);
      if (!recipientId) continue;
      const access = await this.conversations.findAccess(message.conversationId, recipientId);
      if (!access) continue;
      const otherId =
        access.participantLowId === recipientId
          ? access.participantHighId
          : access.participantLowId;
      const context = await this.eligibility.authorizeContext({
        userA: recipientId,
        userB: otherId,
        type: access.contextType,
        reference: access.contextReference,
      });
      const allowed =
        context &&
        !(await this.blocks.isEitherDirectionBlocked(recipientId, otherId)) &&
        (recipientId === senderId ||
          (await this.eligibility.canMessage(senderId, recipientId)));
      if (!allowed) continue;
      this.namespace.sockets.get(socketId)?.emit("message:new", { message });
    }
  }

  async publishRead(boundary: ReadBoundary) {
    const sockets = [...this.registry.socketIdsForConversation(boundary.conversationId)];
    for (const socketId of sockets) {
      const userId = this.registry.userIdForSocket(socketId);
      if (!userId) continue;
      if (await this.conversations.findAccess(boundary.conversationId, userId)) {
        this.namespace.sockets.get(socketId)?.emit("message:read", boundary);
      }
    }
  }

  async revokeConversationAccess(input: {
    affectedUserIds: string[];
    affectedSessionIds?: string[];
    affectedConversationIds: string[];
    cause: "BLOCK" | "CONNECTION" | "MEMBERSHIP" | "SESSION" | "ACCOUNT" | "MODERATION";
    correlationId: string;
  }) {
    const affectedSocketIds = new Set<string>();
    for (const userId of input.affectedUserIds) {
      for (const socketId of this.registry.socketIdsForUser(userId)) {
        affectedSocketIds.add(socketId);
      }
    }
    for (const sessionId of input.affectedSessionIds ?? []) {
      for (const socketId of this.registry.socketIdsForSession(sessionId)) {
        affectedSocketIds.add(socketId);
      }
    }
    for (const socketId of affectedSocketIds) {
        const socket = this.namespace.sockets.get(socketId);
        for (const conversationId of input.affectedConversationIds) {
          if (!this.registry.conversationIdsForSocket(socketId).has(conversationId)) continue;
          await socket?.leave(conversationRoom(conversationId));
          this.registry.leaveConversation(socketId, conversationId);
          socket?.emit("conversation:access_revoked", {
            conversationId,
            code: "AUTHORITY_CHANGED",
          });
        }
        if (input.cause === "SESSION" || input.cause === "ACCOUNT" || input.cause === "MODERATION") {
          socket?.disconnect(true);
        }
    }
  }
}

export const conversationRoom = (conversationId: string) =>
  `conversation:${conversationId}`;
export const accountRoom = (userId: string) => `account:${userId}`;
