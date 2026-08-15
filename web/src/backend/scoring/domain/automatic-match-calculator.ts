import type {
  AutomaticMatch,
  DetectedExperience,
  ParseStatus,
} from "@/shared/contracts/scoring";
import { extractSkillEvidence, type SkillCriterion } from "./skill-evidence-extractor";

export type AutomaticMatchInput = Readonly<{
  applicationId: string;
  cvText: string;
  cvVersion: string;
  jdVersion: string;
  configVersion: string;
  parserVersion: string;
  cvParse: ParseStatus;
  jdParse: ParseStatus;
  requiredSkills: readonly SkillCriterion[];
  preferredSkills: readonly SkillCriterion[];
  minimumExperienceYears: number | null;
}>;

export type AutomaticMatchCalculation = Readonly<{
  result: AutomaticMatch;
  requiredSkillPoints: number;
  experiencePoints: number;
  preferredSkillBonus: number;
}>;

function detectExperience(text: string): DetectedExperience {
  const values = [...text.matchAll(/(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)/giu)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value));
  const years = values.length ? Math.max(...values) : null;
  return years === null
    ? { kind: "NOT_DETECTED", label: "Not detected" }
    : { kind: "DETECTED", years, label: `${years} years detected` };
}

export function calculateAutomaticMatch(input: AutomaticMatchInput): AutomaticMatchCalculation {
  const extracted = extractSkillEvidence(
    input.cvText,
    input.requiredSkills,
    input.preferredSkills,
    { cvSnapshotVersion: input.cvVersion, parserVersion: input.parserVersion },
  );
  const requiredSkillPoints = input.requiredSkills.length === 0
    ? 100
    : (extracted.foundRequiredSkills.length / input.requiredSkills.length) * 75;
  const detectedExperience = detectExperience(input.cvText);
  const experiencePoints = input.minimumExperienceYears === null
    ? 25
    : detectedExperience.kind === "DETECTED"
      ? Math.min(25, (detectedExperience.years / Math.max(input.minimumExperienceYears, 1)) * 25)
      : 0;
  const score = Math.round(Math.min(100, requiredSkillPoints + experiencePoints) * 10) / 10;
  const incomplete = input.cvParse.code !== "PARSED_SUCCESSFULLY" || input.jdParse.code !== "PARSED_SUCCESSFULLY";
  return {
    result: {
      resultId: `automatic-${input.applicationId}-${input.cvVersion}-${input.jdVersion}`,
      score,
      cvVersion: input.cvVersion,
      jdVersion: input.jdVersion,
      configVersion: input.configVersion,
      parserVersion: input.parserVersion,
      cvParse: input.cvParse,
      jdParse: input.jdParse,
      mayBeIncomplete: incomplete,
      incompletenessLabel: incomplete ? "This score may be incomplete because document parsing reported an issue." : null,
      foundRequiredSkills: extracted.foundRequiredSkills,
      missingRequiredSkills: extracted.missingRequiredSkills,
      preferredSkills: extracted.preferredSkills,
      minimumExperienceYears: input.minimumExperienceYears,
      detectedExperience,
    },
    requiredSkillPoints,
    experiencePoints,
    preferredSkillBonus: 0,
  };
}
