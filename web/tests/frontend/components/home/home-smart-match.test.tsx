import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HomeSmartMatch } from "@/frontend/features/home/components/home-smart-match";
import {
  employerViewer,
  homeModel,
  personalMatch,
} from "../../../helpers/home/home-fixtures";

describe("Home Smart Match presentation", () => {
  it("labels a genuine candidate recommendation and its limitations", () => {
    render(
      <HomeSmartMatch
        model={homeModel({ match: personalMatch() })}
        locale="en"
      />,
    );
    expect(screen.getByText("Personal job-fit recommendation")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText(/not applicant screening or a hiring decision/u)).toBeInTheDocument();
  });

  it.each(["en", "vi"] as const)("clearly labels illustrative content in %s", (locale) => {
    render(<HomeSmartMatch model={homeModel({ viewer: employerViewer })} locale={locale} />);
    expect(screen.getByText(locale === "en" ? "Illustrative Smart Match example" : "Ví dụ Smart Match minh họa")).toBeInTheDocument();
    expect(screen.getByText(locale === "en" ? "Illustrative match estimate" : "Ước tính phù hợp minh họa")).toBeInTheDocument();
    expect(screen.queryByText("Frontend Intern")).not.toBeInTheDocument();
  });
});
