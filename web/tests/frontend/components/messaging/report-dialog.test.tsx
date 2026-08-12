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
    const trigger = screen.getByRole("button", { name: "Report" });
    fireEvent.click(trigger);
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "OTHER" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    expect(screen.getByRole("status")).toHaveTextContent(/at least 10 characters/i);
    fireEvent.change(screen.getByLabelText("Details (optional)"), {
      target: { value: "Enough detail to explain this report." },
    });
    fireEvent.change(screen.getByLabelText("Evidence message (optional)"), {
      target: { value: "message-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Report received."));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
