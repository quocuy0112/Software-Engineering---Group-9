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
        locale="vi"
        items={[summary]}
        selectedId={null}
        onSelect={onSelect}
        onLoadMore={() => undefined}
        hasMore={false}
      />,
    );
    expect(screen.getByLabelText("2 tin nhắn chưa đọc")).toBeVisible();
    expect(screen.getByText("Software Engineer · SmartHire")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /recruiter b/i }));
    expect(onSelect).toHaveBeenCalledWith("conversation-1");
  });

  it("renders chronological history, delivery state, load older, and mobile back", () => {
    const onBack = vi.fn();
    render(
      <MessageThread
        locale="vi"
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
    expect(screen.getByText("Đã xem")).toBeVisible();
    expect(screen.getByText("Software Engineer · SmartHire")).toBeVisible();
    expect(
      screen.getByRole("button", { name: /tải tin nhắn cũ hơn/i }),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", {
        name: /quay lại danh sách cuộc trò chuyện/i,
      }),
    );
    expect(onBack).toHaveBeenCalled();
  });

  it("guides a candidate without conversations to jobs and connections", () => {
    render(
      <MessageThread
        locale="vi"
        csrfProof="csrf"
        error={null}
        page={null}
        hasConversations={false}
        onBack={() => undefined}
        onLoadOlder={() => undefined}
        onBlockedChanged={() => undefined}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Chưa có cuộc trò chuyện nào" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Xem việc làm phù hợp" }),
    ).toHaveAttribute("href", "/jobs");
    expect(
      screen.getByRole("link", { name: "Xem danh bạ kết nối" }),
    ).toHaveAttribute("href", "/connections");
  });
});
