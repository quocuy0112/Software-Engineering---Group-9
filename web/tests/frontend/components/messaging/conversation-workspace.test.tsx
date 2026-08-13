import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConversationList } from "@/frontend/features/messaging/components/conversation-list";
import { MessageThread } from "@/frontend/features/messaging/components/message-thread";

vi.mock("@/frontend/features/messaging/components/message-composer", () => ({
  MessageComposer: () => <div>Composer</div>,
}));

const summary = {
  id: "conversation-1",
  otherParticipant: { id: "user-b", name: "Recruiter B", image: null },
  context: {
    type: "APPLICATION" as const,
    reference: "application-1",
    label: "Software Engineer",
    companyName: "SmartHire",
    jobTitle: "Software Engineer",
  },
  lastMessage: {
    senderId: "user-b",
    content: "Latest message",
    createdAt: new Date(0).toISOString(),
  },
  unreadCount: 2,
  blocked: false,
  presence: "OFFLINE" as const,
  accessMode: "READ_WRITE" as const,
  archivedAt: null,
  createdAt: new Date(0).toISOString(),
};

describe("conversation workspace projections", () => {
  it("selects a conversation and exposes the exact unread badge", () => {
    const onSelect = vi.fn();
    render(
      <ConversationList
        items={[summary]}
        selectedId={null}
        onSelect={onSelect}
        onLoadMore={() => undefined}
        hasMore={false}
      />,
    );
    expect(screen.getByLabelText("2 unread messages")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /recruiter b/i }));
    expect(onSelect).toHaveBeenCalledWith("conversation-1");
  });

  it("renders chronological history, delivery state, load older, and mobile back", () => {
    const onBack = vi.fn();
    render(
      <MessageThread
        currentUserId="user-a"
        csrfProof="csrf"
        error={null}
        onBack={onBack}
        onLoadOlder={() => undefined}
        onBlockedChanged={() => undefined}
        page={{
          conversation: {
            ...summary,
            currentLastSequence: 2,
            currentUserLastReadSequence: 2,
          },
          items: [
            {
              id: "message-1",
              conversationId: "conversation-1",
              sequence: 1,
              senderId: "user-a",
              content: "First",
              createdAt: new Date(0).toISOString(),
              delivery: "READ",
            },
          ],
          nextCursor: "1",
        }}
      />,
    );
    expect(screen.getByText("First")).toBeVisible();
    expect(screen.getByText("First").closest("li")).toHaveAttribute(
      "data-direction",
      "outgoing",
    );
    expect(screen.getByText("Read")).toBeVisible();
    expect(screen.getByRole("button", { name: /load older/i })).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: /back to conversations/i }),
    );
    expect(onBack).toHaveBeenCalled();
  });
});
