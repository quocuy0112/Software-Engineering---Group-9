import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentsTab } from "@/frontend/features/recruiter-applications/documents-tab";
import type { AutomaticMatch } from "@/shared/contracts/scoring";

const cvPreview = {
  kind: "cv" as const,
  previewStatus: "PARSED" as const,
  fileName: "candidate-cv.pdf",
  mediaType: "application/pdf",
  pageCount: 1,
  parserVersion: "structured-preview-v3",
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
    expect(fetchMock).toHaveBeenCalledTimes(2);

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

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
