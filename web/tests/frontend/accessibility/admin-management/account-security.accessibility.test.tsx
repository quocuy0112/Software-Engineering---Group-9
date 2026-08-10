import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccountStateDialog } from "@/frontend/features/admin/accounts/account-state-dialog";

describe("account security accessibility", () => {
  it("has no serious or critical violations in the confirmation dialog", async () => {
    const { container } = render(
      <AccountStateDialog
        open
        title="Suspend account"
        actionLabel="Suspend"
        targetLabel="Candidate 42"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    const axe = (await import("axe-core")).default;
    const result = await axe.run(container);
    expect(
      result.violations.filter((item) =>
        ["serious", "critical"].includes(item.impact ?? ""),
      ),
    ).toEqual([]);
  });
});
