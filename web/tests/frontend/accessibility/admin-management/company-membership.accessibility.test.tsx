import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RemoveMembershipDialog } from "@/frontend/features/admin/memberships/membership-action-dialog";

describe("company membership accessibility", () => {
  it("has no serious or critical violations in terminal removal", async () => {
    const { container } = render(
      <RemoveMembershipDialog
        open
        targetLabel="Example Co / Candidate 42"
        confirmationText="REMOVE membership-42"
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
