import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmployerVerificationPage } from "@/frontend/features/employer-verification/employer-verification-page";
import { ProtectedEvidenceViewer } from "@/frontend/features/admin/verification/protected-evidence-viewer";
import { VerificationDecisionPanel } from "@/frontend/features/admin/verification/verification-decision-panel";

describe("employer verification components", () => {
  it("labels applicant submission fields and file constraints", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) }),
    );
    render(<EmployerVerificationPage />);
    expect(
      screen.getByRole("heading", { name: "Employer verification" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Vietnamese tax identifier")).toHaveAttribute(
      "pattern",
      "[0-9]{10}",
    );
    expect(screen.getByLabelText("Business license")).toHaveAttribute(
      "accept",
      "application/pdf,image/png,image/jpeg",
    );
  });

  it("disables review when evidence is not qualified or accessible", () => {
    render(
      <ProtectedEvidenceViewer
        requestId="r1"
        evidenceId="e1"
        mediaType="application/pdf"
        accessible={false}
      />,
    );
    expect(screen.getByText(/Decisions are disabled/u)).toBeVisible();
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
