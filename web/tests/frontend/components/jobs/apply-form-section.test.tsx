import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApplyFormSection } from "@/frontend/features/jobs/components/apply-form-section";

const applicationForm = {
  jobId: "job-1",
  jobTitle: "Kỹ sư AutoCAD",
  companyName: "SmartHire",
  profileReady: true,
  missingProfileFields: [],
  contact: {
    fullName: "Nguyễn Văn A",
    email: "candidate@example.com",
    phone: "0901234567",
  },
  cvs: [
    {
      id: "cv-1",
      displayName: "CV chính",
      fileName: "nguyen-van-a.pdf",
      mimeType: "application/pdf" as const,
      byteSize: 2048,
      version: 1,
      confirmedAt: "2026-08-01T00:00:00.000Z",
    },
  ],
  questions: [],
  consentVersion: "2026-08-01",
  csrfToken: "csrf-proof",
};

describe("application form modal", () => {
  it("prefills contact, accepts a local CV draft, and closes from its overlay controls", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => applicationForm,
    });
    const onOpenChange = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ApplyFormSection
        jobId="job-1"
        jobTitle={applicationForm.jobTitle}
        open
        applied={false}
        onOpenChange={onOpenChange}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByRole("form", { name: /apply for kỹ sư autocad/i }),
      ).toBeVisible(),
    );
    expect(screen.getByDisplayValue("Nguyễn Văn A")).toBeVisible();
    expect(screen.getByDisplayValue("candidate@example.com")).toBeVisible();
    expect(screen.getByRole("link", { name: "Learn more" })).toHaveAttribute(
      "href",
      "/legal/ai-cv-analysis-policy",
    );

    expect(screen.getByRole("dialog")).toBeVisible();
    const submit = screen.getByRole("button", {
      name: /submit application/i,
    });
    expect(submit).toBeDisabled();
    const file = new File(["cv"], "resume.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    fireEvent.change(screen.getByLabelText(/drag a cv/i), {
      target: { files: [file] },
    });
    expect(screen.getByText(/resume\.docx/i)).toBeVisible();
    expect(submit).toBeEnabled();

    const backdrop = document.querySelector(".job-apply-modal-backdrop");
    expect(backdrop).not.toBeNull();
    fireEvent.mouseDown(backdrop!);
    expect(onOpenChange).toHaveBeenCalledWith(false);

    fireEvent.click(
      screen.getByRole("button", { name: /close application form/i }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    vi.unstubAllGlobals();
  });

  it("keeps typed and pasted phone digits visible and normalizes only on submit", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...applicationForm,
          contact: { ...applicationForm.contact, phone: "" },
        }),
      })
      .mockResolvedValueOnce({
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
      <ApplyFormSection
        jobId="job-1"
        jobTitle={applicationForm.jobTitle}
        open
        applied={false}
        onOpenChange={() => undefined}
      />,
    );

    await waitFor(() =>
      expect(screen.getByLabelText(/phone number/i)).toBeVisible(),
    );
    const phone = screen.getByLabelText(/phone number/i) as HTMLInputElement;
    const localNumber = "0912345678";
    for (let end = 1; end <= localNumber.length; end += 1) {
      fireEvent.change(phone, { target: { value: localNumber.slice(0, end) } });
      expect(phone).toHaveValue(localNumber.slice(0, end));
    }

    fireEvent.change(phone, { target: { value: "+84 912-345-678" } });
    expect(phone).toHaveValue("+84912345678");

    fireEvent.change(screen.getByLabelText(/use a saved smarthire cv/i), {
      target: { value: "cv-1" },
    });
    fireEvent.change(phone, { target: { value: localNumber } });
    fireEvent.click(
      screen.getByRole("button", { name: /submit application/i }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      contactSnapshot: { phone: "+84912345678" },
    });
    vi.unstubAllGlobals();
  });
});
