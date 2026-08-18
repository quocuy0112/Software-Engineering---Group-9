import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApplicationWizard } from "@/frontend/features/candidate-applications/components/application-wizard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const draft = {
  draftId: "draft-1",
  jobId: "job-1",
  revision: 1,
  personalInformation: {
    fullName: "Candidate",
    email: "candidate@example.com",
    phone: "",
  },
  cv: null,
  coverLetter: null,
  message: null,
  confirmationAccepted: false,
  updatedAt: "2026-08-17T00:00:00.000Z",
  expiresAt: "2026-09-16T00:00:00.000Z",
} as const;

describe("candidate application wizard", () => {
  it("allows a missing profile phone to be added before continuing", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ...draft,
        revision: 2,
        personalInformation: {
          ...draft.personalInformation,
          phone: "0987654321",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ApplicationWizard
        slug="role"
        job={{
          id: "job-1",
          title: "Role",
          companyName: "Company",
          location: "Remote",
        }}
        initialDraft={draft}
        initialCvs={[]}
        csrfProof="csrf-proof"
      />,
    );

    const phone = screen.getByRole("textbox", { name: "Phone" });
    fireEvent.change(phone, { target: { value: "0987654321" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue to files" }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Application files" })).toBeVisible(),
    );
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      personalInformation: { phone: "0987654321" },
    });
    vi.unstubAllGlobals();
  });
});
