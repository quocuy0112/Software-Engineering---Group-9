import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApplicationTracker } from "@/frontend/features/candidate-applications/components/application-tracker";
import type { ApplicationTracker as ApplicationTrackerData } from "@/shared/contracts/candidate-applications";

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
}));

vi.mock("@/frontend/features/authentication/client/current-csrf-proof", () => ({
  mutateWithCurrentCsrf: mocks.mutate,
}));

const timestamp = "2026-08-18T09:01:00.000Z";

function offeredTracker(): ApplicationTrackerData {
  return {
    applicationId: "application-1",
    job: {
      jobId: "job-1",
      slug: "merchandising-manager",
      title: "Merchandising Manager",
      companyName: "Unity Trading Co.",
      companyLogoUrl: null,
      location: "Ho Chi Minh City",
      employmentType: "FULL_TIME",
      experienceLevel: "MID",
      workArrangement: "ON_SITE",
      applicationDeadline: null,
      jobAvailable: true,
    },
    publicStage: "OUTCOME",
    publicOutcome: "OFFERED",
    canonicalStage: "OFFERED",
    transitionFromStage: "INTERVIEWING",
    stageVersion: 4,
    submittedAt: timestamp,
    lastUpdatedAt: timestamp,
    intake: {
      state: "SENT_TO_RECRUITER",
      progressPercent: 100,
      steps: [
        {
          code: "APPLICATION_RECEIVED",
          status: "COMPLETE",
          timestamp,
        },
        {
          code: "CHECKING_FILES",
          status: "COMPLETE",
          timestamp,
        },
        {
          code: "SENT_TO_RECRUITER",
          status: "COMPLETE",
          timestamp,
        },
      ],
      failureCode: null,
      updatedAt: timestamp,
    },
    updates: [
      {
        id: "update-1",
        kind: "SUBMITTED",
        publicStage: "APPLICATION_SUBMITTED",
        publicOutcome: null,
        canonicalStage: "APPLIED",
        title: "Application submitted",
        occurredAt: timestamp,
      },
      {
        id: "update-2",
        kind: "OUTCOME",
        publicStage: "OUTCOME",
        publicOutcome: "OFFERED",
        canonicalStage: "OFFERED",
        title: "Offer sent",
        occurredAt: timestamp,
      },
    ],
    files: [
      {
        versionId: "cv-1",
        displayName: "candidate-cv.pdf",
        fileName: "candidate-cv.pdf",
        mimeType: "application/pdf",
        byteSize: 1_024,
        version: 1,
        pageCount: 1,
        parseStatus: "READY",
        confirmedAt: timestamp,
      },
    ],
    notificationPreference: {
      emailEnabled: true,
      inAppEnabled: true,
      version: 1,
      updatedAt: timestamp,
    },
    canWithdraw: false,
  };
}

function renderTracker(initialTracker = offeredTracker()) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => offeredTracker(),
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("crypto", {
    randomUUID: () => "idempotency-key-123456",
  });
  render(
    <ApplicationTracker initialTracker={initialTracker} csrfProof="csrf" />,
  );
  return fetchMock;
}

afterEach(() => {
  mocks.mutate.mockReset();
  vi.unstubAllGlobals();
});

describe("candidate offer response confirmation", () => {
  it("requires confirmation before accepting an offer", async () => {
    mocks.mutate.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    renderTracker();

    fireEvent.click(screen.getByRole("button", { name: "Accept offer" }));

    expect(
      screen.getByRole("dialog", { name: "Accept this offer?" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Confirm acceptance" }),
    ).toBeVisible();
    expect(mocks.mutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.mutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Accept offer" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm acceptance" }));

    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(1));
    expect(mocks.mutate).toHaveBeenCalledWith(
      "/api/candidate/applications/application-1/offer-response",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ decision: "ACCEPT", expectedVersion: 4 }),
      }),
      "csrf",
    );
  });

  it("requires confirmation before declining an offer", async () => {
    mocks.mutate.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    renderTracker();

    fireEvent.click(screen.getByRole("button", { name: "Decline offer" }));

    expect(
      screen.getByRole("dialog", { name: "Decline this offer?" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Confirm decline" }),
    ).toBeVisible();
    expect(mocks.mutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirm decline" }));

    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(1));
    expect(mocks.mutate).toHaveBeenCalledWith(
      "/api/candidate/applications/application-1/offer-response",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ decision: "DECLINE", expectedVersion: 4 }),
      }),
      "csrf",
    );
  });
});

describe("candidate application withdrawal confirmation", () => {
  it("requires confirmation before withdrawing an application", async () => {
    mocks.mutate.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    renderTracker({ ...offeredTracker(), canWithdraw: true });

    fireEvent.click(
      screen.getByRole("button", { name: "Withdraw application" }),
    );

    expect(
      screen.getByRole("dialog", { name: "Withdraw this application?" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Confirm withdrawal" }),
    ).toBeVisible();
    expect(mocks.mutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.mutate).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Withdraw application" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm withdrawal" }));

    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(1));
    expect(mocks.mutate).toHaveBeenCalledWith(
      "/api/candidate/applications/application-1/withdraw",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ expectedVersion: 4, confirmed: true }),
      }),
      "csrf",
    );
  });
});
