import { describe, expect, it } from "vitest";
import { ApprovedAiAssessmentAdapter } from "@/backend/scoring/providers/approved-ai-assessment-adapter";
import { aiFixture } from "./fixtures";

const input = { applicationId: "app-1", cvVersion: "CV-v1", jdVersion: "JD-v3", configVersion: "HS-60/40-v1", automaticScore: 92, evidence: [{ title: "React", excerpt: "Built React applications." }] };

function validV4(overrides: Record<string, unknown> = {}) {
  return {
    extraction: {
      skills_found_verbatim: ["React"],
      experience_entries: [{ title: "Engineer", company: "Acme", start_date: "2020-01", end_date: "Present", bullet_points: ["Built React applications."] }],
      education_entries: [{ degree: "BSc Computer Science", school: "University", dates: "2016-2020" }],
      certifications: [],
      languages: ["English — TOEIC 780"],
      extraction_flags: [],
    },
    data_quality_issues: [],
    score_breakdown: { required_skills_match: 34, experience_match: 21, preferred_skills_match: 12, education_certifications: 9, languages: 8 },
    total_score: 84,
    match_level: "high",
    deduction_reasons: [
      { criterion: "required_skills_match", points_deducted: 6, evidence_quote: "No evidence for one required skill." },
      { criterion: "experience_match", points_deducted: 4, evidence_quote: "The CV states four years, below the preferred depth." },
      { criterion: "preferred_skills_match", points_deducted: 3, evidence_quote: "Preferred skill was not found in the CV text." },
      { criterion: "education_certifications", points_deducted: 1, evidence_quote: "No relevant certification is listed." },
      { criterion: "languages", points_deducted: 2, evidence_quote: "English level is not fully specified." },
    ],
    confidence_pct: 82,
    requires_human_review: false,
    review_reasons: [],
    overall_assessment: "Strong evidence across the required criteria.",
    ...overrides,
  };
}

describe("approved AI provider boundary", () => {
  it("accepts only schema-valid provider output", async () => {
    await expect(new ApprovedAiAssessmentAdapter(async () => aiFixture()).assess(input)).resolves.toMatchObject({ score: 88, compliance: { code: "SENSITIVE_ATTRIBUTES_EXCLUDED" } });
  });

  it("normalizes malformed output to a safe provider error", async () => {
    await expect(new ApprovedAiAssessmentAdapter(async () => ({ score: 88 })).assess(input)).rejects.toMatchObject({ code: "AI_PROVIDER_MALFORMED" });
  });

  it("redacts contact data before the provider boundary", async () => {
    let received = "";
    const adapter = new ApprovedAiAssessmentAdapter(async (payload) => {
      received = payload.evidence[0]?.excerpt ?? "";
      return aiFixture();
    });
    await adapter.assess({ ...input, evidence: [{ title: "Evidence", excerpt: "Employment: 2024-06-01 to 2025-06-01. Email jane@example.com or call +1 555 123 4567." }] });
    expect(received).not.toContain("jane@example.com");
    expect(received).not.toContain("555 123 4567");
    expect(received).toContain("2024-06-01");
    expect(received).toContain("2025-06-01");
  });

  it("normalizes the v4 extraction and five-criterion response", async () => {
    const result = await new ApprovedAiAssessmentAdapter(async () => validV4()).assess(input);
    expect(result.score).toBe(84);
    expect(result.requiresHumanReview).toBe(false);
    expect(result.breakdown).toEqual([
      "Required skills: 34/40; experience: 21/25",
      "Preferred skills: 12/15; education/certifications: 9/10; languages: 8/10",
      "AI total: 84/100 (high match); confidence: 82%",
    ]);
    expect(result.findings[0]).toMatchObject({ title: "Skill found", kind: "STRENGTH" });
    expect(result.findings[0]?.evidence).toBe("Built React applications.");
  });

  it("deduplicates repeated skills and keeps data-quality notes out of fit findings", async () => {
    const result = await new ApprovedAiAssessmentAdapter(async () => validV4({
      extraction: { ...validV4().extraction, skills_found_verbatim: ["React", "react", "TypeScript"] },
      data_quality_issues: [
        { bucket: "input_limitation", description: "Employment dates are redacted.", evidence_quote: "startDate: [phone redacted]" },
        { bucket: "input_limitation", description: "Employment dates cannot be verified.", evidence_quote: "endDate: [phone redacted]" },
      ],
      confidence_pct: 60,
      requires_human_review: true,
      review_reasons: [{ bucket: "input_limitation", reason: "Employment dates are redacted." }],
      overall_assessment: "Dates prevent a reliable assessment.",
    })).assess(input);
    expect(result.assessmentLimitedByDataQuality).toBe(true);
    expect(result.dataQualityNotes).toHaveLength(1);
    expect(result.findings.filter((finding) => finding.kind === "STRENGTH")).toHaveLength(2);
    expect(result.findings.filter((finding) => finding.kind === "STRENGTH").map((finding) => finding.evidence)).toEqual(["Built React applications.", "TypeScript"]);
    expect(result.findings.some((finding) => finding.title === "required_skills_match")).toBe(false);
    expect(result.questions.kind).toBe("INSUFFICIENT_DATA");
  });

  it("normalizes legacy published responses so skills and quality notes render once", async () => {
    const result = await new ApprovedAiAssessmentAdapter(async () => aiFixture({
      findings: [
        { id: "skill-1", kind: "STRENGTH", title: "Skill found verbatim", evidence: "React" },
        { id: "skill-2", kind: "STRENGTH", title: "Skill found verbatim", evidence: "react" },
        { id: "quality-1", kind: "POINT_TO_VERIFY", title: "Data quality review", evidence: "input_limitation: Employment dates are redacted." },
        { id: "quality-2", kind: "POINT_TO_VERIFY", title: "Extraction flag", evidence: "input_limitation: startDate is [phone redacted]." },
      ],
      questions: { kind: "GENERATED", items: [{ question: "Question", pointToVerifyId: "quality-1" }] },
    })).assess({
      ...input,
      preflightIssues: [{ bucket: "input_limitation", description: "Employment dates are redacted.", evidenceQuote: "startDate: [phone redacted]" }],
    });
    expect(result.findings.filter((finding) => finding.kind === "STRENGTH")).toHaveLength(1);
    expect(result.findings.some((finding) => finding.title === "Data quality review")).toBe(false);
    expect(result.dataQualityNotes).toHaveLength(1);
    expect(result.assessmentLimitedByDataQuality).toBe(true);
    expect(result.questions.kind).toBe("INSUFFICIENT_DATA");
  });

  it("requires a tagged review reason when confidence is below 75", async () => {
    const screening = validV4({
      extraction: { skills_found_verbatim: [], experience_entries: [], education_entries: [], certifications: [], languages: [], extraction_flags: ["Date format is unusual."] },
      data_quality_issues: [{ bucket: "extraction_uncertainty", description: "Dates may have been missed.", evidence_quote: "2020 - Present" }],
      score_breakdown: { required_skills_match: 20, experience_match: 10, preferred_skills_match: 5, education_certifications: 5, languages: 5 },
      total_score: 45,
      match_level: "medium",
      deduction_reasons: [
        { criterion: "required_skills_match", points_deducted: 20, evidence_quote: "Required skill is not found in the parsed text." },
        { criterion: "experience_match", points_deducted: 15, evidence_quote: "Dates are ambiguous in the CV." },
        { criterion: "preferred_skills_match", points_deducted: 10, evidence_quote: "Preferred skill is not found in the CV text." },
        { criterion: "education_certifications", points_deducted: 5, evidence_quote: "No education or certification is listed." },
        { criterion: "languages", points_deducted: 5, evidence_quote: "No language level is listed." },
      ],
      confidence_pct: 60,
      requires_human_review: true,
      review_reasons: [{ bucket: "extraction_uncertainty", reason: "Re-check the unusual date format." }],
      overall_assessment: "Review is needed because extraction is uncertain.",
    });
    await expect(new ApprovedAiAssessmentAdapter(async () => screening).assess(input)).resolves.toMatchObject({ confidencePercent: 60, confidenceLevel: "LOW", requiresHumanReview: true });
  });

  it("rejects a v4 result whose total does not equal its breakdown", async () => {
    const invalid = validV4({ total_score: 80 });
    await expect(new ApprovedAiAssessmentAdapter(async () => invalid).assess(input)).rejects.toMatchObject({ code: "AI_PROVIDER_MALFORMED" });
  });

  it("rejects a v4 result with an untagged low-confidence review", async () => {
    const invalid = validV4({ confidence_pct: 60, requires_human_review: false, review_reasons: [] });
    await expect(new ApprovedAiAssessmentAdapter(async () => invalid).assess(input)).rejects.toMatchObject({ code: "AI_PROVIDER_MALFORMED" });
  });

  it("reports missing provider configuration without retrying it as a transient outage", async () => {
    const previousKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      await expect(new ApprovedAiAssessmentAdapter().assess(input)).rejects.toMatchObject({ code: "AI_PROVIDER_NOT_CONFIGURED", transient: false });
    } finally {
      if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previousKey;
    }
  });
});
