import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useConversations } from "@/frontend/features/messaging/client/use-conversations";
import { useMessageHistory } from "@/frontend/features/messaging/client/use-message-history";

vi.mock("@/frontend/features/messaging/client/chat-socket", () => ({
  getChatSocket: () => ({ connected: false }),
}));

const conversation = {
  id: "conversation-1",
  otherParticipant: { id: "user-b", name: "User B", image: null },
  context: {
    type: "APPLICATION" as const,
    reference: "application-1",
    label: "Software Engineer",
    companyName: "SmartHire",
    jobTitle: "Software Engineer",
  },
  lastMessage: {
    senderId: "user-b",
    content: "Unread message",
    createdAt: new Date(0).toISOString(),
  },
  unreadCount: 2,
  blocked: false,
  presence: "OFFLINE" as const,
  accessMode: "READ_WRITE" as const,
  archivedAt: null,
  createdAt: new Date(0).toISOString(),
};

describe("message read state", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("clears a conversation badge locally after read commits", () => {
    const { result } = renderHook(() => useConversations([conversation]));
    act(() => result.current.clearUnread(conversation.id));
    expect(result.current.items[0]?.unreadCount).toBe(0);
  });

  it("marks loaded messages read and notifies the conversation list", async () => {
    const onReadCommitted = vi.fn();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({
          conversation: {
            ...conversation,
            currentLastSequence: 2,
            currentUserLastReadSequence: 0,
          },
          items: [],
          nextCursor: null,
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          conversationId: conversation.id,
          readerId: "user-a",
          lastReadSequence: 2,
          readAt: new Date().toISOString(),
        }),
      );

    const { result } = renderHook(() =>
      useMessageHistory(conversation.id, "csrf", onReadCommitted),
    );

    await waitFor(() =>
      expect(onReadCommitted).toHaveBeenCalledWith(conversation.id),
    );
    expect(fetchMock).toHaveBeenLastCalledWith(
      `/api/messaging/conversations/${conversation.id}/read`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ lastReadSequence: 2 }),
      }),
    );
    expect(result.current.page?.conversation.unreadCount).toBe(0);
  });
});
