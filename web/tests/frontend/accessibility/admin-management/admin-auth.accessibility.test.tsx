import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminTwoFactorPage } from "@/frontend/features/admin/auth/admin-two-factor-page";
describe("admin auth accessibility", () => {
  it("has no serious or critical axe violations in the factor step", async () => {
    const { container } = render(<AdminTwoFactorPage onComplete={vi.fn()} />);
    const axe = (await import("axe-core")).default;
    const result = await axe.run(container);
    expect(
      result.violations.filter((item) =>
        ["serious", "critical"].includes(item.impact ?? ""),
      ),
    ).toEqual([]);
  });
});
