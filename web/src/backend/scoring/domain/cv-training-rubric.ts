export const CV_TRAINING_RUBRIC = Object.freeze({
  experience_match: 30,
  skills_match: 25,
  education_match: 15,
  language_match: 10,
  role_relevance: 20,
} as const);

export type CvTrainingScoreBreakdown = Readonly<{
  experience_match: number;
  skills_match: number;
  education_match: number;
  language_match: number;
  role_relevance: number;
}>;

export type CvTrainingMatchLevel = "high" | "medium" | "low";

export function cvTrainingTotalScore(
  breakdown: CvTrainingScoreBreakdown,
): number {
  return Object.keys(CV_TRAINING_RUBRIC).reduce(
    (total, key) =>
      total + breakdown[key as keyof CvTrainingScoreBreakdown],
    0,
  );
}

export function cvTrainingMatchLevel(score: number): CvTrainingMatchLevel {
  if (score >= 75) return "high";
  if (score >= 45) return "medium";
  return "low";
}

export function isCvTrainingScoreBreakdown(
  value: unknown,
): value is CvTrainingScoreBreakdown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (Object.keys(CV_TRAINING_RUBRIC) as Array<keyof CvTrainingScoreBreakdown>).every(
    (key) => {
      const score = candidate[key];
      return (
        typeof score === "number" &&
        Number.isFinite(score) &&
        score >= 0 &&
        score <= CV_TRAINING_RUBRIC[key]
      );
    },
  );
}

export function assertCvTrainingScore(input: {
  totalScore: number;
  breakdown: CvTrainingScoreBreakdown;
  matchLevel?: string;
}) {
  if (!Number.isFinite(input.totalScore) || input.totalScore < 0 || input.totalScore > 100) {
    throw new Error("CV_TRAINING_SCORE_OUT_OF_RANGE");
  }
  if (!isCvTrainingScoreBreakdown(input.breakdown)) {
    throw new Error("CV_TRAINING_BREAKDOWN_OUT_OF_RANGE");
  }
  const expected = cvTrainingTotalScore(input.breakdown);
  if (Math.abs(expected - input.totalScore) > 0.1) {
    throw new Error("CV_TRAINING_SCORE_SUM_MISMATCH");
  }
  if (input.matchLevel !== undefined && input.matchLevel !== cvTrainingMatchLevel(input.totalScore)) {
    throw new Error("CV_TRAINING_MATCH_LEVEL_MISMATCH");
  }
}
