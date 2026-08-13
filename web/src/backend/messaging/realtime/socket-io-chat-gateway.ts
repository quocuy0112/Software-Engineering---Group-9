import "server-only";
import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { serverEnvironment } from "@/backend/env/runtime";
import { MessagingRequestBoundary } from "@/backend/messaging/authorization/messaging-request-boundary";
import { MessagingEligibilityService } from "@/backend/messaging/authorization/messaging-eligibility-service";
import { PrismaMessagingBlockRepository } from "@/backend/repositories/messaging/prisma-messaging-block-repository";
import { PrismaMessagingConversationRepository } from "@/backend/repositories/messaging/prisma-messaging-conversation-repository";
import { PrismaMessagingMessageRepository } from "@/backend/repositories/messaging/prisma-messaging-message-repository";
import { SendMessageService } from "@/backend/messaging/services/send-message";
import type { MessagingEligibilityPort } from "@/backend/messaging/ports/eligibility-provider";
import type {
  MessagingBlockRepositoryPort,
  MessagingConversationRepositoryPort,
  MessagingMessageRepositoryPort,
} from "@/backend/messaging/ports/messaging-repository";
import type {
  ChatClientToServerEvents,
  ChatInterServerEvents,
  ChatServerToClientEvents,
  ChatSocketData,
} from "@/shared/contracts/messaging/socket-events";
import { MessagingSocketRegistry } from "./messaging-socket-registry";
import {
  accountRoom,
  conversationRoom,
  MessagingRealtimePublisher,
} from "./messaging-realtime-publisher";
import {
  authorizeSocketConversation,
  registerChatEvents,
} from "./register-chat-events";
import { installMessagingRealtimePublisher } from "./messaging-realtime-hub";
import { MessagingPresenceRegistry } from "./messaging-presence-registry";
import { attachSupportNamespace } from "@/backend/support/realtime/socket-io-support-gateway";
import { attachConnectionNamespace } from "@/backend/connections/realtime/socket-io-connection-gateway";

type Actor = { userId: string; sessionId: string };

function handshakeHeaders(raw: Record<string, string | string[] | undefined>) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) headers.set(key, value.join(", "));
    else if (value !== undefined) headers.set(key, value);
  }
  return headers;
}

export type ChatGatewayDependencies = {
  authenticate?: (headers: Headers) => Promise<Actor | null>;
  conversations?: MessagingConversationRepositoryPort;
  eligibility?: MessagingEligibilityPort;
  blocks?: MessagingBlockRepositoryPort;
  messages?: MessagingMessageRepositoryPort;
  registry?: MessagingSocketRegistry;
  presence?: MessagingPresenceRegistry;
};

export function attachSocketIoChatGateway(
  httpServer: HttpServer,
  supplied: ChatGatewayDependencies = {},
) {
  const io = new Server<
    ChatClientToServerEvents,
    ChatServerToClientEvents,
    ChatInterServerEvents,
    ChatSocketData
  >(httpServer, {
    path: serverEnvironment.MESSAGING_SOCKET_PATH,
    serveClient: false,
    transports: ["websocket"],
    allowUpgrades: false,
    maxHttpBufferSize: 32 * 1024,
  });
  const chat = io.of("/chat");
  attachSupportNamespace(io as unknown as Server);
  attachConnectionNamespace(io as unknown as Server);
  const conversations =
    supplied.conversations ?? new PrismaMessagingConversationRepository();
  const eligibility = supplied.eligibility ?? new MessagingEligibilityService();
  const blocks = supplied.blocks ?? new PrismaMessagingBlockRepository();
  const messages = supplied.messages ?? new PrismaMessagingMessageRepository();
  const registry = supplied.registry ?? new MessagingSocketRegistry();
  const authenticate =
    supplied.authenticate ??
    (async (headers: Headers) => {
      try {
        return await new MessagingRequestBoundary().requireSocket(headers);
      } catch {
        return null;
      }
    });
  const publisher = new MessagingRealtimePublisher(
    chat,
    registry,
    conversations,
    eligibility,
    blocks,
  );
  installMessagingRealtimePublisher(publisher);
  const emitPresence = async (event: {
    userId: string;
    presence: "ONLINE" | "OFFLINE";
  }) => {
    const conversationIds = await conversations.listAuthorizedConversationIds(
      event.userId,
    );
    for (const conversationId of conversationIds) {
      const access = await conversations.findAccess(
        conversationId,
        event.userId,
      );
      if (!access) continue;
      const partnerId =
        access.participantLowId === event.userId
          ? access.participantHighId
          : access.participantLowId;
      const [context, blocked] = await Promise.all([
        eligibility.authorizeContext({
          userA: event.userId,
          userB: partnerId,
          type: access.contextType,
          reference: access.contextReference,
        }),
        blocks.isEitherDirectionBlocked(event.userId, partnerId),
      ]);
      if (!context || blocked) continue;
      for (const socketId of registry.socketIdsForUser(partnerId)) {
        chat.sockets.get(socketId)?.emit("presence:changed", event);
      }
    }
  };
  const presence =
    supplied.presence ??
    new MessagingPresenceRegistry(
      serverEnvironment.MESSAGING_DISCONNECT_GRACE_MS,
      emitPresence,
    );
  const send = new SendMessageService(
    eligibility,
    blocks,
    conversations,
    messages,
    publisher,
  );

  chat.use(async (socket, next) => {
    const actor = await authenticate(
      handshakeHeaders(socket.handshake.headers),
    );
    if (!actor) return next(new Error("AUTH_REQUIRED"));
    socket.data.userId = actor.userId;
    socket.data.sessionId = actor.sessionId;
    return next();
  });

  chat.on("connection", async (socket) => {
    registry.register({ socketId: socket.id, ...socket.data });
    presence.register(socket.id, socket.data.userId);
    await socket.join(accountRoom(socket.data.userId));
    const ids = await conversations.listAuthorizedConversationIds(
      socket.data.userId,
    );
    for (const conversationId of ids) {
      try {
        await authorizeSocketConversation({
          conversationId,
          userId: socket.data.userId,
          conversations,
          eligibility,
          blocks,
        });
        await socket.join(conversationRoom(conversationId));
        registry.joinConversation(socket.id, conversationId);
      } catch {
        // Stale participant rows are not transport authority.
      }
    }

    const currentHeaders = () => handshakeHeaders(socket.handshake.headers);
    registerChatEvents(socket, {
      registry,
      conversations,
      eligibility,
      blocks,
      send,
      revalidateSession: async () =>
        Boolean(await authenticate(currentHeaders())),
    });
    socket.on("disconnect", () => {
      registry.unregister(socket.id);
      presence.unregister(socket.id);
    });
  });

  return io;
}
