import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  PrivateMatchAnalysisSteps,
  PrivateMatchPrivacyCard,
  PrivateMatchSelectedJobCard,
  PrivateMatchStatusBadge,
} from "@/frontend/features/private-cv-match/components/private-match-shared";

const selectedJob = {
  title: "Senior Backend Developer",
  company: "NovaTech",
  location: "Ho Chi Minh City",
  employmentType: "FULL_TIME",
  requiredExperienceYears: 3,
  jdVersion: 3,
} as const;

describe("private CV match state UI primitives", () => {
  it("uses one bordered status-card language for analyzing and completed states", () => {
    const { rerender } = render(<PrivateMatchStatusBadge state="analyzing" />);

    expect(screen.getByRole("status")).toHaveClass(
      "private-match-status-card",
      "private-match-status-card--analyzing",
    );
    expect(screen.getByText("Analysis in progress")).toBeVisible();
    expect(screen.getByRole("status").querySelector("svg")).toBeInTheDocument();

    rerender(<PrivateMatchStatusBadge state="completed" />);

    expect(screen.getByRole("status")).toHaveClass(
      "private-match-status-card",
      "private-match-status-card--completed",
    );
    expect(screen.getByText("Completed just now")).toBeVisible();
  });

  it("binds the selected job card to humanized, icon-prefixed tags", () => {
    render(<PrivateMatchSelectedJobCard job={selectedJob} />);

    expect(screen.getByText("Senior Backend Developer")).toBeVisible();
    expect(screen.getByText("NovaTech · Ho Chi Minh City")).toBeVisible();
    expect(screen.getByText("Full-time")).toBeVisible();
    expect(screen.getByText("3+ years")).toBeVisible();
    expect(screen.queryByText("FULL_TIME")).not.toBeInTheDocument();
    expect(
      document.querySelectorAll(".private-match-job-tag svg"),
    ).toHaveLength(2);
    expect(screen.getByText("SmartHire job post · Version 3")).toBeVisible();
  });

  it("pairs analysis state labels with icons and keeps privacy assurance card-like", () => {
    render(
      <>
        <PrivateMatchAnalysisSteps activeStep={2} />
        <PrivateMatchPrivacyCard />
      </>,
    );

    expect(screen.getByText("In progress")).toBeVisible();
    expect(screen.getAllByText("Next")).toHaveLength(2);
    expect(screen.getByText("Private and fair by design")).toBeVisible();
    expect(screen.getByText("Only you can see this report.")).toBeVisible();
    expect(
      screen.getByText("Sensitive personal attributes are excluded."),
    ).toBeVisible();
    expect(
      document.querySelector(".private-match-privacy-assurance-card"),
    ).toBeInTheDocument();
    expect(
      document.querySelectorAll(
        ".private-match-analysis-list .private-match-badge svg",
      ),
    ).toHaveLength(4);
  });
});
