import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MessageComposer } from "@/frontend/features/messaging/components/message-composer";

const emitWithAck = vi.fn();
vi.mock("@/frontend/features/messaging/client/chat-socket", () => ({
  getChatSocket: () => ({ emitWithAck }),
}));

beforeEach(() => emitWithAck.mockReset());

describe("MessageComposer", () => {
  it("normalizes input and reconciles pending to sent", async () => {
    emitWithAck.mockResolvedValue({
      ok: true,
      data: {
        deduplicated: false,
        message: {
          id: "message-1",
          conversationId: "conversation-1",
          sequence: 1,
          senderId: "sender",
          content: "Hello",
          createdAt: new Date(0).toISOString(),
          delivery: "SENT",
        },
      },
    });
    render(<MessageComposer conversationId="conversation-1" locale="vi" />);
    fireEvent.change(screen.getByRole("textbox", { name: "Tin nhắn" }), {
      target: { value: "  Hello  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Gửi" }));
    await waitFor(() => expect(screen.getByText("Đã gửi")).toBeVisible());
    expect(emitWithAck).toHaveBeenCalledWith(
      "message:send",
      expect.objectContaining({ content: "Hello" }),
    );
  });

  it("shows validation and a retry action after failure", async () => {
    emitWithAck.mockResolvedValue({
      ok: false,
      error: {
        code: "PERSISTENCE_UNAVAILABLE",
        message: "Messaging is temporarily unavailable.",
        retryable: true,
        retryAfterSeconds: null,
      },
    });
    render(<MessageComposer conversationId="conversation-1" locale="vi" />);
    fireEvent.click(screen.getByRole("button", { name: "Gửi" }));
    expect(screen.getByRole("alert")).toBeVisible();
    fireEvent.change(screen.getByRole("textbox", { name: "Tin nhắn" }), {
      target: { value: "Retry me" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Gửi" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Thử lại" })).toBeVisible(),
    );
  });
});
