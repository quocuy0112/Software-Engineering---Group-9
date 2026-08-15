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

function parseDateToken(value: string): { year: number; month: number } | null {
  const normalized = value.trim().toLocaleLowerCase("en-US");
  if (/^(?:present|current|now|ongoing|hiện tại|hien tai)$/iu.test(normalized)) {
    const now = new Date();
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  }
  const yearMonth = normalized.match(/^(\d{4})[./-](\d{1,2})(?:[./-]\d{1,2})?$/u);
  if (yearMonth) {
    const year = Number(yearMonth[1]);
    const month = Number(yearMonth[2]);
    return year >= 1900 && year <= new Date().getUTCFullYear() + 1 && month >= 1 && month <= 12
      ? { year, month }
      : null;
  }
  const monthYear = normalized.match(/^(\d{1,2})[./-](\d{4})$/u);
  if (monthYear) {
    const month = Number(monthYear[1]);
    const year = Number(monthYear[2]);
    return year >= 1900 && year <= new Date().getUTCFullYear() + 1 && month >= 1 && month <= 12
      ? { year, month }
      : null;
  }
  const yearOnly = normalized.match(/^(\d{4})$/u);
  if (yearOnly) {
    const year = Number(yearOnly[1]);
    return year >= 1900 && year <= new Date().getUTCFullYear() + 1
      ? { year, month: 1 }
      : null;
  }
  return null;
}

function monthsBetween(start: { year: number; month: number }, end: { year: number; month: number }) {
  return Math.max(0, (end.year - start.year) * 12 + end.month - start.month);
}

function dateRangeValues(text: string): number[] {
  const values: number[] = [];
  const add = (startValue: string, endValue: string) => {
    const start = parseDateToken(startValue);
    const end = parseDateToken(endValue);
    if (!start || !end) return;
    const months = monthsBetween(start, end);
    if (months > 0) values.push(months / 12);
  };

  // Structured profile snapshots use these exact keys.  Supporting them is
  // important when a committed application document is temporarily
  // unavailable: the worker can still score the immutable profile snapshot
  // without treating the candidate's experience as zero.
  const structured = /"startDate"\s*:\s*"([^"]+)"\s*,\s*"endDate"\s*:\s*(?:"([^"]+)"|null)/giu;
  for (const match of text.matchAll(structured)) add(match[1] ?? "", match[2] ?? "Present");

  // Plain CV text commonly uses `06/2024 – Present`, `03/2023 - 05/2024`,
  // or an equivalent `to` separator.  The parser intentionally rejects
  // impossible years (for example `0634-06-01`) rather than inventing a
  // duration from malformed extraction output.
  const workHeading = /(?:work\s+experience|professional\s+experience|employment\s+history|kinh\s+nghiệm\s+việc\s+làm|kinh\s+nghiem\s+viec\s+lam)/iu.exec(text);
  if (!workHeading) return values;
  const afterHeading = text.slice(workHeading.index + workHeading[0].length);
  // Native PDF extraction often flattens every page into one paragraph, so
  // section headings are not guaranteed to start after a newline. Stop at
  // the first heading token anywhere in the remaining text; otherwise an
  // education range such as `2019 – 2023` is incorrectly counted as work
  // experience.
  const nextSection = /\b(?:education|academic|certifications?|languages?|skills?|projects?|học\s+vấn|hoc\s+van|chứng\s+chỉ|chung\s+chi|kỹ\s+năng|ky\s+nang)\b/iu.exec(afterHeading);
  const workText = nextSection ? afterHeading.slice(0, nextSection.index) : afterHeading;
  const ranges = /((?:\d{1,2}[./-]\d{4}|\d{4}[./-]\d{1,2}(?:[./-]\d{1,2})?|\d{4}))\s*(?:[-–—]|\bto\b|\buntil\b)\s*((?:present|current|now|ongoing|hiện tại|hien tai)|(?:\d{1,2}[./-]\d{4}|\d{4}[./-]\d{1,2}(?:[./-]\d{1,2})?|\d{4}))/giu;
  for (const match of workText.matchAll(ranges)) add(match[1] ?? "", match[2] ?? "");
  return values;
}

function detectExperience(text: string): DetectedExperience {
  const yearValues = [...text.matchAll(/(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)/giu)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value));
  const monthValues = [...text.matchAll(/(\d+(?:\.\d+)?)\s*\+?\s*(?:months?|mos?)/giu)]
    .map((match) => Number(match[1]) / 12)
    .filter((value) => Number.isFinite(value));
  const values = [...yearValues, ...monthValues, ...dateRangeValues(text)];
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
    ? 75
    : (extracted.foundRequiredSkills.length / input.requiredSkills.length) * 75;
  const detectedExperience = detectExperience(input.cvText);
  const experiencePoints = input.minimumExperienceYears === null || input.minimumExperienceYears <= 0
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
