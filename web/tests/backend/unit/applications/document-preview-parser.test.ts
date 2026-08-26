import { describe, expect, it } from "vitest";
import { buildStructuredDocumentContent } from "@/backend/applications/services/document-preview-parser";
import { structuredDocumentPreviewSchema } from "@/shared/contracts/applications/document-preview";

describe("structured application document previews", () => {
  it("keeps a document available with a limited preview when extraction is empty", () => {
    const content = buildStructuredDocumentContent({
      kind: "cover-letter",
      segments: [],
    });
    const preview = structuredDocumentPreviewSchema.parse({
      kind: "cover-letter",
      previewStatus: "LIMITED",
      fileName: "cover-letter.docx",
      mediaType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      pageCount: null,
      parserVersion: "document-preview-v1",
      processingMilliseconds: 0,
      cacheHit: false,
      content,
    });

    expect(preview.previewStatus).toBe("LIMITED");
    expect(preview.content.kind).toBe("cover-letter");
  });

  it("renders the application profile snapshot as structured CV content", () => {
    const content = buildStructuredDocumentContent({
      kind: "cv",
      segments: [],
      preferProfileSnapshot: true,
      applicationProfileSnapshot: {
        candidateName: "Nguyen Minh Anh",
        headline: "Senior Backend Developer",
        summary: "Backend engineer focused on reliable platform delivery.",
        email: "anh@example.com",
        location: "Ho Chi Minh City",
        skills: [
          { id: "java", label: "Java" },
          { id: "spring", label: "Spring Boot" },
        ],
        experience: [
          {
            title: "Senior Backend Developer",
            company: "Acme",
            startDate: "2022-01-01",
            endDate: null,
            isCurrent: true,
            description: "Delivered APIs\nImproved service reliability",
          },
        ],
        education: [
          {
            institution: "University of Technology",
            degree: "BSc",
            field: "Computer Science",
            startDate: null,
            endDate: null,
          },
        ],
      },
    });

    if (content.kind !== "cv") throw new Error("Expected CV content");
    expect(content.name).toBe("Nguyen Minh Anh");
    expect(content.title).toBe("Senior Backend Developer");
    expect(content.summary).toContain("reliable platform");
    expect(content.skills).toEqual(["Java", "Spring Boot"]);
    expect(content.experience[0]).toMatchObject({
      role: "Senior Backend Developer",
      company: "Acme",
      dates: "01/2022 – Present",
      bullets: ["Delivered APIs", "Improved service reliability"],
    });
    expect(content.education[0]).toMatchObject({
      institution: "University of Technology",
      degree: "BSc · Computer Science",
    });
    expect(content.qualityNotes).toEqual([]);
  });

  it("separates cover-letter paragraphs and flags malformed short text", () => {
    const complete = buildStructuredDocumentContent({
      kind: "cover-letter",
      segments: [
        {
          id: "cover-1",
          kind: "paragraph",
          text: "June 1, 2026\nDear Hiring Manager,\nI am excited to apply for this backend role. My experience building dependable Java and Spring Boot services would let me contribute quickly to your team. I enjoy improving reliability and collaborating across engineering groups.\nSincerely,\nNguyen Minh Anh",
        },
      ],
    });

    if (complete.kind !== "cover-letter")
      throw new Error("Expected cover-letter content");
    expect(complete.date).toBe("June 1, 2026");
    expect(complete.greeting).toBe("Dear Hiring Manager,");
    expect(complete.paragraphs).toHaveLength(1);
    expect(complete.signOff).toBe("Nguyen Minh Anh");
    expect(complete.qualityNotes).toEqual([]);

    const malformed = buildStructuredDocumentContent({
      kind: "cover-letter",
      segments: [{ id: "cover-1", kind: "paragraph", text: "Hello" }],
    });
    if (malformed.kind !== "cover-letter")
      throw new Error("Expected cover-letter content");
    expect(malformed.qualityNotes.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "cover-letter-too-short",
        "cover-letter-body-missing",
        "cover-letter-signoff-missing",
      ]),
    );
  });

  it("recovers cover-letter structure when PDF extraction flattens line breaks", () => {
    const content = buildStructuredDocumentContent({
      kind: "cover-letter",
      segments: [
        {
          id: "cover-flat-1",
          kind: "paragraph",
          text: "June 1, 2026 Dear Hiring Manager, I am excited to apply for this backend role. My experience building dependable services would let me contribute quickly to your team. Sincerely, Candidate One",
        },
      ],
    });

    if (content.kind !== "cover-letter")
      throw new Error("Expected cover-letter content");
    expect(content.date).toBe("June 1, 2026");
    expect(content.greeting).toBe("Dear Hiring Manager,");
    expect(content.paragraphs).toEqual([
      "I am excited to apply for this backend role. My experience building dependable services would let me contribute quickly to your team.",
    ]);
    expect(content.closing).toBe("Sincerely,");
    expect(content.signOff).toBe("Candidate One");
  });

  it("segments a single-line extracted CV into readable sections", () => {
    const content = buildStructuredDocumentContent({
      kind: "cv",
      segments: [
        {
          id: "cv-1",
          kind: "paragraph",
          text: [
            "03/2025 - Present LE THI HOA Content & Marketing Executive",
            "Dien thoai: 0987 654 321 Email: lethihoa.mkt@email.com Dia chi: Dong Nai, Vietnam",
            "SKILLS \u2022 Content Writing \u2022 Social Media Management",
            "EDUCATION College Diploma in Marketing Dong Nai Technology College 2021 - 2024",
            "CAREER OBJECTIVE Marketing executive with 1 year of experience in content creation.",
            "WORK EXPERIENCE Marketing Executive Song Xanh Media Co., Ltd. \u2014 Dong Nai Planned and executed social media content calendars for 2 client brands.",
          ].join(" "),
        },
      ],
    });

    if (content.kind !== "cv") throw new Error("Expected CV content");
    expect(content.name).toBe("LE THI HOA");
    expect(content.title).toBe("Content & Marketing Executive");
    expect(content.contact).toEqual([
      "Phone: 0987 654 321",
      "Email: lethihoa.mkt@email.com",
      "Location: Dong Nai, Vietnam",
    ]);
    expect(content.summary).toContain("content creation");
    expect(content.skills).toEqual([
      "Content Writing",
      "Social Media Management",
    ]);
    expect(content.experience[0]).toMatchObject({
      role: "Marketing Executive",
      company: "Song Xanh Media Co., Ltd. - Dong Nai",
      bullets: [
        "Planned and executed social media content calendars for 2 client brands.",
      ],
    });
    expect(content.qualityNotes).toEqual([]);
  });
});
