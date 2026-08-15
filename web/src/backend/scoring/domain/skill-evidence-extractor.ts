import type { EvidenceExcerpt, SkillEvidence } from "@/shared/contracts/scoring";

export type SkillCriterion = Readonly<{ code: string; label: string }>;

function normalize(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}+#.]+/gu, " ")
    .trim();
}

function excerptFor(text: string, index: number, skill: string): EvidenceExcerpt {
  const start = Math.max(0, text.lastIndexOf(".", index - 1) + 1);
  const endCandidate = text.indexOf(".", index + skill.length);
  const end = endCandidate < 0 ? Math.min(text.length, start + 320) : endCandidate + 1;
  const excerpt = text.slice(start, end).trim().slice(0, 320) || skill;
  const pageMatch = text.slice(Math.max(0, index - 80), index + 80).match(/\[page\s+(\d+)\]/iu);
  return {
    excerpt,
    ...(pageMatch ? { pageNumber: Number(pageMatch[1]) } : { sectionLabel: "CV body" }),
    cvSnapshotVersion: "cv-snapshot",
    parserVersion: "parser-v1",
  };
}

export function extractSkillEvidence(
  text: string,
  required: readonly SkillCriterion[],
  preferred: readonly SkillCriterion[],
  provenance: { cvSnapshotVersion: string; parserVersion: string },
): Readonly<{
  foundRequiredSkills: SkillEvidence[];
  missingRequiredSkills: SkillEvidence[];
  preferredSkills: SkillEvidence[];
}> {
  const normalizedText = normalize(text);
  const evidence = (criterion: SkillCriterion, state: SkillEvidence["matchState"], requirementKind: SkillEvidence["requirementKind"]): SkillEvidence => {
    const needle = normalize(criterion.label);
    const index = normalizedText.indexOf(needle);
    const excerpts = index >= 0
      ? [{ ...excerptFor(text, index, criterion.label), cvSnapshotVersion: provenance.cvSnapshotVersion, parserVersion: provenance.parserVersion }]
      : [];
    return {
      skillCode: criterion.code,
      label: criterion.label,
      requirementKind,
      matchState: state,
      evidence: excerpts,
    };
  };
  const foundRequiredSkills: SkillEvidence[] = [];
  const missingRequiredSkills: SkillEvidence[] = [];
  for (const criterion of required) {
    const item = evidence(criterion, "FOUND", "REQUIRED");
    (item.evidence.length ? foundRequiredSkills : missingRequiredSkills).push(
      item.evidence.length ? item : { ...item, matchState: "MISSING" },
    );
  }
  const preferredSkills = preferred.map((criterion) => {
    const item = evidence(criterion, "NEUTRAL_PREFERRED", "PREFERRED");
    return item;
  });
  return { foundRequiredSkills, missingRequiredSkills, preferredSkills };
}
