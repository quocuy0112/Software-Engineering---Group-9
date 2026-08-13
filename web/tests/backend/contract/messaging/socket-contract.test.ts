import { describe, expect, it } from "vitest";
import {
  conversationAccessRevokedEventSchema,
  conversationRoomInputSchema,
  messageNewEventSchema,
} from "@/shared/contracts/messaging/socket-events";
import { sendMessageInputSchema } from "@/shared/contracts/messaging/messages";

describe("chat socket contract", () => {
  it("strictly validates room and send payloads", () => {
    expect(conversationRoomInputSchema.parse({ conversationId: "conversation-1" })).toEqual({
      conversationId: "conversation-1",
    });
    expect(() =>
      sendMessageInputSchema.parse({
        conversationId: "conversation-1",
        clientOperationId: "not-a-uuid",
        content: "Hello",
      }),
    ).toThrow();
  });

  it("keeps outbound events privacy-minimized", () => {
    expect(
      conversationAccessRevokedEventSchema.parse({
        conversationId: "conversation-1",
        code: "AUTHORITY_CHANGED",
      }),
    ).not.toHaveProperty("cause");
    expect(() =>
      messageNewEventSchema.parse({
        message: {
          id: "message-1",
          conversationId: "conversation-1",
          sequence: 1,
          senderId: "user-a",
          content: "Hello",
          createdAt: new Date(0).toISOString(),
          delivery: "SENT",
          email: "private@example.test",
        },
      }),
    ).toThrow();
  });
});
