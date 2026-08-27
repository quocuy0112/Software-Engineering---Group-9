import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { CompanyTeamApplicationsScreen } from "@/frontend/features/recruiter-workspace/company-team-applications-screen";
import { teamApplicationFixture } from "../../helpers/company-team-applications-fixture";
import type { OwnerTeamApplication } from "@/shared/contracts/company-members/team-applications";

const { mutateMock } = vi.hoisted(() => ({ mutateMock: vi.fn() }));

vi.mock("@/frontend/features/authentication/client/current-csrf-proof", () => ({
  mutateWithCurrentCsrf: mutateMock,
}));
vi.mock("@/frontend/features/authentication/client/csrf-proof-context", () => ({
  useCsrfProof: () => "csrf-test-proof",
}));

function ownerApplication(
  overrides: Partial<OwnerTeamApplication> = {},
): OwnerTeamApplication {
  return {
    ...teamApplicationFixture(),
    candidateName: "Candidate Nguyen",
    applicationEmail: "candidate@example.com",
    cvFileName: "candidate-resume.pdf",
    cvMimeType: "application/pdf",
    cvByteSize: 64,
    rejectionReason: null,
    invitationEmailStatus: null,
    ...overrides,
  };
}

describe("Owner Team Applications review", () => {
  beforeEach(() => mutateMock.mockReset());
  afterEach(() => vi.unstubAllGlobals());

  it("loads a CV detail and accepts with a confirmed role", async () => {
    const application = ownerApplication();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => application,
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    mutateMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          applicationId: application.applicationId,
          invitationId: "invitation-1",
          role: "HR_MANAGER",
          status: "INVITATION_SENT",
          idempotent: false,
        }),
        { status: 200 },
      ),
    );

    render(
      <CompanyTeamApplicationsScreen
        initialApplications={[application]}
        companyId={application.companyId}
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Candidate Nguyen" }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole("link", { name: "View CV" })).toHaveAttribute(
      "href",
      "/api/recruiter/company/team/applications/application-team-028/cv",
    );
    fireEvent.change(screen.getByLabelText("Invitation role"), {
      target: { value: "HR_MANAGER" },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Accept and invite" })[0],
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Accept and invite",
      }),
    );

    await waitFor(() => expect(mutateMock).toHaveBeenCalledOnce());
    expect(mutateMock).toHaveBeenCalledWith(
      "/api/recruiter/company/team/applications/application-team-028/accept",
      expect.objectContaining({
        body: JSON.stringify({ role: "HR_MANAGER" }),
      }),
      "csrf-test-proof",
    );
    expect(screen.getAllByText("Invitation sent")).not.toHaveLength(0);
  });

  it("sends an optional rejection reason and does not expose an Owner identity", async () => {
    const application = ownerApplication();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => application,
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    mutateMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          applicationId: application.applicationId,
          status: "REJECTED",
          idempotent: false,
        }),
        { status: 200 },
      ),
    );

    render(
      <CompanyTeamApplicationsScreen initialApplications={[application]} />,
    );
    await waitFor(() =>
      expect(
        screen.getByLabelText("Optional rejection reason"),
      ).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByLabelText("Optional rejection reason"), {
      target: { value: "Please add more recruiting experience." },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Reject application" })[0],
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Reject application",
      }),
    );

    await waitFor(() => expect(mutateMock).toHaveBeenCalledOnce());
    expect(mutateMock).toHaveBeenCalledWith(
      "/api/recruiter/company/team/applications/application-team-028/reject",
      expect.objectContaining({
        body: JSON.stringify({
          reason: "Please add more recruiting experience.",
        }),
      }),
      "csrf-test-proof",
    );
    expect(screen.getAllByText("Not selected")).not.toHaveLength(0);
    expect(screen.queryByText(/owner@/iu)).not.toBeInTheDocument();
  });
});
