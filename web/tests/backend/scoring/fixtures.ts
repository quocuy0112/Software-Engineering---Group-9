import type { AiAssessment, AutomaticMatch } from "@/shared/contracts/scoring";

export const scoringFixtureStatus = (snapshotVersion = "v1") => ({
  code: "PARSED_SUCCESSFULLY" as const,
  label: "Parsed successfully" as const,
  parserVersion: "parser-v2.4",
  processingMilliseconds: 1800,
  snapshotVersion,
});

export function automaticFixture(
  overrides: Partial<AutomaticMatch> = {},
): AutomaticMatch {
  return {
    resultId: "automatic-fixture-1",
    score: 92,
    cvVersion: "CV-v1",
    jdVersion: "JD-v3",
    configVersion: "HS-40/60-v1",
    parserVersion: "parser-v2.4",
    cvParse: scoringFixtureStatus("CV-v1"),
    jdParse: scoringFixtureStatus("JD-v3"),
    mayBeIncomplete: false,
    incompletenessLabel: null,
    foundRequiredSkills: [
      {
        skillCode: "react",
        label: "React",
        requirementKind: "REQUIRED",
        matchState: "FOUND",
        evidence: [
          {
            excerpt: "Built React applications for five years.",
            pageNumber: 2,
            cvSnapshotVersion: "CV-v1",
            parserVersion: "parser-v2.4",
          },
        ],
      },
    ],
    missingRequiredSkills: [],
    preferredSkills: [],
    minimumExperienceYears: 3,
    detectedExperience: {
      kind: "DETECTED",
      years: 5,
      label: "5 years detected",
    },
    ...overrides,
  };
}

export function aiFixture(overrides: Partial<AiAssessment> = {}): AiAssessment {
  return {
    assessmentId: "ai-fixture-1",
    score: 88,
    confidencePercent: 82,
    confidenceLevel: "HIGH",
    confidenceLabel: "High confidence",
    humanReviewGuidance: null,
    requiresHumanReview: false,
    provider: "approved-fixture-provider",
    modelVersion: "model-v1",
    promptVersion: "prompt-v5-ai-cv-assessment",
    policyVersion: "sensitive-attributes-v1",
    overallSummary: "Strong evidence of relevant technical delivery.",
    breakdown: [
      "Technical ability is supported by the CV.",
      "Role fit is supported by relevant delivery.",
      "Points were deducted for one item to verify.",
    ],
    scoreReasoning: {
      score: 88,
      breakdown: [
        { category: "Required skills", points: "36/40", note: null },
        { category: "Experience", points: "22/25", note: null },
        { category: "Preferred skills", points: "12/15", note: null },
        { category: "Education/certifications", points: "9/10", note: null },
        { category: "Languages", points: "9/10", note: null },
      ],
      aiTotal: 88,
      matchLabel: "high match",
      confidence: { percent: 82, level: "High", cappedReason: null },
    },
    strengths: [
      {
        title: "Relevant delivery depth",
        evidence: "Built and shipped React applications.",
      },
      {
        title: "Role-level ownership",
        evidence:
          "Owned delivery of a production feature from implementation through release.",
      },
      {
        title: "Combined-skill evidence",
        evidence:
          "The CV connects React delivery with API integration in one project.",
      },
    ],
    pointsToVerify: [
      {
        title: "Verify production scale",
        reason:
          "The CV does not quantify the production traffic or user volume supported.",
      },
    ],
    suggestedQuestions: [
      "What production traffic or user volume did you support in the React application?",
      "Your CV says you shipped the feature; what metric changed after release and how did you measure it?",
      "How would you apply React and API integration in this role's first project?",
    ],
    questionsUnavailableReason: null,
    assessmentLimitedByDataQuality: false,
    dataQualityNotes: [],
    findings: [
      {
        id: "point-to-verify-1",
        kind: "POINT_TO_VERIFY",
        title: "Verify production scale",
        evidence:
          "The CV does not quantify the production traffic or user volume supported.",
      },
    ],
    compliance: {
      code: "SENSITIVE_ATTRIBUTES_EXCLUDED",
      label: "Sensitive personal attributes are excluded from scoring.",
    },
    questions: {
      kind: "GENERATED",
      items: [
        {
          question:
            "What production traffic or user volume did you support in the React application?",
          pointToVerifyId: "point-to-verify-1",
        },
        {
          question:
            "Your CV says you shipped the feature; what metric changed after release and how did you measure it?",
          pointToVerifyId: "point-to-verify-1",
        },
        {
          question:
            "How would you apply React and API integration in this role's first project?",
          pointToVerifyId: "point-to-verify-1",
        },
      ],
    },
    ...overrides,
  };
}
