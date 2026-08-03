import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JobApplicationForm } from "@/frontend/features/jobs/components/job-application-form";

const form = {
  jobId: "job-1",
  jobTitle: "Engineer",
  companyName: "Company",
  profileReady: true,
  missingProfileFields: [],
  cvs: [
    {
      id: "cv-1",
      displayName: "Main CV",
      fileName: "cv.pdf",
      mimeType: "application/pdf" as const,
      byteSize: 1000,
      version: 1,
      confirmedAt: "2026-08-01T00:00:00.000Z",
    },
  ],
  questions: [
    {
      id: "q-1",
      prompt: "Experience?",
      description: null,
      kind: "TEXT" as const,
      required: true,
      options: null,
      version: 1,
    },
  ],
  consentVersion: "2026-08-01",
  csrfToken: "csrf-proof",
};

describe("job application form", () => {
  it("labels CV, answers, cover letter, consent, and pending submission", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          applicationId: "app-1",
          jobId: "job-1",
          stage: "APPLIED",
          submittedAt: "2026-08-01T00:00:00.000Z",
          created: true,
          message: "Application submitted.",
        }),
      });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <JobApplicationForm
        form={form}
        onCancel={() => undefined}
        onSubmitted={() => undefined}
      />,
    );
    fireEvent.change(screen.getByLabelText(/select cv/i), {
      target: { value: "cv-1" },
    });
    fireEvent.change(screen.getByLabelText(/experience/i), {
      target: { value: "Five years" },
    });
    fireEvent.click(screen.getByLabelText(/i consent/i));
    fireEvent.click(
      screen.getByRole("button", { name: /submit application/i }),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(screen.getByRole("status")).toHaveTextContent(/submitted/i);
    vi.unstubAllGlobals();
  });
});
