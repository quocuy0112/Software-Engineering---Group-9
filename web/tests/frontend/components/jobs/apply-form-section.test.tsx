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

describe("inline application form section", () => {
  it("prefills contact, accepts a local CV draft, and closes inline", async () => {
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
        screen.getByRole("form", { name: /ứng tuyển cho kỹ sư autocad/i }),
      ).toBeVisible(),
    );
    expect(screen.getByDisplayValue("Nguyễn Văn A")).toBeVisible();
    expect(screen.getByDisplayValue("candidate@example.com")).toBeVisible();
    expect(screen.getByRole("link", { name: "Tìm hiểu thêm" })).toHaveAttribute(
      "href",
      "/legal/ai-cv-analysis-policy",
    );

    const submit = screen.getByRole("button", {
      name: /gửi hồ sơ ứng tuyển/i,
    });
    expect(submit).toBeDisabled();
    const file = new File(["cv"], "resume.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    fireEvent.change(screen.getByLabelText(/kéo-thả cv/i), {
      target: { files: [file] },
    });
    expect(screen.getByText(/resume\.docx/i)).toBeVisible();
    expect(submit).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: /huỷ/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    vi.unstubAllGlobals();
  });
});
