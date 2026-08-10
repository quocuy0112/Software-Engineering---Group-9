import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecruiterEntitlementComingNextPage } from "@/frontend/features/recruiter-entitlement/recruiter-entitlement-coming-next-page";

describe("recruiter entitlement coming-next page", () => {
  it("shows exactly the Candidate Dashboard and Employer Verification destinations", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          available: true,
          requiresSelection: false,
          selectedCompanyId: "c1",
          companies: [
            { companyId: "c1", companyName: "Example", role: "RECRUITER" },
          ],
          destinations: [
            { label: "Candidate Dashboard", href: "/dashboard" },
            {
              label: "Employer Verification",
              href: "/dashboard/employer-verification",
            },
          ],
        }),
      }),
    );
    render(<RecruiterEntitlementComingNextPage />);
    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: /Recruiter workspace is coming next/u,
        }),
      ).toBeVisible(),
    );
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Candidate Dashboard",
      "Employer Verification",
    ]);
    expect(
      screen.queryByText(/pipeline|analytics|team management/i),
    ).not.toBeInTheDocument();
  });
});
