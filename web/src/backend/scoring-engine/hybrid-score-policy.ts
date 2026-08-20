import {
  calculateHybridScore,
  scoreBand,
} from "@/backend/scoring/domain/hybrid-score-calculator";
import type { AutomaticMatch } from "@/shared/contracts/scoring";
import {
  roundContribution,
  type AiEvaluationResult,
  type AutomaticMatchingResult,
} from "./scoring-contracts";

export const PRIVATE_SCORING_CONFIG_VERSION = "HS-60/40-v1" as const;
export const AUTOMATIC_WEIGHT = 0.6 as const;
export const AI_WEIGHT = 0.4 as const;

export type PrivateHybridScore = Readonly<{
  value: number;
  band: "HIGH_MATCH" | "MEDIUM_MATCH" | "LOW_MATCH";
  label: string;
  formulaText: string;
  automaticContribution: number;
  aiContribution: number;
}>;

/** The existing Feature 012 calculator remains the arithmetic authority. */
export function calculatePrivateHybridScore(
  automatic: AutomaticMatchingResult,
  ai: AiEvaluationResult,
): PrivateHybridScore {
  if (
    automatic.cvVersion !== ai.cvVersion ||
    automatic.jdVersion !== ai.jdVersion ||
    automatic.configVersion !== ai.configVersion
  ) {
    throw new Error("INCOMPATIBLE_SCORE_LINEAGE");
  }
  const compatibleAutomatic = {
    resultId: automatic.resultId,
    score: automatic.score,
    cvVersion: automatic.cvVersion,
    jdVersion: automatic.jdVersion,
    configVersion: automatic.configVersion,
    parserVersion: automatic.parserProvenance.parserVersion,
    cvParse: {
      code: "PARSED_SUCCESSFULLY" as const,
      label: "Parsed successfully" as const,
      parserVersion: automatic.parserProvenance.parserVersion,
      processingMilliseconds: 0,
      snapshotVersion: automatic.cvVersion,
    },
    jdParse: {
      code: "PARSED_SUCCESSFULLY" as const,
      label: "Parsed successfully" as const,
      parserVersion: automatic.parserProvenance.parserVersion,
      processingMilliseconds: 0,
      snapshotVersion: automatic.jdVersion,
    },
    mayBeIncomplete: automatic.mayBeIncomplete,
    incompletenessLabel: null,
    foundRequiredSkills: [],
    missingRequiredSkills: [],
    preferredSkills: [],
    minimumExperienceYears: automatic.requiredExperience,
    detectedExperience:
      automatic.detectedExperience === null
        ? { kind: "NOT_DETECTED" as const, label: "Not detected" as const }
        : {
            kind: "DETECTED" as const,
            years: automatic.detectedExperience,
            label: `${automatic.detectedExperience} years detected`,
          },
  } satisfies AutomaticMatch;
  const final = calculateHybridScore({
    automatic: compatibleAutomatic,
    ai: { score: ai.score } as never,
  });
  return {
    value: final.value,
    band: final.band.code as PrivateHybridScore["band"],
    label: final.band.label,
    formulaText: `${automatic.score} × 60% + ${ai.score} × 40% = ${final.value}`,
    automaticContribution: roundContribution(automatic.score, AUTOMATIC_WEIGHT),
    aiContribution: roundContribution(ai.score, AI_WEIGHT),
  };
}

export function privateScoreBand(value: number) {
  return scoreBand(value);
}
