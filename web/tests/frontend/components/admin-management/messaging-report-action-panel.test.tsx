import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MessagingReportActionPanel } from "@/frontend/features/admin/messaging-reports/messaging-report-action-panel";

describe("messaging report review actions", () => {
  it("exposes bounded notes and separate enforcement linkage", () => {
    render(
      <MessagingReportActionPanel
        reportId="report-1"
        version={1}
        state="PENDING_REVIEW"
        onDone={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Assign to me" })).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: "Private investigation note" }),
    ).toHaveAttribute("maxlength", "2000");
    expect(
      screen.getByRole("button", { name: "Add private note" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: "Link separately confirmed enforcement",
      }),
    ).toBeDisabled();
  });

  it("does not expose terminal transitions after review", () => {
    render(
      <MessagingReportActionPanel
        reportId="report-1"
        version={4}
        state="RESOLVED"
        onDone={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Resolve report" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Dismiss report" }),
    ).not.toBeInTheDocument();
  });
});
