import { aiAssessmentSchema, type AiAssessment } from "@/shared/contracts/scoring";
import { scoringProviderConfig } from "../providers/config";

export function normalizeAiAssessment(raw: unknown, context: { confidencePercent?: number } = {}): AiAssessment {
  const parsed = aiAssessmentSchema.parse(raw);
  const confidencePercent = context.confidencePercent ?? parsed.confidencePercent;
  const low = confidencePercent < 75;
  return {
    ...parsed,
    confidencePercent,
    confidenceLevel: low ? "LOW" : "STANDARD",
    requiresHumanReview: parsed.requiresHumanReview || low,
    confidenceLabel: low ? "Low confidence" : "Standard confidence",
    humanReviewGuidance: low
      ? "Low confidence — assess the evidence carefully yourself before deciding."
      : parsed.humanReviewGuidance,
    questions: parsed.questions,
  };
}

export function insufficientDataAssessment(input: {
  assessmentId: string;
  score: number;
  confidencePercent: number;
  provider?: string;
  modelVersion?: string;
  promptVersion?: string;
  policyVersion?: string;
}): AiAssessment {
  return normalizeAiAssessment({
    assessmentId: input.assessmentId,
    score: input.score,
    confidencePercent: input.confidencePercent,
    confidenceLevel: input.confidencePercent < 75 ? "LOW" : "STANDARD",
    confidenceLabel: input.confidencePercent < 75 ? "Low confidence" : "Standard confidence",
    humanReviewGuidance: null,
    requiresHumanReview: input.confidencePercent < 75,
    provider: input.provider ?? "approved-provider",
    modelVersion: input.modelVersion ?? scoringProviderConfig.modelVersion,
    promptVersion: input.promptVersion ?? "prompt-v4-ai-cv-assessment",
    policyVersion: input.policyVersion ?? "sensitive-attributes-v1",
    overallSummary: "AI assessment generated from job-relevant evidence.",
    breakdown: ["Technical ability reviewed from evidence.", "Role fit reviewed from evidence.", "Points were deducted where evidence was incomplete."],
    assessmentLimitedByDataQuality: false,
    dataQualityNotes: [],
    findings: [],
    compliance: { code: "SENSITIVE_ATTRIBUTES_EXCLUDED", label: "Sensitive personal attributes are excluded from scoring." },
    questions: { kind: "INSUFFICIENT_DATA", fallbackMessage: "There is not enough job-relevant evidence to generate suggested questions." },
  });
}
