import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RemoveMembershipDialog } from "@/frontend/features/admin/memberships/membership-action-dialog";

describe("company membership actions", () => {
  it("requires the exact stronger removal confirmation and rationale", () => {
    render(
      <RemoveMembershipDialog
        open
        targetLabel="Example Co / Candidate 42 / RECRUITER"
        confirmationText="REMOVE membership-42"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText(/Removal is terminal/u)).toBeVisible();
    const confirmation = screen.getByRole("textbox", {
      name: /Type REMOVE membership-42/u,
    });
    fireEvent.change(confirmation, { target: { value: "REMOVE other" } });
    expect(
      screen.getByRole("button", { name: "Remove membership" }),
    ).toBeDisabled();
  });
});
