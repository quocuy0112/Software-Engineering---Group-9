import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApplicationWizard } from "@/frontend/features/candidate-applications/components/application-wizard";

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: toastError } }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

beforeEach(() => toastError.mockReset());

const draft = {
  draftId: "draft-1",
  jobId: "job-1",
  revision: 1,
  personalInformation: {
    fullName: "Candidate",
    email: "candidate@example.com",
    phone: "",
    currentLocation: "",
    linkedInPortfolio: null,
  },
  cv: null,
  cvSource: null,
  coverLetter: null,
  message: null,
  confirmationAccepted: false,
  updatedAt: "2026-08-17T00:00:00.000Z",
  expiresAt: "2026-09-16T00:00:00.000Z",
} as const;

describe("candidate application wizard", () => {
  it("shows an invalid CV file rejection as a toast", async () => {
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
        initialStep={2}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: /upload from device/i }));
    const input = document.querySelector(
      'input[accept^=".pdf,.doc,.docx"]',
    ) as HTMLInputElement;
    const file = new File(["not a cv"], "notes.txt", { type: "text/plain" });
    fireEvent.change(input, {
      target: {
        files: {
          0: file,
          length: 1,
          item: () => file,
        },
      },
    });

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Only PDF, DOC, or DOCX files are supported.",
        { id: "candidate-cv-upload-error" },
      ),
    );
  });

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

    const phone = screen.getByRole("textbox", { name: "Phone number" });
    fireEvent.change(phone, { target: { value: "0987654321" } });
    fireEvent.change(
      screen.getByRole("textbox", { name: "Current location" }),
      {
        target: { value: "Ho Chi Minh City" },
      },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Continue to Application files" }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "CV / Resume" }),
      ).toBeVisible(),
    );
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      personalInformation: { phone: "0987654321" },
    });
    vi.unstubAllGlobals();
  });

  it("keeps continuing disabled until required fields and an optional URL are valid", () => {
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

    const continueButton = screen.getByRole("button", {
      name: "Continue to Application files",
    });
    expect(continueButton).toBeDisabled();

    fireEvent.change(screen.getByRole("textbox", { name: "Phone number" }), {
      target: { value: "0901234567" },
    });
    expect(continueButton).toBeDisabled();

    fireEvent.change(
      screen.getByRole("textbox", { name: "Current location" }),
      {
        target: { value: "Ho Chi Minh City" },
      },
    );
    expect(continueButton).toBeEnabled();

    fireEvent.change(
      screen.getByRole("textbox", { name: /LinkedIn \/ Portfolio/ }),
      { target: { value: "not-a-url" } },
    );
    expect(continueButton).toBeDisabled();

    fireEvent.change(
      screen.getByRole("textbox", { name: /LinkedIn \/ Portfolio/ }),
      { target: { value: "https://linkedin.com/in/candidate" } },
    );
    expect(continueButton).toBeEnabled();
  });

  it("shows the cover-letter recovery notice on the files step", () => {
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
        initialStep={2}
        coverLetterNeedsReupload
      />,
    );

    expect(screen.getByRole("heading", { name: "Apply – Role" })).toBeVisible();
    expect(
      screen.getByText(
        "This cover letter is no longer available. Upload it again before continuing.",
      ),
    ).toBeVisible();
  });

  it("uses one cover-letter mode at a time and limits written text to 2,000 characters", () => {
    render(
      <ApplicationWizard
        slug="role"
        job={{
          id: "job-1",
          title: "Role",
          companyName: "Company",
          location: "Remote",
        }}
        initialDraft={{
          ...draft,
          cvSource: "PROFILE",
          cv: {
            versionId: "candidate-cv-1",
            displayName: "Candidate CV",
            fileName: "Candidate_CV.pdf",
            mimeType: "application/pdf",
            byteSize: 1_200_000,
            version: 1,
            parseStatus: "READY",
            confirmedAt: "2026-08-17T00:00:00.000Z",
          },
        }}
        initialCvs={[
          {
            id: "candidate-cv-1",
            displayName: "Candidate CV",
            fileName: "Candidate_CV.pdf",
            mimeType: "application/pdf",
            byteSize: 1_200_000,
            version: 1,
            confirmedAt: "2026-08-17T00:00:00.000Z",
          },
        ]}
        csrfProof="csrf-proof"
        initialStep={2}
      />,
    );

    expect(
      screen.getByRole("radio", { name: /Candidate_CV\.pdf/ }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("button", {
        name: "Continue to Review and submit",
      }),
    ).toBeEnabled();

    fireEvent.click(screen.getByRole("tab", { name: "Write text" }));
    const coverLetter = screen.getByRole("textbox", {
      name: "Cover letter",
    });
    fireEvent.change(coverLetter, { target: { value: "x".repeat(2_001) } });

    expect(coverLetter).toHaveValue("x".repeat(2_000));
    expect(screen.getByText("2000 / 2000")).toBeVisible();
    expect(screen.queryByText("No parsing required")).not.toBeInTheDocument();
  });
});
