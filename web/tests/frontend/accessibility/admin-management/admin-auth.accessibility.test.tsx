import { readFileSync } from "node:fs";
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

  it("uses the MUI fieldset as the single visible focus indicator for text controls", () => {
    const app = readFileSync(
      "src/frontend/features/admin/app/admin-app.tsx",
      "utf8",
    );
    const layout = readFileSync(
      "src/frontend/features/admin/layout/admin-layout.tsx",
      "utf8",
    );
    expect(app).toContain('"&&:focus-visible"');
    expect(app).toContain('outline: "none"');
    expect(app).toContain('boxShadow: "none"');
    expect(layout).toContain(":not(.MuiInputBase-input)");
    expect(layout).toContain(":not(.MuiSelect-select)");
  });
});
