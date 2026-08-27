import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CompanyDetailScreen } from "@/frontend/features/candidate-company/company-detail-screen";
import {
  approvedCompanyFixture,
  teamRoleFixtures,
} from "../../helpers/company-team-applications-fixture";

vi.mock("@/frontend/features/dashboard/client/workspace-locale", () => ({
  useWorkspaceLocale: () => "en",
}));

describe("Company job search controls", () => {
  it("exposes a location selector and an explicit no-results reset action", () => {
    render(
      <CompanyDetailScreen
        initialCompany={{
          companyId: approvedCompanyFixture.id,
          slug: approvedCompanyFixture.slug,
          name: approvedCompanyFixture.displayName,
          logoUrl: null,
          description: approvedCompanyFixture.publicDescription,
          foundedYear: approvedCompanyFixture.foundedYear,
          sizeRange: "1–10 employees",
          industry: approvedCompanyFixture.industry,
          location: approvedCompanyFixture.publicLocation,
          activeEmployeeCount: 2,
          teamRoles: [...teamRoleFixtures],
          jobs: [],
          jobTotal: 0,
          jobPage: 1,
          jobTotalPages: 0,
        }}
      />,
    );

    expect(screen.getByRole("textbox", { name: "Keyword" })).toBeEnabled();
    expect(screen.getByRole("combobox", { name: "Location" })).toBeEnabled();
    expect(
      screen.getByText("No open positions match these filters"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear" })).toBeEnabled();
  });
});
