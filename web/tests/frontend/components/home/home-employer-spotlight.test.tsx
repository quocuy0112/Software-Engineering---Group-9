import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HomeEmployerSpotlight } from "@/frontend/features/home/components/home-employer-spotlight";
import { companySpotlight, homeModel } from "../../../helpers/home/home-fixtures";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

describe("Employer Spotlight", () => {
  it("renders only verified public projection fields as display-only content", () => {
    const company = companySpotlight({
      publicSummary: undefined,
      publicLocation: undefined,
      openPositionCount: 7,
    });
    render(<HomeEmployerSpotlight model={homeModel({ companies: [company] })} locale="en" />);
    expect(screen.getByRole("heading", { name: company.name })).toBeInTheDocument();
    expect(screen.getByText("7 open positions")).toBeInTheDocument();
    expect(screen.getByText("Display only")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: company.name })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/mentoring|internship-friendly|work culture|hybrid/iu);
  });

  it("uses honest empty and whole-Home reload states", () => {
    const { rerender } = render(<HomeEmployerSpotlight model={homeModel({ companies: [] })} locale="en" />);
    expect(screen.getByText("No verified public companies are available yet.")).toBeInTheDocument();
    rerender(
      <HomeEmployerSpotlight
        model={{ ...homeModel(), spotlights: { status: "error", items: [], recovery: { kind: "reloadHome" } } }}
        locale="en"
      />,
    );
    expect(screen.getByText("Company information is temporarily unavailable.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reload Home" }));
    expect(refresh).toHaveBeenCalledOnce();
  });
});
