import { describe, expect, it, vi } from "vitest";
import { validateExtractedCvText } from "@/backend/scoring/domain/cv-content-validation";
import {
  ApprovedCvClassificationAdapter,
  buildCvClassificationRequestBody,
  decideCvClassification,
  deterministicCvClassification,
  CvClassificationProviderError,
  isConfidentCvClassification,
} from "@/backend/scoring/providers/cv-classification-adapter";

describe("CV pre-scoring safeguards", () => {
  it("rejects empty and too-short extracted content", () => {
    expect(() => validateExtractedCvText(" ")).toThrow("CV_TEXT_UNAVAILABLE");
    expect(() => validateExtractedCvText("hello world")).toThrow(
      "CV_TEXT_TOO_SHORT",
    );
  });

  it("normalizes and accepts a minimally readable CV", () => {
    expect(
      validateExtractedCvText("Java engineer\r\nBuilt REST APIs"),
    ).toMatchObject({
      text: "Java engineer\nBuilt REST APIs",
      wordCount: 5,
    });
  });

  it("does not classify an unrelated article as a CV in the fallback", () => {
    expect(
      deterministicCvClassification({
        cvText:
          "This article explains the history of public transport and city planning in detail.",
      }).isCv,
    ).toBe(false);
  });

  it("recognizes a genuine Vietnamese CV from independent structural signals", () => {
    const result = deterministicCvClassification({
      cvText: `
        NGUYỄN VĂN AN - Kỹ sư phần mềm
        Email: an.nguyen@example.com | Điện thoại: 0901234567
        MỤC TIÊU NGHỀ NGHIỆP
        Phát triển sản phẩm hữu ích cho người dùng.
        KINH NGHIỆM LÀM VIỆC
        2022 - nay: Kỹ sư phần mềm tại Công ty ABC
        HỌC VẤN
        2018 - 2022: Đại học Bách Khoa
        KỸ NĂNG
        TypeScript, React, PostgreSQL
      `,
    });

    expect(result).toMatchObject({ isCv: true });
    expect(result.confidence).toBeGreaterThanOrEqual(0.88);
  });

  it("does not mistake a dated contract with contact details for a CV", () => {
    const result = deterministicCvClassification({
      cvText: `
        HỢP ĐỒNG DỊCH VỤ
        Ký ngày 20/08/2026 giữa Công ty ABC và Nguyễn Văn An.
        Email liên hệ: legal@example.com. Điện thoại: 0901234567.
        Điều 1: Phạm vi công việc. Điều 2: Thanh toán và nghĩa vụ các bên.
      `,
    });

    expect(result.isCv).toBe(false);
  });

  it("does not mistake a recruitment project proposal for a candidate CV", () => {
    const cvTermsInsideProposal = `
      PROJECT PROPOSAL: RECRUITMENT PLATFORM
      Candidate Profile Management and Resume Builder
      Education History Management
      Work Experience Tracking
      Skills Tagging
      The project allows managers to screen resumes and email candidates.
      Delivery period: 2025 - 2026.
      Project contact: team@example.com | Phone: 0901234567
    `;

    expect(
      deterministicCvClassification({ cvText: cvTermsInsideProposal }).isCv,
    ).toBe(false);
    expect(
      decideCvClassification({
        cvText: cvTermsInsideProposal,
        classification: {
          isCv: false,
          confidence: 0.96,
          source: "AI",
        },
      }),
    ).toMatchObject({ accepted: false, basis: "REJECTED" });
  });

  it("rescues an AI false-negative only when strong CV structure is present", () => {
    const decision = decideCvClassification({
      cvText: `
        Nguyễn Văn An | an@example.com | 0901234567
        Kinh nghiệm làm việc
        2021 - nay: Backend Developer tại Công ty ABC
        Học vấn
        Đại học Công nghệ Thông tin
        Kỹ năng
        Node.js, PostgreSQL, Docker
      `,
      classification: {
        isCv: false,
        confidence: 0.82,
        reason: "The layout is ambiguous.",
        source: "AI",
      },
    });

    expect(decision).toMatchObject({
      accepted: true,
      basis: "STRONG_STRUCTURAL_EVIDENCE",
    });
  });

  it("halts on an explicit non-CV classification", async () => {
    const adapter = new ApprovedCvClassificationAdapter(async () => ({
      isCv: false,
      confidence: 0.98,
      source: "AI" as const,
    }));
    await expect(
      adapter.classify({
        cvText: "A sufficiently long document body for checking.",
      }),
    ).resolves.toMatchObject({ isCv: false });
  });

  it("accepts the classifier JSON contract and enforces the 70% gate", async () => {
    const adapter = new ApprovedCvClassificationAdapter(async () => ({
      is_valid_cv: true,
      confidence: 70,
      reason: "Contains work history and education sections.",
    }));
    const result = await adapter.classify({
      cvText: "Resume text with experience and education sections.",
    });
    expect(result).toMatchObject({
      isCv: true,
      confidence: 0.7,
      reason: "Contains work history and education sections.",
    });
    expect(isConfidentCvClassification(result)).toBe(true);
    expect(isConfidentCvClassification({ isCv: true, confidence: 0.69 })).toBe(
      false,
    );
  });

  it("builds a gpt-4o-mini compatible Responses request", () => {
    const request = buildCvClassificationRequestBody({
      cvText: "Jane Doe\nWork experience\nEducation\nSkills",
    });

    expect(request).not.toHaveProperty("reasoning");
    expect(request).toMatchObject({
      background: false,
      store: false,
      stream: false,
      text: {
        format: {
          type: "json_schema",
          strict: true,
        },
      },
    });
  });

  it("terminates a classification transport and falls back deterministically", async () => {
    vi.useFakeTimers();
    try {
      const adapter = new ApprovedCvClassificationAdapter(
        () => new Promise<never>(() => undefined),
      );
      const pending = adapter.classify({ cvText: "A valid-looking CV body." });
      const assertion = expect(pending).resolves.toMatchObject({
        source: "DETERMINISTIC_FALLBACK",
        providerFailureCode: "CV_CLASSIFICATION_TIMEOUT",
      });
      await vi.advanceTimersByTimeAsync(5_001);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a structurally strong CV eligible during a provider outage", async () => {
    const adapter = new ApprovedCvClassificationAdapter(async () => {
      throw new CvClassificationProviderError(
        "CV_CLASSIFICATION_UNAVAILABLE",
        true,
      );
    });
    const cvText = `
      Jane Doe | jane@example.com | 0901234567
      Work Experience
      2021 - present: Backend Developer
      Education
      University of Technology
      Skills
      Node.js, PostgreSQL, Docker
    `;

    const classification = await adapter.classify({ cvText });
    expect(classification).toMatchObject({
      isCv: true,
      source: "DETERMINISTIC_FALLBACK",
      providerFailureCode: "CV_CLASSIFICATION_UNAVAILABLE",
    });
    expect(decideCvClassification({ cvText, classification }).accepted).toBe(
      true,
    );
  });
});
