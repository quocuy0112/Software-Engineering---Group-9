import type { AiAssessment, AutomaticMatch, ExplicitLabel, FinalScore } from "@/shared/contracts/scoring";

export const AUTOMATIC_WEIGHT = 0.6 as const;
export const AI_WEIGHT = 0.4 as const;
export const FORMULA_VERSION = "HS-60/40-v1" as const;

export function scoreBand(value: number): ExplicitLabel {
  if (value >= 80) return { code: "HIGH_MATCH", label: "Strong match", iconLabel: "\u2713" };
  if (value >= 60) return { code: "MEDIUM_MATCH", label: "Review needed", iconLabel: "!" };
  return { code: "LOW_MATCH", label: "Low match", iconLabel: "\u2715" };
}

export function calculateHybridScore(input: {
  automatic: Pick<AutomaticMatch, "score" | "cvVersion" | "jdVersion" | "configVersion">;
  ai: Pick<AiAssessment, "score">;
  computedAt?: Date;
}): FinalScore {
  if (input.automatic.score < 0 || input.automatic.score > 100 || input.ai.score < 0 || input.ai.score > 100) {
    throw new Error("SCORE_OUT_OF_RANGE");
  }
  const raw = input.automatic.score * AUTOMATIC_WEIGHT + input.ai.score * AI_WEIGHT;
  const value = Math.round((raw + Number.EPSILON) * 10) / 10;
  return {
    value,
    formulaText: input.automatic.score + " \u00D7 0.6 + " + input.ai.score + " \u00D7 0.4 = " + value,
    formulaVersion: FORMULA_VERSION,
    automaticWeight: AUTOMATIC_WEIGHT,
    aiWeight: AI_WEIGHT,
    band: scoreBand(value),
    cvVersion: input.automatic.cvVersion,
    jdVersion: input.automatic.jdVersion,
    configVersion: input.automatic.configVersion,
    computedAt: (input.computedAt ?? new Date()).toISOString(),
  };
}

export function assertCompatibleLineage(automatic: AutomaticMatch, ai: { cvVersion: string; jdVersion: string; configVersion: string }) {
  if (automatic.cvVersion !== ai.cvVersion || automatic.jdVersion !== ai.jdVersion || automatic.configVersion !== ai.configVersion) {
    throw new Error("INCOMPATIBLE_SCORE_LINEAGE");
  }
}
