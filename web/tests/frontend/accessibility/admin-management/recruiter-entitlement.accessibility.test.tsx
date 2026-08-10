import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecruiterEntitlementComingNextPage } from "@/frontend/features/recruiter-entitlement/recruiter-entitlement-coming-next-page";

describe("recruiter entitlement accessibility", () => {
  it("has no serious or critical violations with explicit company selection", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          available: false,
          requiresSelection: true,
          selectedCompanyId: null,
          companies: [
            { companyId: "c1", companyName: "One", role: "OWNER" },
            { companyId: "c2", companyName: "Two", role: "RECRUITER" },
          ],
          destinations: [],
        }),
      }),
    );
    const { container } = render(<RecruiterEntitlementComingNextPage />);
    await waitFor(() =>
      expect(container.querySelector("select")).not.toBeNull(),
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
