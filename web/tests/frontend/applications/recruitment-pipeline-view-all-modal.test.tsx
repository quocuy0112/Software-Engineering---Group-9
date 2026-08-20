import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ApplicationStage,
  PipelineApplicationCard,
} from "@/shared/contracts/applications";
import {
  RecruitmentPipelineViewAllModal,
  type ActivePipelineStage,
} from "@/frontend/features/recruiter-applications/recruitment-pipeline-view-all-modal";

function card(
  applicationId: string,
  displayName: string,
  stage: ActivePipelineStage,
  final: number | null,
): PipelineApplicationCard {
  return {
    applicationId,
    candidate: { displayName, avatarUrl: null },
    submittedAt: "2026-08-18T00:00:00.000Z",
    stage,
    stageVersion: 1,
    documents: { cvAvailable: true, coverLetterAvailable: false },
    score:
      final === null
        ? null
        : {
            state: "SCORED",
            final,
            aiScore: null,
            band: {
              code: final >= 80 ? "HIGH_MATCH" : "MEDIUM_MATCH",
              label: final >= 80 ? "Strong match" : "Review needed",
            },
            aiScoreBand: null,
          },
    allowedDestinations: ["WAITLISTED", "REJECTED"],
    dragDestinations: ["WAITLISTED", "REJECTED"],
  };
}

function page(stage: ApplicationStage, items: PipelineApplicationCard[], nextCursor: string | null) {
  return {
    stage,
    items,
    nextCursor,
    observedAt: "2026-08-18T00:00:00.000Z",
  };
}

describe("RecruitmentPipelineViewAllModal", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        const secondPage = url.includes("cursor=cursor-2");
        return Promise.resolve({
          ok: true,
          json: async () =>
            secondPage
              ? page(
                  "APPLIED",
                  [card("application-3", "Cara Candidate", "APPLIED", null)],
                  null,
                )
              : page(
                  "APPLIED",
                  [
                    card("application-1", "Ada Candidate", "APPLIED", 88),
                    card("application-2", "Bea Candidate", "APPLIED", 62),
                  ],
                  "cursor-2",
                ),
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("loads every cursor page, shows the API total, and exposes stage actions", async () => {
    const onBulkMove = vi.fn().mockResolvedValue(undefined);
    const onBulkReject = vi.fn();
    render(
      <RecruitmentPipelineViewAllModal
        jobId="job-1"
        summary={{ stage: "APPLIED", label: "Applied", count: 3 }}
        canMoveStages
        canReject
        onClose={vi.fn()}
        onBulkMove={onBulkMove}
        onBulkReject={onBulkReject}
      />,
    );

    expect(screen.getByRole("dialog")).toHaveAttribute("id", "viewAllModal");
    expect(screen.getByText("Total 3 candidates in this stage.")).toBeVisible();
    expect(
      await screen.findByText("Cara Candidate"),
    ).toBeVisible();
    expect(screen.getByText("88%")).toBeVisible();
    expect(screen.getByText("Strong match")).toBeVisible();
    expect(screen.getByText("Not yet scored")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Move to shortlist" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Waitlist" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reject" })).toBeDisabled();
  });

  it("selects the full list and sends bulk reject to the shared reason flow", async () => {
    const onBulkReject = vi.fn();
    const confirmSpy = vi.spyOn(window, "confirm");
    render(
      <RecruitmentPipelineViewAllModal
        jobId="job-1"
        summary={{ stage: "APPLIED", label: "Applied", count: 3 }}
        canMoveStages
        canReject
        onClose={vi.fn()}
        onBulkMove={vi.fn().mockResolvedValue(undefined)}
        onBulkReject={onBulkReject}
      />,
    );

    await screen.findByText("Cara Candidate");
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Select all in this list" }),
    );

    expect(screen.getByText("3 candidates selected")).toBeVisible();
    expect(screen.getByRole("button", { name: "Reject" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));

    await waitFor(() => expect(onBulkReject).toHaveBeenCalledOnce());
    expect(onBulkReject.mock.calls[0][0]).toHaveLength(3);
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});
