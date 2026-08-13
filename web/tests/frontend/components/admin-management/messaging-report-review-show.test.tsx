import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MessagingReportReviewContent } from "@/frontend/features/admin/messaging-reports/messaging-report-review-show";
import type { AdminMessagingReportDetail } from "@/shared/contracts/admin/messaging-reports";

const record: AdminMessagingReportDetail = {
  id: "report-1",
  reporterAccountId: "reporter-1",
  reporterDisplayName: "Reporter",
  targetAccountId: "target-1",
  targetDisplayName: "Reported User",
  targetType: "CONVERSATION",
  category: "ABUSE_OR_THREATS",
  state: "PENDING_REVIEW",
  assignedAdministratorId: null,
  evidenceAvailable: true,
  createdAt: new Date(0).toISOString(),
  version: 1,
  detail: "Reporter supplied context",
  evidence: {
    id: "message-1",
    senderAccountId: "target-1",
    senderDisplayName: "Reported User",
    content: "Only the selected evidence message",
    sentAt: new Date(0).toISOString(),
  },
  history: [],
  notes: [],
  updatedAt: new Date(0).toISOString(),
  handledAt: null,
  handledByAdministratorId: null,
  enforcementCorrelationId: null,
};

describe("messaging report protected detail", () => {
  it("renders the submitted evidence without conversation navigation", () => {
    render(
      <MessagingReportReviewContent record={record} onDone={vi.fn()} />,
    );
    expect(screen.getByText("Reporter supplied context")).toBeVisible();
    expect(
      screen.getByText("Only the selected evidence message"),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: /previous message/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /next message/i })).toBeNull();
  });

  it("shows a bounded unavailable state instead of loading conversation history", () => {
    render(
      <MessagingReportReviewContent
        record={{ ...record, evidenceAvailable: false, evidence: null }}
        onDone={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/Conversation history is not accessible/u),
    ).toBeVisible();
  });
});
