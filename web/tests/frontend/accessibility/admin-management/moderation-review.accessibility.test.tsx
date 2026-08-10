import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReportActionPanel } from "@/frontend/features/admin/moderation/report-action-panel";

describe("moderation review accessibility", () => {
  it("has no serious or critical violations in the action panel", async () => {
    const { container } = render(
      <ReportActionPanel
        reportId="report-1"
        version={1}
        state="PENDING_REVIEW"
        onDone={vi.fn()}
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
