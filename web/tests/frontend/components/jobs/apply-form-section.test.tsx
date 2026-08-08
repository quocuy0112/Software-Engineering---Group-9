import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApplyFormSection } from "@/frontend/features/jobs/components/apply-form-section";
import { cvImportResourceSchema } from "@/shared/contracts/cv-import/upload";

const pendingApplyImport = cvImportResourceSchema.parse({
  uploadId: "upload_pending_1234",
  displayFilename: "resume.docx",
  documentKind: "DOCX",
  parserClass: "EXTERNAL_OPENAI",
  status: "AWAITING_CONSENT",
  stage: "CONSENT",
  availableActions: ["GRANT_CONSENT", "DELETE", "MANUAL_PROFILE"],
  scanRetriesRemaining: 2,
  parseRetriesRemaining: 2,
  createdAt: "2026-08-07T00:00:00.000Z",
  expiresAt: "2026-09-07T00:00:00.000Z",
  draft: null,
  processingNotice: {
    noticeVersion: "cv-processing.v1",
    noticeText: "Synthetic processing notice.",
    externalConsentRequiredFor: ["EXTERNAL_OPENAI"],
  },
  consent: {
    required: true,
    granted: false,
    providerDisplayName: "OpenAI",
    processingPurpose: "Create a private CV review draft",
    noticeText: "Synthetic consent notice.",
    consentChallenge:
      "eyJ1IjoidXBsb2FkX3BlbmRpbmdfMTIzNCJ9.signature_fixture_1234567890",
  },
  failure: null,
  receipt: null,
  contentInaccessibleAt: null,
  deleteAfter: null,
  deletedAt: null,
});

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

describe("application form modal", () => {
  it("prefills contact, stages a new CV for AI import, and closes from its overlay controls", async () => {
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
    const file = new File(["cv"], "resume.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    fireEvent.change(screen.getByLabelText(/drag a cv/i), {
      target: { files: [file] },
    });
    expect(screen.getByText(/resume\.docx/i)).toBeVisible();
    expect(
      screen.getByLabelText(/new cv ready for ai import/i),
    ).not.toHaveAttribute("multiple");
    expect(submit).toBeEnabled();
    expect(
      screen.getByRole("button", { name: /import this cv with ai/i }),
    ).toBeVisible();

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

  it("cancels an unfinished AI import when Apply is closed and preserves contact fields", async () => {
    const sessionKey = "smarthire:apply-cv-import:job-1";
    window.sessionStorage.setItem(sessionKey, pendingApplyImport.uploadId);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const open = vi.spyOn(window, "open").mockReturnValue({} as Window);
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/application-form"))
          return { ok: true, json: async () => applicationForm };
        if (url.endsWith(`/cv-imports/${pendingApplyImport.uploadId}`)) {
          if (init?.method === "DELETE")
            return { ok: true, status: 202, json: async () => ({}) };
          return { ok: true, json: async () => pendingApplyImport };
        }
        throw new Error(`Unexpected request: ${url}`);
      },
    );
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
      expect(screen.getByText(/waiting for your consent/i)).toBeVisible(),
    );
    expect(open).toHaveBeenCalledWith(
      "/profile/cv-imports/" + pendingApplyImport.uploadId,
      "_blank",
      "noopener,noreferrer",
    );
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(
      fetchMock.mock.calls.some(
        ([input, init]) =>
          String(input).endsWith(
            `/cv-imports/${pendingApplyImport.uploadId}`,
          ) && init?.method === "DELETE",
      ),
    ).toBe(true);
    expect(window.sessionStorage.getItem(sessionKey)).toBeNull();
    expect(screen.getByDisplayValue("Nguyễn Văn A")).toBeVisible();
    expect(screen.getByDisplayValue("candidate@example.com")).toBeVisible();
    expect(confirm).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledOnce();
    open.mockRestore();
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
