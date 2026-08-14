import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HomePersonalShortcuts } from "@/frontend/features/home/components/home-personal-shortcuts";
import { HomeEmployerAction } from "@/frontend/features/home/components/home-employer-action";
import { homeCopy } from "@/frontend/features/home/home-copy";
import {
  candidateViewer,
  employerViewer,
} from "../../../helpers/home/home-fixtures";

describe("Home personal shortcuts", () => {
  it("gives candidates only the approved existing shortcuts", () => {
    render(
      <HomePersonalShortcuts viewer={candidateViewer} copy={homeCopy.en} />,
    );
    expect(
      screen.getAllByRole("link").map((link) => link.getAttribute("href")),
    ).toEqual(["/dashboard", "/jobs/applied", "/jobs/saved"]);
    expect(screen.queryByText(/Orders/u)).not.toBeInTheDocument();
  });

  it("gives employers Dashboard plus the separately authorized recruiter action", () => {
    const { container } = render(
      <>
        <HomePersonalShortcuts viewer={employerViewer} copy={homeCopy.en} />
        <HomeEmployerAction viewer={employerViewer} copy={homeCopy.en} />
      </>,
    );
    expect(
      [...container.querySelectorAll("a")].map((link) =>
        link.getAttribute("href"),
      ),
    ).toEqual(["/dashboard", "https://recruiter.example.test"]);
    expect(screen.queryByText("My Applications")).not.toBeInTheDocument();
    expect(screen.queryByText("Saved Jobs")).not.toBeInTheDocument();
  });

  it("does not guess a Post a Job destination when recruiter status is unavailable", () => {
    render(<HomeEmployerAction viewer={candidateViewer} copy={homeCopy.en} />);
    expect(
      screen.queryByRole("link", { name: "Post a Job" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Status unavailable/u)).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("links a changes-requested candidate back to employer verification", () => {
    render(
      <HomeEmployerAction
        viewer={{
          ...candidateViewer,
          recruiterStatus: {
            state: "CHANGES_REQUESTED",
            destinationKind: "EMPLOYER_VERIFICATION",
            href: "/dashboard/employer-verification",
            observedAt: "2026-08-14T00:00:00.000Z",
          },
        }}
        copy={homeCopy.en}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Update application" }),
    ).toHaveAttribute("href", "/dashboard/employer-verification");
  });
});
