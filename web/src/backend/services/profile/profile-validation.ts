import "server-only";
import type {
  ProfileEducationMutation,
  ProfileExperienceMutation,
} from "@/shared/contracts/account/profile";
import {
  normalizeProfileSkillName,
  SkillNameInvalidError,
} from "@/backend/domain/profile/skill-name";

export const PROFILE_PHONE_PATTERN =
  /^(?=(?:[^0-9]*[0-9]){7,15}[^0-9]*$)\+?(?:[0-9]{1,4}|\([0-9]{1,4}\))(?:[ .-]?(?:[0-9]{1,4}|\([0-9]{1,4}\)))*$/u;

export class ProfileValidationError extends Error {
  constructor(
    readonly field: string,
    readonly code: string,
  ) {
    super(`PROFILE_VALIDATION_ERROR:${field}:${code}`);
  }
}

export function assertCodePointLength(
  field: string,
  value: string,
  maximum: number,
  minimum = 0,
): void {
  const length = Array.from(value).length;
  if (length < minimum || length > maximum) {
    throw new ProfileValidationError(field, "LENGTH");
  }
}

export function validateProfilePhone(value: string | null): string | null {
  if (value === null || value.trim() === "") return null;
  const normalized = value.normalize("NFKC").trim();
  assertCodePointLength("basics.phone", normalized, 32, 1);
  if (!PROFILE_PHONE_PATTERN.test(normalized)) {
    throw new ProfileValidationError("basics.phone", "FORMAT");
  }
  return normalized;
}

export function assertIsoDate(field: string, value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new ProfileValidationError(field, "DATE");
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new ProfileValidationError(field, "DATE");
  }
}

export function validateExperienceEntry(
  entry: ProfileExperienceMutation,
  today: string,
  index = 0,
): ProfileExperienceMutation {
  const root = `experience.${index}`;
  assertCodePointLength(`${root}.title`, entry.title, 200, 1);
  assertCodePointLength(`${root}.company`, entry.company, 200, 1);
  if (entry.description !== null) {
    assertCodePointLength(`${root}.description`, entry.description, 3_000);
  }
  assertIsoDate(`${root}.startDate`, entry.startDate);
  if (entry.startDate > today) {
    throw new ProfileValidationError(`${root}.startDate`, "FUTURE");
  }
  if (entry.endDate !== null) {
    assertIsoDate(`${root}.endDate`, entry.endDate);
  }
  if (entry.current && entry.endDate !== null) {
    throw new ProfileValidationError(`${root}.endDate`, "CURRENT_HAS_END");
  }
  if (!entry.current && entry.endDate === null) {
    throw new ProfileValidationError(`${root}.endDate`, "REQUIRED");
  }
  if (
    entry.endDate !== null &&
    (entry.endDate < entry.startDate ||
      (!entry.current && entry.endDate > today))
  ) {
    throw new ProfileValidationError(`${root}.endDate`, "DATE_RANGE");
  }
  return entry;
}

export function validateEducationEntry(
  entry: ProfileEducationMutation,
  today: string,
  index = 0,
): ProfileEducationMutation {
  const root = `education.${index}`;
  assertCodePointLength(`${root}.institution`, entry.institution, 200, 1);
  assertCodePointLength(`${root}.degree`, entry.degree, 200, 1);
  if (entry.field !== null) {
    assertCodePointLength(`${root}.field`, entry.field, 200);
  }
  assertIsoDate(`${root}.startDate`, entry.startDate);
  if (entry.startDate > today) {
    throw new ProfileValidationError(`${root}.startDate`, "FUTURE");
  }
  if (entry.endDate !== null) {
    assertIsoDate(`${root}.endDate`, entry.endDate);
    if (entry.endDate < entry.startDate) {
      throw new ProfileValidationError(`${root}.endDate`, "DATE_RANGE");
    }
  }
  if (!entry.current && entry.endDate === null) {
    throw new ProfileValidationError(`${root}.endDate`, "REQUIRED");
  }
  if (!entry.current && entry.endDate !== null && entry.endDate > today) {
    throw new ProfileValidationError(`${root}.endDate`, "FUTURE");
  }
  return entry;
}

export function normalizeSkillName(value: string): {
  displayName: string;
  normalizedName: string;
} {
  try {
    return normalizeProfileSkillName(value);
  } catch (error) {
    if (error instanceof SkillNameInvalidError) {
      throw new ProfileValidationError("skills.label", "LENGTH");
    }
    throw error;
  }
}

export function validateUniqueSkills(values: string[]): void {
  const keys = values.map((value) => normalizeSkillName(value).normalizedName);
  if (new Set(keys).size !== keys.length) {
    throw new ProfileValidationError("skills", "DUPLICATE");
  }
}

export function normalizeSocialUrl(value: string): string {
  const normalized = value.normalize("NFKC").trim();
  assertCodePointLength("socialLinks.url", normalized, 2_048, 1);
  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new ProfileValidationError("socialLinks.url", "URL");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new ProfileValidationError("socialLinks.url", "URL");
  }
  return url.toString();
}

export function validateUniqueSocialLinks(values: string[]): string[] {
  const normalized = values.map(normalizeSocialUrl);
  if (new Set(normalized).size !== normalized.length) {
    throw new ProfileValidationError("socialLinks", "DUPLICATE");
  }
  return normalized;
}

export function assertProfileCollectionCaps(input: {
  skills: unknown[];
  experience: unknown[];
  education: unknown[];
  socialLinks: unknown[];
}): void {
  for (const [field, values, maximum] of [
    ["skills", input.skills, 50],
    ["experience", input.experience, 50],
    ["education", input.education, 50],
    ["socialLinks", input.socialLinks, 10],
  ] as const) {
    if (values.length > maximum) {
      throw new ProfileValidationError(field, "CAP");
    }
  }
}
