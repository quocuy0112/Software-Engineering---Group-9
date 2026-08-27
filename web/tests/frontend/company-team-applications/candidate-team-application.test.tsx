import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TeamApplicationForm } from "@/frontend/features/candidate-company/team-application-form";
import {
  signedPdfFixtureBytes,
  teamApplicationFixture,
} from "../../helpers/company-team-applications-fixture";

const { mutateMock } = vi.hoisted(() => ({ mutateMock: vi.fn() }));

vi.mock("@/frontend/features/authentication/client/current-csrf-proof", () => ({
  mutateWithCurrentCsrf: mutateMock,
}));
vi.mock("@/frontend/features/authentication/client/csrf-proof-context", () => ({
  useCsrfProof: () => "csrf-test-proof",
}));
vi.mock("@/frontend/features/dashboard/client/workspace-locale", () => ({
  useWorkspaceLocale: () => "en",
}));

const formProps = {
  companyId: "company-team-028",
  companyName: "Northstar Labs",
  teamRoles: ["HR_MANAGER", "RECRUITER"] as const,
  initialRole: "RECRUITER" as const,
};

describe("Candidate Team Application form", () => {
  beforeEach(() => mutateMock.mockReset());

  it("rejects unsupported and oversized files before making a request", () => {
    render(<TeamApplicationForm {...formProps} />);
    const input = screen.getByLabelText("CV");

    fireEvent.change(input, {
      target: {
        files: [
          new File(["legacy"], "resume.doc", { type: "application/msword" }),
        ],
      },
    });
    expect(
      screen.getByText("Only PDF and DOCX CV files are supported."),
    ).toBeInTheDocument();

    fireEvent.change(input, {
      target: {
        files: [
          new File([new Uint8Array(5_000_001)], "resume.pdf", {
            type: "application/pdf",
          }),
        ],
      },
    });
    expect(
      screen.getByText("The CV must be 5,000,000 bytes or smaller."),
    ).toBeInTheDocument();
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("submits a valid PDF and shows the existing-status confirmation", async () => {
    mutateMock.mockResolvedValue(
      new Response(JSON.stringify(teamApplicationFixture()), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    render(<TeamApplicationForm {...formProps} />);
    fireEvent.change(screen.getByLabelText("CV"), {
      target: {
        files: [
          new File([signedPdfFixtureBytes()], "resume.pdf", {
            type: "application/pdf",
          }),
        ],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply as Recruiter" }));

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Application received" }),
      ).toBeInTheDocument(),
    );
    expect(mutateMock).toHaveBeenCalledWith(
      "/api/candidate/team-applications",
      expect.objectContaining({ method: "POST" }),
      "csrf-test-proof",
    );
  });
});
