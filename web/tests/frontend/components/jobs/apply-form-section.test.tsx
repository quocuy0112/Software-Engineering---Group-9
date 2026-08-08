import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApplyFormSection } from "@/frontend/features/jobs/components/apply-form-section";

const applicationForm = {
  jobId: "job-1",
  jobTitle: "Kỹ sư AutoCAD",
  jobLocation: "TP Hồ Chí Minh",
  companyName: "SmartHire",
  profileReady: true,
  missingProfileFields: [],
  profileRevision: 1,
  profileBasics: {
    headline: "Kỹ sư",
    summary: null,
    phone: "0901234567",
    location: "TP Hồ Chí Minh",
  },
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

const savedPdfCv = {
  id: "cv-local-pdf",
  displayName: "resume.pdf",
  fileName: "resume.pdf",
  mimeType: "application/pdf" as const,
  byteSize: 2,
  version: 1,
  confirmedAt: "2026-08-08T00:00:00.000Z",
};
const savedDocxCv = {
  id: "cv-local-docx",
  displayName: "resume.docx",
  fileName: "resume.docx",
  mimeType:
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document" as const,
  byteSize: 2,
  version: 1,
  confirmedAt: "2026-08-08T00:00:00.000Z",
};

describe("application form modal", () => {
  it("prefills contact, attaches a local CV directly, and closes from the X", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => applicationForm,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => savedDocxCv,
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
    expect(screen.getByLabelText(/^location/i)).toHaveValue("TP Hồ Chí Minh");
    expect(screen.getByRole("link", { name: "Learn more" })).toHaveAttribute(
      "href",
      "/legal/ai-cv-analysis-policy",
    );

    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByLabelText(/select a cv from profile/i)).toBeRequired();
    expect(screen.getByLabelText(/full name/i)).toBeRequired();
    expect(screen.getByLabelText(/^email/i)).toBeRequired();
    expect(screen.getByLabelText(/phone number/i)).toBeRequired();
    expect(screen.getByLabelText(/^location/i)).toBeRequired();
    expect(
      screen.getByLabelText(/i consent to smarthire sharing this application/i),
    ).toBeRequired();
    for (const selector of [
      ".job-application-fieldset legend .job-required-mark",
      'label[for="application-full-name"] .job-required-mark',
      'label[for="application-email"] .job-required-mark',
      'label[for="application-phone"] .job-required-mark',
      'label[for="application-location"] .job-required-mark',
      'label[for="application-consent"] .job-required-mark',
    ]) {
      expect(document.querySelector(selector)).not.toBeNull();
    }
    expect(
      document.querySelector(
        'label[for="application-cover-letter"] .job-required-mark',
      ),
    ).toBeNull();
    const submit = screen.getByRole("button", {
      name: /submit application/i,
    });
    expect(submit).toBeEnabled();
    expect(screen.getByLabelText(/select a cv from profile/i)).toHaveValue(
      "cv-1",
    );
    expect(
      screen.queryByText(
        "Select a saved CV or attach a valid PDF, DOC, or DOCX file.",
      ),
    ).toBeNull();
    const actionArea = document.querySelector(".job-actions");
    expect(actionArea).not.toBeNull();
    const actionControls = [
      within(actionArea as HTMLElement).getByLabelText(
        /i consent to smarthire sharing this application/i,
      ),
      within(actionArea as HTMLElement).getByLabelText(
        /i agree to let smarthire use ai/i,
      ),
      within(actionArea as HTMLElement).getByRole("button", {
        name: /submit application/i,
      }),
    ];
    expect(
      actionControls.map(
        (control) => control.id || control.textContent?.trim(),
      ),
    ).toEqual([
      "application-consent",
      "application-ai-consent",
      "Submit application",
    ]);
    const file = new File(["cv"], "resume.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    fireEvent.change(screen.getByLabelText(/drag a cv/i), {
      target: { files: [file] },
    });
    expect(screen.getByText(/resume\.docx/i)).toBeVisible();
    expect(screen.queryByText(/new cv ready for ai import/i)).toBeNull();
    expect(
      screen.queryByRole("button", { name: /import this cv with ai/i }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Import CV" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByLabelText(/select a cv from profile/i)).toHaveValue(
        savedDocxCv.id,
      ),
    );
    expect(submit).toBeEnabled();
    expect(screen.queryByRole("button", { name: /^cancel$/i })).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: /close application form/i }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    vi.unstubAllGlobals();
  });

  it("marks only required employer questions", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...applicationForm,
        questions: [
          {
            id: "required-question",
            prompt: "Why are you a good fit?",
            description: null,
            kind: "TEXT",
            required: true,
            options: null,
            version: 1,
          },
          {
            id: "optional-question",
            prompt: "Anything else?",
            description: null,
            kind: "TEXT",
            required: false,
            options: null,
            version: 1,
          },
        ],
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
      expect(
        screen.getByRole("textbox", { name: /Why are you a good fit/i }),
      ).toBeVisible(),
    );
    expect(
      screen.getByRole("textbox", { name: /Why are you a good fit/i }),
    ).toBeRequired();
    expect(
      screen.getByRole("textbox", { name: /Anything else/i }),
    ).not.toBeRequired();
    expect(
      document.querySelector(
        'label[for="question-required-question"] .job-required-mark',
      ),
    ).not.toBeNull();
    expect(
      document.querySelector(
        'label[for="question-optional-question"] .job-required-mark',
      ),
    ).toBeNull();
    vi.unstubAllGlobals();
  });

  it("saves an imported local CV to Profile before submitting", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => applicationForm,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => savedPdfCv,
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
      expect(screen.getByLabelText(/drag a cv/i)).toBeVisible(),
    );
    const file = new File(["cv"], "resume.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText(/drag a cv/i), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import CV" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByLabelText(/select a cv from profile/i)).toHaveValue(
        savedPdfCv.id,
      ),
    );
    fireEvent.click(
      screen.getByLabelText(/i consent to smarthire sharing this application/i),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /submit application/i }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const saveRequest = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(new Headers(saveRequest.headers).get("Content-Type")).toBeNull();
    expect(saveRequest.body).toBeInstanceOf(FormData);
    expect((saveRequest.body as FormData).get("file")).toBeInstanceOf(File);
    const request = fetchMock.mock.calls[2]?.[1] as RequestInit;
    expect(new Headers(request.headers).get("Content-Type")).toBe(
      "application/json",
    );
    expect(JSON.parse(String(request.body))).toMatchObject({
      cvId: savedPdfCv.id,
      cvFileRef: savedPdfCv.id,
    });
    expect(screen.getByRole("status")).toHaveTextContent(/submitted/i);
    vi.unstubAllGlobals();
  });

  it("shows CV validation only after submitting without a valid CV", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...applicationForm, cvs: [] }),
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
      expect(screen.getByText("No confirmed CVs in Profile")).toBeVisible(),
    );
    const cvError =
      "Select a saved CV or attach a valid PDF, DOC, or DOCX file.";
    expect(screen.queryByText(cvError)).toBeNull();

    const unsupportedFile = new File(["cv"], "resume.txt", {
      type: "text/plain",
    });
    fireEvent.change(screen.getByLabelText(/drag a cv/i), {
      target: { files: [unsupportedFile] },
    });
    expect(screen.queryByText(/CV files must be PDF, DOC, or DOCX/)).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: /submit application/i }),
    );
    expect(
      screen.getByText(/CV files must be PDF, DOC, or DOCX/),
    ).toBeVisible();
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

    fireEvent.change(screen.getByLabelText(/select a cv from profile/i), {
      target: { value: "cv-1" },
    });
    fireEvent.change(phone, { target: { value: localNumber } });
    fireEvent.click(
      screen.getByLabelText(/i consent to smarthire sharing this application/i),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /submit application/i }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      cvId: "cv-1",
      cvFileRef: "cv-1",
      contactSnapshot: { phone: "+84912345678" },
    });
    vi.unstubAllGlobals();
  });

  it("reloads a stale empty CV list when Apply is reopened", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...applicationForm, cvs: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => applicationForm,
      });
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(
      <ApplyFormSection
        jobId="job-1"
        jobTitle={applicationForm.jobTitle}
        open
        applied={false}
        onOpenChange={() => undefined}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText("No confirmed CVs in Profile")).toBeVisible(),
    );
    rerender(
      <ApplyFormSection
        jobId="job-1"
        jobTitle={applicationForm.jobTitle}
        open={false}
        applied={false}
        onOpenChange={() => undefined}
      />,
    );
    rerender(
      <ApplyFormSection
        jobId="job-1"
        jobTitle={applicationForm.jobTitle}
        open
        applied={false}
        onOpenChange={() => undefined}
      />,
    );

    await waitFor(() =>
      expect(screen.getByLabelText(/select a cv from profile/i)).toHaveValue(
        "cv-1",
      ),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });

  it("keeps submission blocked when the job location is still missing", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...applicationForm,
        profileReady: false,
        missingProfileFields: ["location"],
        profileBasics: { ...applicationForm.profileBasics, location: null },
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
      expect(screen.getByLabelText(/^location/i)).toBeVisible(),
    );
    fireEvent.change(screen.getByLabelText(/select a cv from profile/i), {
      target: { value: "cv-1" },
    });
    fireEvent.click(
      screen.getByLabelText(/i consent to smarthire sharing this application/i),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /submit application/i }),
    );

    expect(screen.getByText("Select the job location.")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it("saves the job location, clears the profile warning, and preserves it on reopen", async () => {
    const savedProfile = {
      revision: 2,
      empty: false,
      basics: {
        headline: "Kỹ sư",
        summary: null,
        phone: "0901234567",
        location: "TP Hồ Chí Minh",
      },
      skills: [],
      experience: [],
      education: [],
      socialLinks: [],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...applicationForm,
          profileReady: false,
          missingProfileFields: ["location"],
          profileBasics: { ...applicationForm.profileBasics, location: null },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          profile: savedProfile,
          conflictApplied: false,
          warnings: [],
          message: "Profile section saved.",
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

    const { rerender } = render(
      <ApplyFormSection
        jobId="job-1"
        jobTitle={applicationForm.jobTitle}
        open
        applied={false}
        onOpenChange={() => undefined}
      />,
    );

    await waitFor(() =>
      expect(screen.getByLabelText(/^location/i)).toBeVisible(),
    );
    const location = screen.getByLabelText(/^location/i) as HTMLSelectElement;
    expect(location.options).toHaveLength(2);
    expect(location.options[1]).toHaveTextContent("TP Hồ Chí Minh");
    expect(location).toHaveValue("");

    fireEvent.change(location, { target: { value: "TP Hồ Chí Minh" } });
    await waitFor(() =>
      expect(
        screen.queryByText(/please complete these profile fields first/i),
      ).not.toBeInTheDocument(),
    );
    expect(
      JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)),
    ).toMatchObject({
      section: "basics",
      baseRevision: 1,
      basics: { location: "TP Hồ Chí Minh" },
    });

    rerender(
      <ApplyFormSection
        jobId="job-1"
        jobTitle={applicationForm.jobTitle}
        open={false}
        applied={false}
        onOpenChange={() => undefined}
      />,
    );
    rerender(
      <ApplyFormSection
        jobId="job-1"
        jobTitle={applicationForm.jobTitle}
        open
        applied={false}
        onOpenChange={() => undefined}
      />,
    );
    await waitFor(() =>
      expect(screen.getByLabelText(/^location/i)).toHaveValue("TP Hồ Chí Minh"),
    );

    fireEvent.change(screen.getByLabelText(/select a cv from profile/i), {
      target: { value: "cv-1" },
    });
    fireEvent.click(
      screen.getByLabelText(/i consent to smarthire sharing this application/i),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /submit application/i }),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(screen.getByRole("status")).toHaveTextContent(/submitted/i);
    vi.unstubAllGlobals();
  });
});
