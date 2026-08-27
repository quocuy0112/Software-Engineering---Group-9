import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CompanyListScreen } from "@/frontend/features/candidate-company/company-list-screen";

vi.mock("@/frontend/features/dashboard/client/workspace-locale", () => ({
  useWorkspaceLocale: () => "en",
}));

const companies = [
  {
    companyId: "company-1",
    slug: "northstar-labs",
    name: "Northstar Labs",
    logoUrl: null,
    description: "A verified product company.",
  },
] as const;

describe("Candidate Company list", () => {
  it("renders a keyboard-focusable card with fallback branding and detail navigation", () => {
    render(<CompanyListScreen companies={companies} total={1} />);

    const link = screen.getByRole("link", { name: /Northstar Labs/u });
    expect(link).toHaveAttribute("href", "/company/company-1");
    expect(link).toHaveTextContent("View company");
    expect(document.querySelector(".company-avatar")).toHaveTextContent("NL");

    link.focus();
    expect(document.activeElement).toBe(link);
  });

  it("renders an explicit empty state without private company fields", () => {
    render(<CompanyListScreen companies={[]} total={0} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "No companies are available yet",
    );
    expect(
      screen.queryByText("owner@northstar.example"),
    ).not.toBeInTheDocument();
  });

  it("keeps company search text and filters pagination links", () => {
    render(
      <CompanyListScreen
        companies={companies}
        total={49}
        page={2}
        totalPages={3}
        initialQuery="Northstar"
      />,
    );

    expect(
      screen.getByRole("searchbox", { name: "Search companies" }),
    ).toHaveValue("Northstar");
    expect(
      screen.getByRole("navigation", { name: "Companies" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Page 1" })).toHaveAttribute(
      "href",
      "/company?q=Northstar",
    );
    expect(screen.getByText("Northstar Labs")).toBeInTheDocument();
  });
});
