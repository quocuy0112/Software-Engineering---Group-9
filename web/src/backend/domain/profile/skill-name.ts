export class SkillNameInvalidError extends Error {
  constructor() {
    super("SKILL_NAME_INVALID");
  }
}

export function normalizeProfileSkillName(value: string): {
  displayName: string;
  normalizedName: string;
} {
  const displayName = value.normalize("NFKC").replace(/\s+/gu, " ").trim();
  const length = Array.from(displayName).length;
  if (length < 1 || length > 80) {
    throw new SkillNameInvalidError();
  }
  return {
    displayName,
    normalizedName: displayName.toLocaleLowerCase("en-US"),
  };
}
