import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReportMessagingDialog } from "@/frontend/features/messaging/components/report-messaging-dialog";

beforeEach(() => vi.restoreAllMocks());

describe("ReportMessagingDialog", () => {
  it("validates Other, submits optional evidence, and restores focus", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ receipt: "REPORT_RECEIVED" }), {
        status: 202,
        headers: { "content-type": "application/json" },
      }),
    );
    render(
      <ReportMessagingDialog
        locale="vi"
        csrfProof="csrf"
        conversationId="conversation-1"
        targetUserId="user-b"
        messages={[
          {
            id: "message-1",
            conversationId: "conversation-1",
            sequence: 1,
            senderId: "user-b",
            content: "Evidence message",
            createdAt: new Date(0).toISOString(),
            delivery: "SENT",
          },
        ]}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Báo cáo" });
    fireEvent.click(trigger);
    fireEvent.change(screen.getByLabelText("Danh mục"), {
      target: { value: "OTHER" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Gửi báo cáo" }));
    expect(screen.getByRole("status")).toHaveTextContent(/ít nhất 10 ký tự/i);
    fireEvent.change(screen.getByLabelText("Chi tiết (không bắt buộc)"), {
      target: { value: "Enough detail to explain this report." },
    });
    fireEvent.change(
      screen.getByLabelText("Tin nhắn làm bằng chứng (không bắt buộc)"),
      {
        target: { value: "message-1" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Gửi báo cáo" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Đã nhận báo cáo và chuyển đến quy trình xem xét bảo mật.",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
