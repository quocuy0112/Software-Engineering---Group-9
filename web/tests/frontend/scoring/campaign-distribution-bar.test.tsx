import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CampaignDistributionBar } from "@/frontend/features/recruiter-applications/campaign-distribution-bar";

describe("campaign distribution bar", () => {
  it("renders proportional match segments with an exact percentage tooltip", () => {
    render(
      <CampaignDistributionBar
        jobId="job-1"
        stats={{
          total: 145,
          strong: 92,
          review: 38,
          low: 15,
          processing: 0,
        }}
        fallbackTotal={145}
        loading={false}
        error={false}
      />,
    );

    expect(screen.getByText("92")).toBeInTheDocument();
    expect(screen.getByText("38")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
    expect(screen.getByText("145")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute(
      "aria-label",
      expect.stringContaining("Strong match: 63.4%"),
    );
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Review needed: 26.2%",
    );
  });

  it("uses a neutral scoring placeholder when no candidates are scored", () => {
    render(
      <CampaignDistributionBar
        jobId="job-2"
        stats={{
          total: 4,
          strong: 0,
          review: 0,
          low: 0,
          processing: 4,
        }}
        fallbackTotal={4}
        loading={false}
        error={false}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Scoring in progress");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
