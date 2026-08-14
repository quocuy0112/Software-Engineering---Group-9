import { render, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HomeHowItWorks } from "@/frontend/features/home/components/home-how-it-works";
import { HomeCareerPaths } from "@/frontend/features/home/components/home-career-paths";
import { HomeCandidateTrust } from "@/frontend/features/home/components/home-candidate-trust";
import { HomeCompaniesHiring } from "@/frontend/features/home/components/home-companies-hiring";
import {
  companySpotlight,
  homeCareerPaths,
  homeModel,
} from "../../../helpers/home/home-fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("Home workflow and candidate-trust content", () => {
  it.each(["en", "vi"] as const)(
    "keeps workflow, trust, company, and career-path content bounded in %s",
    (locale) => {
      const companies = Array.from({ length: 5 }, (_, index) =>
        companySpotlight({
          slug: `company-${index}`,
          name: `Company ${index + 1}`,
          openPositionCount: index + 1,
        }),
      );
      const { container } = render(
        <>
          <HomeHowItWorks locale={locale} />
          <HomeCareerPaths locale={locale} paths={homeCareerPaths} />
          <HomeCandidateTrust locale={locale} />
          <HomeCompaniesHiring
            locale={locale}
            model={homeModel({ companies, companyCount: 8 })}
          />
        </>,
      );
      expect(container.querySelectorAll(".home-process-step")).toHaveLength(4);
      expect(container.querySelectorAll(".home-path-grid article")).toHaveLength(6);
      expect(
        container.querySelectorAll(".home-candidate-trust-grid article"),
      ).toHaveLength(4);
      expect(
        container.querySelectorAll(".home-companies-hiring-grid article"),
      ).toHaveLength(5);
      expect(within(container).getAllByRole("link")).toHaveLength(7);
      expect(
        within(container).getByRole("link", {
          name: /Software Engineering|Kỹ thuật phần mềm/u,
        }),
      ).toHaveAttribute("href", "/jobs?careerPath=software-engineering");
      expect(
        within(container).getByRole("link", {
          name: /More companies|Doanh nghiệp khác/u,
        }),
      ).toHaveAttribute("href", "/jobs");
      expect(within(container).queryByRole("button")).not.toBeInTheDocument();
      expect(container.textContent).not.toMatch(
        /like|comment|register now|live now/iu,
      );
    },
  );
});
