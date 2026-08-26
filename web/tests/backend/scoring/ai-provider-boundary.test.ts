import { describe, expect, it } from "vitest";
import { ApprovedAiAssessmentAdapter } from "@/backend/scoring/providers/approved-ai-assessment-adapter";
import {
  buildCvAiAssessmentPrompt,
  cvAiAssessmentJsonSchema,
  SUGGESTED_QUESTIONS_UNAVAILABLE_MESSAGE,
} from "@/backend/scoring/domain/cv-ai-assessment";
import { AiAssessmentProviderError } from "@/backend/scoring/providers/ai-assessment-provider-port";
import { aiFixture } from "./fixtures";

const input = {
  applicationId: "app-1",
  cvVersion: "CV-v1",
  jdVersion: "JD-v3",
  configVersion: "HS-40/60-v1",
  automaticScore: 92,
  evidence: [{ title: "React", excerpt: "Built React applications." }],
};

function validV4(overrides: Record<string, unknown> = {}) {
  return {
    extraction: {
      skills_found_verbatim: ["React"],
      experience_entries: [
        {
          title: "Engineer",
          company: "Acme",
          start_date: "2020-01",
          end_date: "Present",
          bullet_points: ["Built React applications."],
        },
      ],
      education_entries: [
        {
          degree: "BSc Computer Science",
          school: "University",
          dates: "2016-2020",
        },
      ],
      certifications: [],
      languages: ["English — TOEIC 780"],
      extraction_flags: [],
    },
    data_quality_issues: [],
    score_breakdown: {
      required_skills_match: 34,
      experience_match: 21,
      preferred_skills_match: 12,
      education_certifications: 9,
      languages: 8,
    },
    total_score: 84,
    match_level: "high",
    deduction_reasons: [
      {
        criterion: "required_skills_match",
        points_deducted: 6,
        evidence_quote: "No evidence for one required skill.",
      },
      {
        criterion: "experience_match",
        points_deducted: 4,
        evidence_quote: "The CV states four years, below the preferred depth.",
      },
      {
        criterion: "preferred_skills_match",
        points_deducted: 3,
        evidence_quote: "Preferred skill was not found in the CV text.",
      },
      {
        criterion: "education_certifications",
        points_deducted: 1,
        evidence_quote: "No relevant certification is listed.",
      },
      {
        criterion: "languages",
        points_deducted: 2,
        evidence_quote: "English level is not fully specified.",
      },
    ],
    confidence_pct: 82,
    requires_human_review: false,
    review_reasons: [],
    overall_assessment: "Strong evidence across the required criteria.",
    ...overrides,
  };
}

function validV5(overrides: Record<string, unknown> = {}) {
  return {
    extraction: {
      skills_found_verbatim: ["React Native", "TypeScript", "REST API"],
      experience_entries: [
        {
          title: "React Native Developer",
          company: "Mobile Labs",
          start_date: "2021-01",
          end_date: "Present",
          bullet_points: [
            "Reduced crash rate by 35% across a 200k-user mobile product.",
          ],
        },
      ],
      education_entries: [
        {
          degree: "BSc Computer Science",
          school: "University",
          dates: "2016-2020",
        },
      ],
      certifications: [],
      languages: ["English — TOEIC 780"],
      extraction_flags: [],
    },
    dataQualityNotes: [],
    scoreReasoning: {
      score: 92,
      breakdown: [
        { category: "Required skills", points: "38/40", note: null },
        { category: "Experience", points: "23/25", note: null },
        { category: "Preferred skills", points: "14/15", note: null },
        { category: "Education/certifications", points: "9/10", note: null },
        { category: "Languages", points: "8/10", note: null },
      ],
      aiTotal: 92,
      matchLabel: "high match",
      confidence: { percent: 94, level: "High", cappedReason: null },
    },
    strengths: [
      {
        title: "Measurable mobile impact",
        evidence:
          "Reduced crash rate by 35% across a 200k-user mobile product.",
      },
      {
        title: "Direct role fit",
        evidence:
          "Worked as a React Native Developer at Mobile Labs from 2021 to Present.",
      },
      {
        title: "Combined-skill delivery",
        evidence:
          "The same mobile product work combines React Native, TypeScript, and REST API integration.",
      },
    ],
    pointsToVerify: [
      {
        title: "Verify ownership scope",
        reason:
          "The CV gives the crash-rate result but does not state whether the candidate owned the release or worked within a larger team.",
      },
      {
        title: "Verify testing depth",
        reason:
          "The CV names the mobile stack but does not explain the automated testing approach used to protect the crash-rate improvement.",
      },
    ],
    suggestedQuestions: [
      "You report a 35% crash-rate reduction across a 200k-user product. Which parts of the diagnosis and release did you personally own?",
      "What instrumentation and before/after measurement convinced you that the crash rate fell by 35%?",
      "How did you use React Native, TypeScript, and REST APIs together in that product?",
    ],
    questionsUnavailableReason: null,
    overallAssessment:
      "Strong evidence of direct React Native delivery with measurable mobile impact.",
    ...overrides,
  };
}

describe("approved AI provider boundary", () => {
  it("includes the shared evidence, data-quality, and exact question-generation instructions", () => {
    const prompt = buildCvAiAssessmentPrompt({
      jobTitle: "React Native Developer",
      requiredSkills: ["React Native"],
      cvText: "Reduced crash rate by 35%.",
    });
    expect(prompt).toContain("dataQualityNotes");
    expect(prompt).toContain(
      "Never report High/90%+ with a HIGH note or 100/100",
    );
    expect(prompt).toContain(
      "Given:\n- Job description (required skills, preferred skills, min experience)",
    );
    expect(prompt).toContain(
      "Generate exactly 3 interview questions such that:",
    );
    expect(prompt).toContain(SUGGESTED_QUESTIONS_UNAVAILABLE_MESSAGE);
  });

  it("bounds display breakdown summaries before publication", async () => {
    const longNote = "Detailed provider explanation ".repeat(30);
    const base = validV5();
    const result = await new ApprovedAiAssessmentAdapter(async () =>
      validV5({
        scoreReasoning: {
          ...base.scoreReasoning,
          breakdown: base.scoreReasoning.breakdown.map((item, index) => ({
            ...item,
            note: index < 4 ? longNote : null,
          })),
        },
      }),
    ).assess(input);

    expect(result.breakdown).toHaveLength(3);
    expect(result.breakdown.every((item) => item.length <= 300)).toBe(true);
  });

  it("uses a Responses-compatible schema for the 0-or-3 question rule", () => {
    const questionsSchema = cvAiAssessmentJsonSchema.properties
      .suggestedQuestions;
    expect(questionsSchema).toMatchObject({
      type: "array",
      maxItems: 3,
      items: { type: "string" },
    });
    expect(questionsSchema).not.toHaveProperty("oneOf");
  });

  it("accepts only schema-valid provider output", async () => {
    await expect(
      new ApprovedAiAssessmentAdapter(async () => aiFixture()).assess(input),
    ).resolves.toMatchObject({
      score: 88,
      compliance: { code: "SENSITIVE_ATTRIBUTES_EXCLUDED" },
    });
  });

  it("normalizes malformed output to a safe provider error", async () => {
    await expect(
      new ApprovedAiAssessmentAdapter(async () => ({ score: 88 })).assess(
        input,
      ),
    ).rejects.toMatchObject({ code: "AI_PROVIDER_MALFORMED" });
  });

  it("recovers from a transient malformed response without requiring a recruiter retry", async () => {
    let calls = 0;
    const result = await new ApprovedAiAssessmentAdapter(async () => {
      calls += 1;
      return calls === 1 ? { score: 88 } : validV5();
    }).assess(input);

    expect(calls).toBe(2);
    expect(result).toMatchObject({
      score: 92,
      confidenceLevel: "HIGH",
    });
  });

  it("does not let malformed model output open the shared worker circuit", async () => {
    let calls = 0;
    const adapter = new ApprovedAiAssessmentAdapter(async () => {
      calls += 1;
      if (calls <= 5)
        throw new AiAssessmentProviderError("AI_PROVIDER_MALFORMED");
      return validV5();
    });

    for (let attempt = 0; attempt < 5; attempt += 1)
      await expect(adapter.assess(input)).rejects.toMatchObject({
        code: "AI_PROVIDER_MALFORMED",
      });

    await expect(adapter.assess(input)).resolves.toMatchObject({ score: 92 });
    expect(calls).toBe(6);
  });

  it("redacts contact data before the provider boundary", async () => {
    let received = "";
    const adapter = new ApprovedAiAssessmentAdapter(async (payload) => {
      received = payload.evidence[0]?.excerpt ?? "";
      return aiFixture();
    });
    await adapter.assess({
      ...input,
      evidence: [
        {
          title: "Evidence",
          excerpt:
            "Employment: 2024-06-01 to 2025-06-01. Email jane@example.com or call +1 555 123 4567.",
        },
      ],
    });
    expect(received).not.toContain("jane@example.com");
    expect(received).not.toContain("555 123 4567");
    expect(received).toContain("2024-06-01");
    expect(received).toContain("2025-06-01");
  });

  it("normalizes the v4 extraction and five-criterion response", async () => {
    const result = await new ApprovedAiAssessmentAdapter(async () =>
      validV4(),
    ).assess(input);
    expect(result.score).toBe(84);
    expect(result.requiresHumanReview).toBe(false);
    expect(result.breakdown).toEqual([
      "Required skills: 34/40; Experience: 21/25",
      "Preferred skills: 12/15; Education/certifications: 9/10",
      "Languages: 8/10; AI total: 84/100 (high match); confidence: 82% (High)",
    ]);
    expect(result.findings[0]).toMatchObject({
      title: "Relevant skill evidence",
      kind: "STRENGTH",
    });
    expect(result.findings[0]?.evidence).toBe("Built React applications.");
    expect(result.scoreReasoning.breakdown).toHaveLength(5);
  });

  it("deduplicates repeated skills and keeps data-quality notes out of fit findings", async () => {
    const result = await new ApprovedAiAssessmentAdapter(async () =>
      validV4({
        extraction: {
          ...validV4().extraction,
          skills_found_verbatim: ["React", "react", "TypeScript"],
        },
        data_quality_issues: [
          {
            bucket: "input_limitation",
            description: "Employment dates are redacted.",
            evidence_quote: "startDate: [phone redacted]",
          },
          {
            bucket: "input_limitation",
            description: "Employment dates cannot be verified.",
            evidence_quote: "endDate: [phone redacted]",
          },
        ],
        confidence_pct: 60,
        requires_human_review: true,
        review_reasons: [
          {
            bucket: "input_limitation",
            reason: "Employment dates are redacted.",
          },
        ],
        overall_assessment: "Dates prevent a reliable assessment.",
      }),
    ).assess(input);
    expect(result.assessmentLimitedByDataQuality).toBe(false);
    expect(result.dataQualityNotes).toHaveLength(1);
    expect(result.score).toBe(70);
    expect(result.confidenceLevel).toBe("LOW");
    expect(result.confidencePercent).toBeLessThanOrEqual(50);
    expect(
      result.findings.filter((finding) => finding.kind === "STRENGTH").length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      result.findings.some(
        (finding) => finding.title === "required_skills_match",
      ),
    ).toBe(false);
    expect(result.questions.kind).toBe("GENERATED");
    expect(result.suggestedQuestions).toHaveLength(3);
  });

  it("normalizes legacy published responses so skills and quality notes render once", async () => {
    const result = await new ApprovedAiAssessmentAdapter(async () =>
      aiFixture({
        findings: [
          {
            id: "skill-1",
            kind: "STRENGTH",
            title: "Skill found verbatim",
            evidence: "React",
          },
          {
            id: "skill-2",
            kind: "STRENGTH",
            title: "Skill found verbatim",
            evidence: "react",
          },
          {
            id: "quality-1",
            kind: "POINT_TO_VERIFY",
            title: "Data quality review",
            evidence: "input_limitation: Employment dates are redacted.",
          },
          {
            id: "quality-2",
            kind: "POINT_TO_VERIFY",
            title: "Extraction flag",
            evidence: "input_limitation: startDate is [phone redacted].",
          },
        ],
        questions: {
          kind: "GENERATED",
          items: [{ question: "Question", pointToVerifyId: "quality-1" }],
        },
      }),
    ).assess({
      ...input,
      preflightIssues: [
        {
          bucket: "input_limitation",
          description: "Employment dates are redacted.",
          evidenceQuote: "startDate: [phone redacted]",
        },
      ],
    });
    expect(
      result.findings.filter((finding) => finding.kind === "STRENGTH"),
    ).toHaveLength(3);
    expect(
      result.findings.some(
        (finding) => finding.title === "Data quality review",
      ),
    ).toBe(false);
    expect(result.dataQualityNotes).toHaveLength(1);
    expect(result.assessmentLimitedByDataQuality).toBe(false);
    expect(result.questions.kind).toBe("GENERATED");
  });

  it("caps a minor quality issue at Medium confidence", async () => {
    const screening = validV4({
      extraction: {
        skills_found_verbatim: [],
        experience_entries: [],
        education_entries: [],
        certifications: [],
        languages: [],
        extraction_flags: ["Date format is unusual."],
      },
      data_quality_issues: [
        {
          bucket: "extraction_uncertainty",
          description: "Dates may have been missed.",
          evidence_quote: "2020 - Present",
        },
      ],
      score_breakdown: {
        required_skills_match: 20,
        experience_match: 10,
        preferred_skills_match: 5,
        education_certifications: 5,
        languages: 5,
      },
      total_score: 45,
      match_level: "medium",
      deduction_reasons: [
        {
          criterion: "required_skills_match",
          points_deducted: 20,
          evidence_quote: "Required skill is not found in the parsed text.",
        },
        {
          criterion: "experience_match",
          points_deducted: 15,
          evidence_quote: "Dates are ambiguous in the CV.",
        },
        {
          criterion: "preferred_skills_match",
          points_deducted: 10,
          evidence_quote: "Preferred skill is not found in the CV text.",
        },
        {
          criterion: "education_certifications",
          points_deducted: 5,
          evidence_quote: "No education or certification is listed.",
        },
        {
          criterion: "languages",
          points_deducted: 5,
          evidence_quote: "No language level is listed.",
        },
      ],
      confidence_pct: 60,
      requires_human_review: true,
      review_reasons: [
        {
          bucket: "extraction_uncertainty",
          reason: "Re-check the unusual date format.",
        },
      ],
      overall_assessment: "Review is needed because extraction is uncertain.",
    });
    await expect(
      new ApprovedAiAssessmentAdapter(async () => screening).assess(input),
    ).resolves.toMatchObject({
      confidencePercent: 60,
      confidenceLevel: "MEDIUM",
      requiresHumanReview: true,
    });
  });

  it("keeps the Tram React Native assessment internally consistent when dates are corrupted", async () => {
    const result = await new ApprovedAiAssessmentAdapter(async () =>
      validV5({
        dataQualityNotes: [
          {
            severity: "HIGH",
            bucket: "input_limitation",
            title: "Employment dates",
            evidence:
              "The Tram CV has redacted start/end dates, so experience duration cannot be verified.",
            affectedCategories: ["Experience"],
          },
        ],
        scoreReasoning: {
          ...validV5().scoreReasoning,
          score: 100,
          aiTotal: 100,
          breakdown: [
            { category: "Required skills", points: "40/40", note: null },
            { category: "Experience", points: "25/25", note: null },
            { category: "Preferred skills", points: "15/15", note: null },
            {
              category: "Education/certifications",
              points: "10/10",
              note: null,
            },
            { category: "Languages", points: "10/10", note: null },
          ],
          confidence: { percent: 90, level: "High", cappedReason: null },
        },
      }),
    ).assess({
      ...input,
      applicationId: "tram-react-native",
      jobTitle: "React Native Developer",
      requiredSkills: ["React Native", "TypeScript", "REST API"],
      cvText:
        "TRAM — React Native Developer. Employment dates: [redacted]. Reduced crash rate by 35% across a 200k-user product.",
      preflightIssues: [
        {
          bucket: "input_limitation",
          description:
            "Employment dates are redacted and cannot verify experience duration.",
          evidenceQuote: "Employment dates: [redacted]",
        },
      ],
    });

    expect(result.score).toBe(70);
    expect(result.score).not.toBe(100);
    expect(result.scoreReasoning.score).toBe(result.score);
    expect(result.scoreReasoning.aiTotal).toBe(result.score);
    expect(result.confidenceLevel).toBe("LOW");
    expect(result.confidencePercent).toBeLessThanOrEqual(50);
    expect(result.scoreReasoning.confidence.percent).toBe(
      result.confidencePercent,
    );
    expect(result.scoreReasoning.confidence.level).toBe("Low");
    expect(result.requiresHumanReview).toBe(true);
    expect(result.scoreReasoning.confidence.cappedReason).toBeTruthy();
    expect(
      result.scoreReasoning.breakdown.find(
        (item) => item.category === "Experience",
      ),
    ).toMatchObject({ points: "15/25" });
    expect(
      result.scoreReasoning.breakdown.some((item) =>
        item.note?.includes("capped"),
      ),
    ).toBe(true);
    expect(result.suggestedQuestions).toHaveLength(3);
    expect(result.questionsUnavailableReason).toBeNull();
    expect(result.questions.kind).toBe("GENERATED");
    if (result.questions.kind === "GENERATED")
      expect(result.questions.items).toHaveLength(3);
  });

  it("keeps a clean fully evidenced CV high-confidence and generates all questions", async () => {
    const result = await new ApprovedAiAssessmentAdapter(async () =>
      validV5(),
    ).assess({
      ...input,
      applicationId: "tran-minh-duc",
      jobTitle: "React Native Developer",
      requiredSkills: ["React Native", "TypeScript", "REST API"],
      cvText:
        "TRAN MINH DUC — React Native Developer. Reduced crash rate by 35% across a 200k-user mobile product. React Native, TypeScript, REST API. English TOEIC 780.",
    });

    expect(result.score).toBe(92);
    expect(result.scoreReasoning.score).toBe(result.score);
    expect(result.scoreReasoning.aiTotal).toBe(result.score);
    expect(result.confidencePercent).toBe(94);
    expect(result.scoreReasoning.confidence.percent).toBe(
      result.confidencePercent,
    );
    expect(result.confidenceLevel).toBe("HIGH");
    expect(result.dataQualityNotes).toHaveLength(0);
    expect(result.requiresHumanReview).toBe(false);
    expect(result.strengths).toHaveLength(3);
    expect(
      result.strengths.every(
        (item) =>
          !["React Native", "TypeScript", "REST API"].includes(item.title),
      ),
    ).toBe(true);
    expect(result.pointsToVerify).toHaveLength(2);
    expect(result.suggestedQuestions).toHaveLength(3);
    expect(result.questionsUnavailableReason).toBeNull();
    expect(result.questions.kind).toBe("GENERATED");
    if (result.questions.kind === "GENERATED")
      expect(result.questions.items).toHaveLength(3);
  });

  it("canonicalizes provider arithmetic and incomplete question arrays", async () => {
    const result = await new ApprovedAiAssessmentAdapter(async () =>
      validV5({
        scoreReasoning: {
          score: 100,
          breakdown: [
            { category: "Required skills", points: "38/40", note: null },
            { category: "Experience", points: "23/25", note: null },
            { category: "Preferred skills", points: "14/15", note: null },
            {
              category: "Education/certifications",
              points: "9/10",
              note: null,
            },
            { category: "Languages", points: "8/10", note: null },
          ],
          aiTotal: 100,
          matchLabel: "high match",
          confidence: { percent: 94, level: "High", cappedReason: null },
        },
        suggestedQuestions: ["Only one question returned by the provider."],
        questionsUnavailableReason: null,
      }),
    ).assess(input);

    expect(result.score).toBe(92);
    expect(result.scoreReasoning.score).toBe(92);
    expect(result.suggestedQuestions).toHaveLength(3);
    expect(result.questionsUnavailableReason).toBeNull();
  });

  it("uses the actionable suppression message only when the CV is unusable", async () => {
    const result = await new ApprovedAiAssessmentAdapter(async () =>
      validV5({
        extraction: {
          skills_found_verbatim: [],
          experience_entries: [
            {
              title: "",
              company: "",
              start_date: "[garbled]",
              end_date: "[garbled]",
              bullet_points: [],
            },
          ],
          education_entries: [],
          certifications: [],
          languages: [],
          extraction_flags: ["The document is garbled and unparseable."],
        },
        dataQualityNotes: [
          {
            severity: "HIGH",
            bucket: "extraction_uncertainty",
            title: "Profile data quality",
            evidence:
              "The CV is garbled and no reliable experience or skills can be extracted.",
            affectedCategories: [],
          },
        ],
        strengths: [],
        pointsToVerify: [],
        suggestedQuestions: [],
        questionsUnavailableReason: "Legacy generic fallback",
      }),
    ).assess({
      ...input,
      evidence: [{ title: "Candidate profile", excerpt: "[garbled content]" }],
      cvText: "[garbled content]",
    });

    expect(result.assessmentLimitedByDataQuality).toBe(true);
    expect(result.suggestedQuestions).toEqual([]);
    expect(result.questionsUnavailableReason).toBe(
      SUGGESTED_QUESTIONS_UNAVAILABLE_MESSAGE,
    );
    expect(result.questions.kind).toBe("INSUFFICIENT_DATA");
  });

  it("rejects a v4 result whose total does not equal its breakdown", async () => {
    const invalid = validV4({ total_score: 80 });
    await expect(
      new ApprovedAiAssessmentAdapter(async () => invalid).assess(input),
    ).rejects.toMatchObject({ code: "AI_PROVIDER_MALFORMED" });
  });

  it("rejects a v4 result with an untagged low-confidence review", async () => {
    const invalid = validV4({
      confidence_pct: 60,
      requires_human_review: false,
      review_reasons: [],
    });
    await expect(
      new ApprovedAiAssessmentAdapter(async () => invalid).assess(input),
    ).rejects.toMatchObject({ code: "AI_PROVIDER_MALFORMED" });
  });

  it("reports missing provider configuration without retrying it as a transient outage", async () => {
    const previousKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      await expect(
        new ApprovedAiAssessmentAdapter().assess(input),
      ).rejects.toMatchObject({
        code: "AI_PROVIDER_NOT_CONFIGURED",
        transient: false,
      });
    } finally {
      if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previousKey;
    }
  });
});
