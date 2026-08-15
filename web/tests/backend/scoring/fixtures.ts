import type { AiAssessment, AutomaticMatch } from "@/shared/contracts/scoring";

export const scoringFixtureStatus = (snapshotVersion = "v1") => ({
  code: "PARSED_SUCCESSFULLY" as const,
  label: "Parsed successfully" as const,
  parserVersion: "parser-v2.4",
  processingMilliseconds: 1800,
  snapshotVersion,
});

export function automaticFixture(overrides: Partial<AutomaticMatch> = {}): AutomaticMatch {
  return {
    resultId: "automatic-fixture-1",
    score: 92,
    cvVersion: "CV-v1",
    jdVersion: "JD-v3",
    configVersion: "HS-60/40-v1",
    parserVersion: "parser-v2.4",
    cvParse: scoringFixtureStatus("CV-v1"),
    jdParse: scoringFixtureStatus("JD-v3"),
    mayBeIncomplete: false,
    incompletenessLabel: null,
    foundRequiredSkills: [{ skillCode: "react", label: "React", requirementKind: "REQUIRED", matchState: "FOUND", evidence: [{ excerpt: "Built React applications for five years.", pageNumber: 2, cvSnapshotVersion: "CV-v1", parserVersion: "parser-v2.4" }] }],
    missingRequiredSkills: [],
    preferredSkills: [],
    minimumExperienceYears: 3,
    detectedExperience: { kind: "DETECTED", years: 5, label: "5 years detected" },
    ...overrides,
  };
}

export function aiFixture(overrides: Partial<AiAssessment> = {}): AiAssessment {
  return {
    assessmentId: "ai-fixture-1",
    score: 88,
    confidencePercent: 82,
    confidenceLevel: "STANDARD",
    confidenceLabel: "Standard confidence",
    humanReviewGuidance: null,
    provider: "approved-fixture-provider",
    modelVersion: "model-v1",
    promptVersion: "prompt-v3",
    policyVersion: "sensitive-attributes-v1",
    overallSummary: "Strong evidence of relevant technical delivery.",
    breakdown: ["Technical ability is supported by the CV.", "Role fit is supported by relevant delivery.", "Points were deducted for one item to verify."],
    findings: [{ id: "finding-1", kind: "POINT_TO_VERIFY", title: "Verify scale", evidence: "The CV does not state production traffic volume." }],
    compliance: { code: "SENSITIVE_ATTRIBUTES_EXCLUDED", label: "Sensitive personal attributes are excluded from scoring." },
    questions: { kind: "GENERATED", items: [{ question: "What production scale did you support?", pointToVerifyId: "finding-1" }] },
    ...overrides,
  };
}
