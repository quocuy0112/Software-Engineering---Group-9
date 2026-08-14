import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecruiterHeaderAction } from "@/frontend/features/recruiter-header/components/recruiter-header-action";
import type { RecruiterHeaderStatus } from "@/shared/contracts/recruiter-header-status";

const observedAt = "2026-08-11T00:00:00.000Z";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("recruiter header action", () => {
  it("renders a safe placeholder without a confirmed label", () => {
    render(<RecruiterHeaderAction />);
    expect(screen.getByRole("status")).toHaveAttribute(
      "aria-label",
      "Checking status",
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps pending review focusable and non-activating", () => {
    const open = vi.spyOn(window, "open");
    render(
      <RecruiterHeaderAction
        initialStatus={
          {
            state: "PENDING_REVIEW",
            destinationKind: "NONE",
            href: null,
            observedAt,
          } as RecruiterHeaderStatus
        }
      />,
    );
    const action = screen.getByRole("button", {
      name: "Application Under Review",
    });
    expect(action).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(action);
    fireEvent.keyDown(action, { key: "Enter" });
    fireEvent.keyDown(action, { key: " " });
    expect(open).not.toHaveBeenCalled();
  });

  it.each([
    ["NEVER_APPLIED", "Apply as Recruiter"],
    ["CHANGES_REQUESTED", "Update Application"],
    ["REJECTED", "Reapply as Recruiter"],
    ["APPROVED", "Recruiter Workspace"],
  ] as const)("renders the %s label", (state, label) => {
    render(
      <RecruiterHeaderAction
        initialStatus={
          {
            state,
            destinationKind:
              state === "APPROVED"
                ? "RECRUITER_WORKSPACE"
                : "EMPLOYER_VERIFICATION",
            href:
              state === "APPROVED"
                ? "https://recruiter.example.test"
                : "/dashboard/employer-verification",
            observedAt,
          } as RecruiterHeaderStatus
        }
      />,
    );
    expect(screen.getByRole("button", { name: label })).toBeVisible();
  });

  it("keeps a changes-requested application actionable", () => {
    render(
      <RecruiterHeaderAction
        initialStatus={{
          state: "CHANGES_REQUESTED",
          destinationKind: "EMPLOYER_VERIFICATION",
          href: "/dashboard/employer-verification",
          observedAt,
        }}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Update Application" }),
    ).not.toHaveAttribute("aria-disabled");
  });

  it("opens the approved external destination once", () => {
    const open = vi.spyOn(window, "open").mockReturnValue({} as Window);
    render(
      <RecruiterHeaderAction
        initialStatus={{
          state: "APPROVED",
          destinationKind: "RECRUITER_WORKSPACE",
          href: "https://recruiter.example.test",
          observedAt,
        }}
      />,
    );
    const action = screen.getByRole("button", { name: "Recruiter Workspace" });
    fireEvent.click(action);
    fireEvent.click(action);
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(
      "https://recruiter.example.test/",
      "_blank",
      "noopener,noreferrer",
    );
  });
});
