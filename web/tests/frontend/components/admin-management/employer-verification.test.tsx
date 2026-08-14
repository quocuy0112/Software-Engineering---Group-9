import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmployerVerificationPage } from "@/frontend/features/employer-verification/employer-verification-page";
import { ProtectedEvidenceViewer } from "@/frontend/features/admin/verification/protected-evidence-viewer";
import { VerificationDecisionPanel } from "@/frontend/features/admin/verification/verification-decision-panel";

describe("employer verification components", () => {
  it("starts with the registered-business lookup step", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) }),
    );
    render(<EmployerVerificationPage />);
    expect(
      screen.getByRole("heading", { name: "Build a trusted company identity" }),
    ).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: /Vietnamese tax identifier/u }),
    ).toHaveAttribute("pattern", "[0-9]{10}");
    expect(
      screen.getByRole("button", { name: "Look up business" }),
    ).toBeVisible();
    expect(screen.queryByLabelText("Business license")).not.toBeInTheDocument();
  });

  it("disables review when evidence is not qualified or accessible", () => {
    render(
      <ProtectedEvidenceViewer
        requestId="r1"
        evidenceId="e1"
        mediaType="application/pdf"
        byteSize={1_000}
        malwareStatus="FAIL"
        typeStatus="PASS"
        structureStatus="PASS"
        previewStatus="FAIL"
        createdAt="2026-08-14T01:00:00.000Z"
        submissionVersion={1}
        accessible={false}
      />,
    );
    expect(screen.getByText(/Decisions are disabled/u)).toBeVisible();
  });

  it("exposes an explicit recruiter approval action for reviewable requests", () => {
    render(
      <VerificationDecisionPanel
        requestId="r1"
        version={1}
        state="PENDING_REVIEW"
        requestedRole="RECRUITER"
        resubmissionCount={0}
        disabled={false}
        onDone={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Approve recruiter" }),
    ).toBeEnabled();
  });

  it("keeps terminal requests non-actionable", () => {
    render(
      <VerificationDecisionPanel
        requestId="r1"
        version={1}
        state="APPROVED"
        resubmissionCount={0}
        disabled={false}
        onDone={vi.fn()}
      />,
    );
    expect(
      screen.getByText("This request is not currently actionable."),
    ).toBeVisible();
  });
});
