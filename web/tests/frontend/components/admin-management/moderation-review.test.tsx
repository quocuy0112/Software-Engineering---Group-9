import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReportActionPanel } from "@/frontend/features/admin/moderation/report-action-panel";

describe("moderation review actions", () => {
  it("exposes explicit actions, bounded private note, and separate enforcement link", () => {
    render(
      <ReportActionPanel
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

  it("does not expose a reopen action for terminal reports", () => {
    render(
      <ReportActionPanel
        reportId="report-1"
        version={2}
        state="RESOLVED"
        onDone={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /reopen/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Resolve report" }),
    ).not.toBeInTheDocument();
  });
});
