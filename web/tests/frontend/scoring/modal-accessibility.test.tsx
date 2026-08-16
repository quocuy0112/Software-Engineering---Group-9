import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RejectCandidateModal } from "@/frontend/features/recruiter-applications/reject-candidate-modal";

const candidate = {
  applicationId: "app-1",
  stage: "SCREENED",
  stageVersion: 1,
  submittedAt: "2026-08-15T00:00:00.000Z",
  candidate: { displayName: "Candidate One", verifiedEmail: "candidate@example.com", avatarUrl: null },
  experienceYears: null,
  skills: [],
  scoring: { kind: "PROCESSING", label: "Processing", operationId: "operation-1" },
  scoreSummary: { automatic: null, ai: null, final: null, band: null },
  manuallyPrioritized: false,
  manualPriority: null,
  allowedActions: { moveToInterview: { allowed: true, label: "Move" }, reject: { allowed: true, label: "Reject" } },
} as never;

describe("ranking confirmation accessibility", () => {
  it("requires a standardized reason and does not focus the destructive action by default", () => {
    render(<RejectCandidateModal candidate={candidate} onCancel={vi.fn()} onCompleted={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Reject" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute("data-modal-cancel");
    expect(document.activeElement).not.toBe(screen.getByRole("button", { name: "Reject" }));
  });
});
