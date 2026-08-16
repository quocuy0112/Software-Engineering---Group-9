import {
  aiAssessmentSchema,
  type AiAssessment,
} from "@/shared/contracts/scoring";
import { scoringProviderConfig } from "../providers/config";

function qualityAdjustedReasoning(
  reasoning: AiAssessment["scoreReasoning"],
  notes: AiAssessment["dataQualityNotes"],
): AiAssessment["scoreReasoning"] {
  const hasHighSeverity = notes.some((note) => note.severity === "HIGH");
  const target = hasHighSeverity ? 70 : notes.length > 0 ? 95 : null;
  if (target === null || reasoning.score <= target) return reasoning;

  let remaining = target;
  const noteText = hasHighSeverity
    ? "capped — overall score reflects HIGH CV data-quality uncertainty"
    : "reduced — overall score reflects minor CV data-quality uncertainty";
  const breakdown = reasoning.breakdown.map((item) => {
    const [earnedText, maximumText] = item.points.split("/");
    const earned = Number(earnedText);
    const next = Math.min(earned, Math.max(0, remaining));
    remaining -= next;
    return {
      ...item,
      points: `${Math.round(next * 10) / 10}/${maximumText}`,
      note: next < earned ? (item.note ?? noteText) : item.note,
    };
  });
  const score =
    Math.round(
      breakdown.reduce(
        (sum, item) => sum + Number(item.points.split("/")[0]),
        0,
      ) * 10,
    ) / 10;
  return {
    ...reasoning,
    score,
    aiTotal: score,
    matchLabel:
      score >= 75 ? "high match" : score >= 45 ? "medium match" : "low match",
    breakdown,
  };
}

export function normalizeAiAssessment(
  raw: unknown,
  context: { confidencePercent?: number } = {},
): AiAssessment {
  const parsed = aiAssessmentSchema.parse(raw);
  const qualityCap = parsed.dataQualityNotes.some(
    (note) => note.severity === "HIGH",
  )
    ? 50
    : parsed.dataQualityNotes.length > 0
      ? 75
      : 95;
  const confidencePercent = Math.min(
    context.confidencePercent ?? parsed.confidencePercent,
    qualityCap,
  );
  const low = confidencePercent < 76;
  const level = parsed.dataQualityNotes.some((note) => note.severity === "HIGH")
    ? "LOW"
    : parsed.dataQualityNotes.length > 0
      ? "MEDIUM"
      : confidencePercent >= 76
        ? "HIGH"
        : confidencePercent >= 60
          ? "MEDIUM"
          : "LOW";
  const confidenceText =
    level === "LOW" ? "Low" : level === "MEDIUM" ? "Medium" : "High";
  const scoreReasoning = qualityAdjustedReasoning(
    parsed.scoreReasoning,
    parsed.dataQualityNotes,
  );
  return {
    ...parsed,
    score: scoreReasoning.score,
    confidencePercent,
    confidenceLevel: level,
    requiresHumanReview:
      parsed.requiresHumanReview || low || parsed.dataQualityNotes.length > 0,
    confidenceLabel: `${confidenceText} confidence`,
    humanReviewGuidance:
      low || parsed.dataQualityNotes.length > 0
        ? parsed.dataQualityNotes.length > 0
          ? `Confidence is capped because ${parsed.dataQualityNotes[0]?.title.toLocaleLowerCase("en-US") ?? "CV data quality is limited"}. Review the evidence before deciding.`
          : "Low confidence — assess the evidence carefully yourself before deciding."
        : parsed.humanReviewGuidance,
    scoreReasoning: {
      ...scoreReasoning,
      confidence: {
        percent: confidencePercent,
        level: confidenceText,
        cappedReason:
          parsed.dataQualityNotes.length > 0
            ? (scoreReasoning.confidence.cappedReason ??
              "Confidence was capped because the CV contains data-quality limitations.")
            : parsed.scoreReasoning.confidence.cappedReason,
      },
    },
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
  const requiredSkills = Math.min(40, input.score);
  const remaining = Math.max(0, input.score - requiredSkills);
  const experience = Math.min(25, remaining);
  const remainingAfterExperience = Math.max(0, remaining - experience);
  const preferred = Math.min(15, remainingAfterExperience);
  const remainingAfterPreferred = Math.max(
    0,
    remainingAfterExperience - preferred,
  );
  const education = Math.min(10, remainingAfterPreferred);
  const languages = Math.min(
    10,
    Math.max(0, remainingAfterPreferred - education),
  );
  const confidenceLevel =
    input.confidencePercent < 60
      ? "Low"
      : input.confidencePercent < 76
        ? "Medium"
        : "High";
  return normalizeAiAssessment({
    assessmentId: input.assessmentId,
    score: input.score,
    confidencePercent: input.confidencePercent,
    confidenceLevel: confidenceLevel.toUpperCase(),
    confidenceLabel: `${confidenceLevel} confidence`,
    humanReviewGuidance: null,
    requiresHumanReview: input.confidencePercent < 76,
    provider: input.provider ?? "approved-provider",
    modelVersion: input.modelVersion ?? scoringProviderConfig.modelVersion,
    promptVersion: input.promptVersion ?? "prompt-v5-ai-cv-assessment",
    policyVersion: input.policyVersion ?? "sensitive-attributes-v1",
    overallSummary: "AI assessment generated from job-relevant evidence.",
    breakdown: [
      "Technical ability reviewed from evidence.",
      "Role fit reviewed from evidence.",
      "Points were deducted where evidence was incomplete.",
    ],
    scoreReasoning: {
      score: input.score,
      breakdown: [
        {
          category: "Required skills",
          points: `${requiredSkills}/40`,
          note: null,
        },
        { category: "Experience", points: `${experience}/25`, note: null },
        { category: "Preferred skills", points: `${preferred}/15`, note: null },
        {
          category: "Education/certifications",
          points: `${education}/10`,
          note: null,
        },
        { category: "Languages", points: `${languages}/10`, note: null },
      ],
      aiTotal: input.score,
      matchLabel:
        input.score >= 75
          ? "high match"
          : input.score >= 45
            ? "medium match"
            : "low match",
      confidence: {
        percent: input.confidencePercent,
        level: confidenceLevel,
        cappedReason: null,
      },
    },
    strengths: [],
    pointsToVerify: [],
    suggestedQuestions: [],
    questionsUnavailableReason:
      "There is not enough job-relevant evidence to generate candidate-specific questions.",
    assessmentLimitedByDataQuality: false,
    dataQualityNotes: [],
    findings: [],
    compliance: {
      code: "SENSITIVE_ATTRIBUTES_EXCLUDED",
      label: "Sensitive personal attributes are excluded from scoring.",
    },
    questions: {
      kind: "INSUFFICIENT_DATA",
      fallbackMessage:
        "There is not enough job-relevant evidence to generate suggested questions.",
    },
  });
}
