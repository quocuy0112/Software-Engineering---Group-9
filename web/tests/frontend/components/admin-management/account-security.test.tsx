import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccountStateDialog } from "@/frontend/features/admin/accounts/account-state-dialog";
import { SessionRevocationDialog } from "@/frontend/features/admin/accounts/session-revocation-dialog";
import { NotificationDeliveryStatus } from "@/frontend/features/admin/accounts/notification-delivery-status";
import { StaleConflictPanel } from "@/frontend/features/admin/shared/stale-conflict-panel";

describe("account security components", () => {
  it("names the exact target and disables an incomplete destructive action", () => {
    render(
      <SessionRevocationDialog
        open
        targetLabel="Firefox on Windows for Candidate 42"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/Target: Firefox on Windows for Candidate 42/u),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Revoke session" }),
    ).toBeDisabled();
  });

  it("enforces the 10–500 character rationale boundary", () => {
    render(
      <AccountStateDialog
        open
        title="Suspend account"
        actionLabel="Suspend"
        targetLabel="Candidate 42"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    const input = screen.getByRole("textbox", {
      name: /Private administrator explanation/u,
    });
    fireEvent.change(input, { target: { value: "short" } });
    expect(screen.getByText("5/500 characters; minimum 10")).toBeVisible();
    expect(screen.getByRole("button", { name: "Suspend" })).toBeDisabled();
  });

  it("shows refreshable conflicts and non-sensitive notification state", () => {
    const refresh = vi.fn();
    const { rerender } = render(<StaleConflictPanel onRefresh={refresh} />);
    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
    expect(refresh).toHaveBeenCalledOnce();
    rerender(
      <NotificationDeliveryStatus
        notifications={[
          {
            id: "n1",
            kind: "ACCOUNT_SUSPENDED",
            status: "MANUAL_INTERVENTION_REQUIRED",
            lastAttemptAt: null,
            nextAttemptAt: null,
            failureCategory: "ATTEMPTS_EXHAUSTED",
          },
        ]}
      />,
    );
    expect(screen.getByText(/MANUAL_INTERVENTION_REQUIRED/u)).toBeVisible();
    expect(screen.getByText(/ATTEMPTS_EXHAUSTED/u)).toBeVisible();
  });
});
