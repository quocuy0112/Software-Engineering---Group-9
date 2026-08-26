import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentsTab } from "@/frontend/features/recruiter-applications/documents-tab";
import type { AutomaticMatch } from "@/shared/contracts/scoring";

const cvPreview = {
  kind: "cv" as const,
  previewStatus: "ORIGINAL" as const,
  fileName: "candidate-cv.pdf",
  mediaType: "application/pdf",
  pageCount: null,
  parserVersion: "native-pdf-preview-v1",
  processingMilliseconds: 12,
  cacheHit: false,
  content: {
    kind: "cv" as const,
    name: "Candidate One",
    title: "Backend Engineer",
    contact: [],
    summary: null,
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    qualityNotes: [],
  },
};

const coverLetterPreview = {
  kind: "cover-letter" as const,
  previewStatus: "PARSED" as const,
  fileName: "cover-letter.docx",
  mediaType:
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pageCount: 1,
  parserVersion: "structured-preview-v3",
  processingMilliseconds: 16,
  cacheHit: false,
  content: {
    kind: "cover-letter" as const,
    date: null,
    greeting: "Dear Hiring Manager,",
    paragraphs: ["I am excited to apply for this role."],
    closing: "Sincerely,",
    signOff: "Candidate One",
    qualityNotes: [],
  },
};

const coverLetterPdfPreview = {
  ...coverLetterPreview,
  previewStatus: "ORIGINAL" as const,
  fileName: "cover-letter.pdf",
  mediaType: "application/pdf",
  pageCount: null,
  parserVersion: "native-pdf-preview-v1",
};

const automatic = {
  cvParse: {
    snapshotVersion: "candidate-cv-v1",
  },
  foundRequiredSkills: [],
  preferredSkills: [],
  jdVersion: "JD-v3",
} as unknown as AutomaticMatch;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DocumentsTab", () => {
  it("shows a DOCX cover letter as an attached, structured letter preview", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const payload = String(input).includes("cover-letter")
        ? coverLetterPreview
        : cvPreview;
      return new Response(JSON.stringify(payload), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <DocumentsTab
        jobId="job-1"
        applicationId="application-1"
        automatic={automatic}
      />,
    );

    expect(await screen.findByText("Dear Hiring Manager,")).toBeInTheDocument();
    expect(screen.getByText("DOCX attachment")).toBeInTheDocument();
    expect(screen.getByText("cover-letter.docx")).toBeInTheDocument();
  });

  it("renders an uploaded PDF in the inline document preview", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const payload = String(input).includes("cover-letter")
        ? coverLetterPdfPreview
        : cvPreview;
      return new Response(JSON.stringify(payload), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <DocumentsTab
        jobId="job-pdf"
        applicationId="application-pdf"
        automatic={automatic}
      />,
    );

    const cvIframe = await screen.findByTitle("CV PDF preview");
    const coverLetterIframe = await screen.findByTitle(
      "Cover letter PDF preview",
    );
    expect(cvIframe.getAttribute("src")).toMatch(/^blob:/u);
    expect(coverLetterIframe.getAttribute("src")).toMatch(/^blob:/u);
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "/api/recruiter/jobs/job-pdf/applications/application-pdf/documents/cv",
        ),
        expect.stringContaining(
          "/api/recruiter/jobs/job-pdf/applications/application-pdf/documents/cover-letter",
        ),
      ]),
    );
  });

  it("does not reload document previews when scoring data changes after rescore", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const payload = String(input).includes("cover-letter")
        ? coverLetterPreview
        : cvPreview;
      return new Response(JSON.stringify(payload), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const view = render(
      <DocumentsTab
        jobId="job-2"
        applicationId="application-2"
        automatic={automatic}
      />,
    );
    await screen.findByText("Dear Hiring Manager,");
    expect(fetchMock).toHaveBeenCalledTimes(3);

    view.rerender(
      <DocumentsTab
        jobId="job-2"
        applicationId="application-2"
        automatic={{
          ...automatic,
          cvParse: {
            ...automatic.cvParse,
            snapshotVersion: "candidate-cv-v2",
          },
        }}
      />,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  });

  it("bypasses a stale server preview cache when the recruiter retries", async () => {
    let cvAttempts = 0;
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("/documents/cover-letter/text")) {
        return new Response(
          JSON.stringify({ message: "The document is not available." }),
          { status: 404 },
        );
      }
      cvAttempts += 1;
      if (cvAttempts === 1) {
        return new Response(
          JSON.stringify({ message: "Document preview unavailable." }),
          { status: 500 },
        );
      }
      return new Response(JSON.stringify(cvPreview), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <DocumentsTab
        jobId="job-retry"
        applicationId="application-retry"
        automatic={automatic}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Retry preview" }),
    );
    await screen.findByText(/Original CV PDF preview ready/u);

    const cvRequests = fetchMock.mock.calls
      .map(([input]) => String(input))
      .filter((url) => url.includes("/documents/cv/text"));
    expect(cvRequests).toHaveLength(2);
    expect(cvRequests[0]).not.toContain("cacheVersion=");
    expect(cvRequests[1]).toContain("cacheVersion=retry-1");
  });

  it("does not cache a missing cover letter before it is attached", async () => {
    let coverLetterAvailable = false;
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("/documents/cover-letter/text")) {
        return coverLetterAvailable
          ? new Response(JSON.stringify(coverLetterPreview), { status: 200 })
          : new Response(
              JSON.stringify({ message: "The document is not available." }),
              { status: 404 },
            );
      }
      return new Response(JSON.stringify(cvPreview), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const firstView = render(
      <DocumentsTab
        jobId="job-cover-letter-refresh"
        applicationId="application-cover-letter-refresh"
        automatic={automatic}
      />,
    );
    expect(await screen.findByText("Cover letter not provided")).toBeInTheDocument();

    coverLetterAvailable = true;
    firstView.unmount();
    render(
      <DocumentsTab
        jobId="job-cover-letter-refresh"
        applicationId="application-cover-letter-refresh"
        automatic={automatic}
      />,
    );

    expect(await screen.findByText("Dear Hiring Manager,")).toBeInTheDocument();
    const coverLetterRequests = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes("/documents/cover-letter/text"),
    );
    expect(coverLetterRequests).toHaveLength(2);
  });
});
