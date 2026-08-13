import { describe, expect, it } from "vitest";
import { MessagingSocketRegistry } from "@/backend/messaging/realtime/messaging-socket-registry";

describe("block enforcement registry", () => {
  it("removes both indexes immediately and preserves other rooms", () => {
    const registry = new MessagingSocketRegistry();
    registry.register({ socketId: "socket-a", userId: "user-a", sessionId: "session-a" });
    registry.joinConversation("socket-a", "conversation-blocked");
    registry.joinConversation("socket-a", "conversation-retained");
    registry.leaveConversation("socket-a", "conversation-blocked");
    expect(registry.conversationIdsForSocket("socket-a")).toEqual(
      new Set(["conversation-retained"]),
    );
    expect(registry.socketIdsForConversation("conversation-blocked").size).toBe(0);
  });

  it("uses account-level socket counts so one tab disconnect does not make the user offline", () => {
    const registry = new MessagingSocketRegistry();
    registry.register({ socketId: "socket-1", userId: "user-a", sessionId: "session-a" });
    registry.register({ socketId: "socket-2", userId: "user-a", sessionId: "session-a" });
    registry.unregister("socket-1");
    expect(registry.isOnline("user-a")).toBe(true);
    registry.unregister("socket-2");
    expect(registry.isOnline("user-a")).toBe(false);
  });
});
