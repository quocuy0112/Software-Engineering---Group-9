import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CandidateApplicationsListPage } from "@/frontend/features/candidate-applications/components/candidate-applications-list-page";
import { NOTIFICATION_CHANGED_EVENT } from "@/frontend/features/notifications/client/use-notification-context-read";
import {
  publicStageForCanonicalStage,
  type CandidateApplicationSummary,
} from "@/shared/contracts/candidate-applications";
import type { ApplicationStage } from "@/shared/contracts/jobs/applications";

function application(
  stage: ApplicationStage,
  index: number,
  publicOutcome: CandidateApplicationSummary["publicOutcome"] = null,
): CandidateApplicationSummary {
  return {
    applicationId: `application-${index}`,
    jobId: `job-${index}`,
    jobSlug: `job-${index}`,
    jobTitle: `Role ${index}`,
    companyName: "SmartHire",
    companyLogoUrl: null,
    location: "Ho Chi Minh City",
    publicStage: publicStageForCanonicalStage(stage),
    publicOutcome,
    canonicalStage: stage,
    stageVersion: 1,
    submittedAt: "2026-08-01T00:00:00.000Z",
    lastUpdatedAt: "2026-08-02T00:00:00.000Z",
    jobAvailable: true,
  };
}

const applications: CandidateApplicationSummary[] = [
  application("APPLIED", 1),
  application("VIEWED", 2),
  application("SHORTLISTED", 3),
  application("INTERVIEWING", 4),
  application("OFFERED", 5),
  application("HIRED", 6),
  application("OFFER_DECLINED", 7),
  application("REJECTED", 8),
  application("WAITLISTED", 9),
  application("INTERVIEWING", 10, "WITHDRAWN"),
];

afterEach(() => {
  vi.unstubAllGlobals();
});

function openFilter() {
  fireEvent.click(screen.getByRole("button", { name: /^Filter:/u }));
}

function chooseFilter(name: RegExp) {
  openFilter();
  fireEvent.click(screen.getByRole("option", { name }));
}

describe("candidate applications list filters", () => {
  it("falls back to a company monogram for an unavailable logo", () => {
    render(
      <CandidateApplicationsListPage
        initialApplications={[
          {
            ...application("APPLIED", 11),
            companyName: "Smart Hire",
            companyLogoUrl: "https://example.com/logo.png",
          },
        ]}
        initialNextCursor={null}
      />,
    );

    expect(screen.getByText("SH")).toBeVisible();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("shows counts, separates terminal filters, and includes Offer sent in Outcome", () => {
    render(
      <CandidateApplicationsListPage
        initialApplications={applications}
        initialNextCursor={null}
      />,
    );

    openFilter();

    expect(
      screen.getByRole("option", {
        name: "Under review, 2 applications",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("option", { name: "Withdrawn, 1 application" }),
    ).toBeVisible();
    expect(screen.getByText("Terminal")).toBeVisible();
    expect(
      screen.getByRole("option", { name: "Outcome, 5 applications" }),
    ).toHaveClass("candidate-application-filter__option--terminal-start");
  });

  it("uses the same effective mapping for Under review, Outcome, and Withdrawn", () => {
    render(
      <CandidateApplicationsListPage
        initialApplications={applications}
        initialNextCursor={null}
      />,
    );

    chooseFilter(/Under review, 2 applications/u);
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getByText("Viewed")).toBeVisible();
    expect(screen.getByText("Shortlisted")).toBeVisible();

    chooseFilter(/Outcome, 5 applications/u);
    expect(screen.getAllByRole("article")).toHaveLength(5);
    expect(screen.getByText("Offer sent")).toBeVisible();
    expect(screen.getByText("Hired")).toBeVisible();
    expect(screen.getByText("Offer declined")).toBeVisible();
    expect(screen.getByText("Rejected")).toBeVisible();
    expect(screen.getByText("Waitlisted")).toBeVisible();
    expect(screen.queryByText("Withdrawn")).not.toBeInTheDocument();

    chooseFilter(/Withdrawn, 1 application/u);
    expect(screen.getAllByRole("article")).toHaveLength(1);
    const withdrawnCard = screen.getByRole("article");
    const withdrawnBadge = within(withdrawnCard).getByText("Withdrawn");
    expect(withdrawnBadge).toBeVisible();
    expect(
      withdrawnBadge.closest(".candidate-application-status-badge"),
    ).toHaveAttribute("data-stage", "withdrawn");
  });

  it("renders a badge for every canonical stage value", () => {
    render(
      <CandidateApplicationsListPage
        initialApplications={applications}
        initialNextCursor={null}
      />,
    );

    expect(
      Array.from(document.querySelectorAll("[data-stage]")).map((badge) =>
        badge.getAttribute("data-stage"),
      ),
    ).toEqual([
      "applied",
      "viewed",
      "shortlisted",
      "interviewing",
      "offered",
      "hired",
      "offer-declined",
      "rejected",
      "waitlisted",
      "withdrawn",
    ]);
  });

  it("refreshes application stages when a notification arrives", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        applications: [application("VIEWED", 1)],
        nextCursor: null,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CandidateApplicationsListPage
        initialApplications={[application("APPLIED", 1)]}
        initialNextCursor={null}
      />,
    );

    window.dispatchEvent(new Event(NOTIFICATION_CHANGED_EVENT));

    await waitFor(() => expect(screen.getByText("Viewed")).toBeVisible());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/candidate/applications?limit=24",
      expect.objectContaining({
        cache: "no-store",
        credentials: "same-origin",
      }),
    );
  });
});
