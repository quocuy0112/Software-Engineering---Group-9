import { createServer } from "node:http";
import { io as createClient, type Socket } from "socket.io-client";
import { afterEach, describe, expect, it } from "vitest";
import { attachSocketIoChatGateway } from "@/backend/messaging/realtime/socket-io-chat-gateway";

const closeCallbacks: Array<() => Promise<void>> = [];
afterEach(async () => {
  await Promise.all(closeCallbacks.splice(0).map((close) => close()));
});

function once(socket: Socket, event: string) {
  return new Promise<unknown>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for ${event}`)),
      3_000,
    );
    socket.once(event, (value) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}

describe("same-process chat gateway", () => {
  it("auto-joins every authorized room so a list-only user receives message:new", async () => {
    const server = createServer();
    let sequence = 0;
    const access = {
      id: "conversation-1",
      participantLowId: "user-a",
      participantHighId: "user-b",
      contextType: "PROFESSIONAL_CONNECTION" as const,
      contextReference: "connection-1",
      applicationId: null,
      companyId: null,
      professionalConnectionId: "connection-1",
      lastMessageSequence: null,
      archivedAt: null,
    };
    const gateway = attachSocketIoChatGateway(server, {
      authenticate: async (headers) => {
        const userId = headers.get("x-test-user");
        return userId ? { userId, sessionId: `session-${userId}` } : null;
      },
      conversations: {
        findAccess: async (conversationId, userId) =>
          conversationId === access.id && ["user-a", "user-b"].includes(userId)
            ? access
            : null,
        listAuthorizedConversationIds: async () => [access.id],
        open: async () => ({ conversationId: access.id, created: false }),
      },
      eligibility: {
        canMessage: async () => true,
        authorizeContext: async () => ({
          type: "PROFESSIONAL_CONNECTION",
          reference: "connection-1",
          professionalConnectionId: "connection-1",
          label: "Professional connection",
          companyName: null,
          jobTitle: null,
        }),
      },
      blocks: { isEitherDirectionBlocked: async () => false },
      messages: {
        accept: async (input) => ({
          deduplicated: false,
          message: {
            id: `message-${++sequence}`,
            conversationId: input.conversationId,
            sequence,
            senderId: input.senderId,
            content: input.content,
            createdAt: input.now,
          },
        }),
      },
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing test address");
    const url = `http://127.0.0.1:${address.port}/chat`;
    const client = (userId: string) =>
      createClient(url, {
        path: "/chat",
        transports: ["websocket"],
        extraHeaders: { "x-test-user": userId },
      });
    const sender = client("user-a");
    const receiver = client("user-b");
    closeCallbacks.push(async () => {
      sender.disconnect();
      receiver.disconnect();
      await new Promise<void>((resolve) => gateway.close(() => resolve()));
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });
    await Promise.all([once(sender, "connect"), once(receiver, "connect")]);
    await new Promise((resolve) => setTimeout(resolve, 25));
    const delivered = once(receiver, "message:new");
    const acknowledgement = await sender.emitWithAck("message:send", {
      conversationId: access.id,
      clientOperationId: crypto.randomUUID(),
      content: "Hello from the conversation list",
    });
    expect(acknowledgement).toMatchObject({ ok: true });
    await expect(delivered).resolves.toMatchObject({
      message: { content: "Hello from the conversation list" },
    });
  }, 10_000);
});
