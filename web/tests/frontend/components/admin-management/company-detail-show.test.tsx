import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RecordContextProvider } from "react-admin";
import { describe, expect, it } from "vitest";
import { CompanyDetailContent } from "@/frontend/features/admin/companies/company-detail-show";
import {
  CompanyPeopleField,
  CompanyTrustField,
  CompanyWorkQueueField,
} from "@/frontend/features/admin/companies/company-list-fields";

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

function renderCompanyDetail(value = detail) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <RecordContextProvider value={value}>
        <CompanyDetailContent />
      </RecordContextProvider>
    </QueryClientProvider>,
  );
}

describe("CompanyDetailContent", () => {
  it("surfaces trust, ownership, and queue signals in the company list", () => {
    render(
      <RecordContextProvider
        value={{
          id: "company-1",
          legalName: "Alpha International Co., Ltd.",
          displayName: "Alpha International",
          verificationState: "ACTIVE",
          moderationState: "BANNED",
          metrics: {
            activeMembershipCount: 4,
            activeOwnerCount: 1,
            pendingJobReviewCount: 2,
            openModerationReportCount: 3,
          },
        }}
      >
        <CompanyTrustField />
        <CompanyPeopleField />
        <CompanyWorkQueueField />
      </RecordContextProvider>,
    );
    expect(screen.getByText("Verified")).toBeVisible();
    expect(screen.getByText("Banned")).toBeVisible();
    expect(screen.getByText("4 active members")).toBeVisible();
    expect(screen.getByText("Review 2")).toBeVisible();
    expect(screen.getByText("Reports 3")).toBeVisible();
  });

  it("shows the bounded company summary and single-owner warning", () => {
    renderCompanyDetail();

    expect(
      screen.getByRole("heading", { name: "Alpha International Co., Ltd." }),
    ).toBeVisible();
    expect(screen.getByText("Recruitment activity")).toBeVisible();
    expect(screen.getByText("Pending job reviews")).toBeVisible();
    expect(screen.getByText(/one active owner/i)).toBeVisible();
  });

  it("warns when the company has no active owner", () => {
    renderCompanyDetail({
      ...detail,
      membershipSummary: {
        ...detail.membershipSummary,
        activeOwnerCount: 0,
        recent: [],
      },
    });

    expect(screen.getByText(/no active owner/i)).toBeVisible();
    expect(
      screen.getByText("No memberships are associated with this company."),
    ).toBeVisible();
  });
});
