export type StoredJobSkill = Readonly<{ required: boolean }>;

export type MatchingSkillRequirements<T> = Readonly<{
  requiredSkills: readonly T[];
  preferredSkills: readonly T[];
}>;

/**
 * The current recruiter form has one skill list, so legacy jobs whose whole
 * list was persisted with required=false must not receive a free automatic
 * score. Preserve an explicit mixed required/preferred split when one exists.
 */
export function resolveMatchingSkillRequirements<T>(
  requiredSkills: readonly T[],
  preferredSkills: readonly T[],
): MatchingSkillRequirements<T> {
  if (requiredSkills.length > 0 || preferredSkills.length === 0) {
    return { requiredSkills, preferredSkills };
  }

  return {
    requiredSkills: preferredSkills,
    preferredSkills: [],
  };
}

export function partitionJobSkillsForMatching<T extends StoredJobSkill>(
  skills: readonly T[],
): MatchingSkillRequirements<T> {
  return resolveMatchingSkillRequirements(
    skills.filter((skill) => skill.required),
    skills.filter((skill) => !skill.required),
  );
}
