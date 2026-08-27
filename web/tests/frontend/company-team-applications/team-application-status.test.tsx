import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { TeamApplicationStatus } from "@/frontend/features/candidate-company/team-application-status";
import { teamApplicationFixture } from "../../helpers/company-team-applications-fixture";

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

describe("Candidate Team Application status", () => {
  beforeEach(() => mutateMock.mockReset());

  it("shows an in-app withdrawal confirmation before sending the request", async () => {
    const application = teamApplicationFixture();
    mutateMock.mockResolvedValue(
      new Response(
        JSON.stringify(teamApplicationFixture({ status: "WITHDRAWN" })),
        { status: 200 },
      ),
    );

    render(<TeamApplicationStatus initialApplications={[application]} />);
    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(mutateMock).not.toHaveBeenCalled();

    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Cancel",
      }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Withdraw application",
      }),
    );

    await waitFor(() => expect(mutateMock).toHaveBeenCalledOnce());
    expect(screen.getByRole("status")).toHaveTextContent(
      "Your application to Northstar Labs was withdrawn.",
    );
    expect(screen.getByText("Withdrawn")).toBeInTheDocument();
  });

  it("provides a direct invitation review link for a pending team invitation", () => {
    const application = teamApplicationFixture({
      status: "INVITATION_SENT",
      invitationStatus: "PENDING",
      invitationId: "invitation-1",
    });

    render(<TeamApplicationStatus initialApplications={[application]} />);

    expect(
      screen.getByRole("link", { name: "Review invitation" }),
    ).toHaveAttribute(
      "href",
      "/recruiter/company-invitation?invitationId=invitation-1",
    );
  });
});
