import { render, screen } from "@testing-library/react";
import { RecordContextProvider } from "react-admin";
import { describe, expect, it } from "vitest";
import { CompanyDetailContent } from "@/frontend/features/admin/companies/company-detail-show";

const detail = {
  id: "comp-0087-alpha-international",
  company: {
    id: "comp-0087-alpha-international",
    legalName: "Alpha International Co., Ltd.",
    displayName: "Alpha International",
    verificationState: "ACTIVE" as const,
    verifiedAt: "2026-08-18T01:00:00.000Z",
    createdAt: "2026-08-01T01:00:00.000Z",
    updatedAt: "2026-08-18T01:00:00.000Z",
  },
  membershipSummary: {
    total: 1,
    active: 1,
    suspended: 0,
    removed: 0,
    activeOwnerCount: 1,
    recent: [
      {
        id: "membership-1",
        accountDisplayName: "Alpha Owner",
        role: "OWNER",
        state: "ACTIVE",
        updatedAt: "2026-08-18T01:00:00.000Z",
      },
    ],
  },
  verificationSummary: { totalRequestCount: 1, latest: null },
  activitySummary: {
    activeJobCount: 3,
    closedJobCount: 1,
    pendingJobReviewCount: 2,
    openModerationReportCount: 0,
  },
};

describe("CompanyDetailContent", () => {
  it("shows the bounded company summary and single-owner warning", () => {
    render(
      <RecordContextProvider value={detail}>
        <CompanyDetailContent />
      </RecordContextProvider>,
    );

    expect(
      screen.getByRole("heading", { name: "Alpha International Co., Ltd." }),
    ).toBeVisible();
    expect(screen.getByText("Recruitment activity")).toBeVisible();
    expect(screen.getByText("Pending job reviews")).toBeVisible();
    expect(screen.getByText(/one active owner/i)).toBeVisible();
  });

  it("warns when the company has no active owner", () => {
    render(
      <RecordContextProvider
        value={{
          ...detail,
          membershipSummary: {
            ...detail.membershipSummary,
            activeOwnerCount: 0,
            recent: [],
          },
        }}
      >
        <CompanyDetailContent />
      </RecordContextProvider>,
    );

    expect(screen.getByText(/no active owner/i)).toBeVisible();
    expect(
      screen.getByText("No memberships are associated with this company."),
    ).toBeVisible();
  });
});
