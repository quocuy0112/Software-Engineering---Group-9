import "server-only";
import { z } from "zod";
import type { Clock } from "@/backend/time/clock";
import { systemClock } from "@/backend/time/clock";
import {
  PlainTextNormalizationError,
  PlainTextNormalizer,
} from "@/backend/security/plain-text/plain-text-normalizer";
import { PrismaProfileCommandRepository } from "@/backend/repositories/profile/prisma-profile-command-repository";
import {
  profileMutationOutcomeSchema,
  profileSectionMutationSchema,
  type NormalizationWarning,
  type ProfileMutationOutcome,
  type ProfileSectionMutation,
} from "@/shared/contracts/account/profile";
import {
  ProfileValidationError,
  assertCodePointLength,
  assertProfileCollectionCaps,
  normalizeSkillName,
  normalizeSocialUrl,
  validateEducationEntry,
  validateExperienceEntry,
  validateProfilePhone,
  assertIsoDate,
  validateUniqueSkills,
  validateUniqueSocialLinks,
} from "./profile-validation";
import { GetProfileAggregateService } from "./get-profile-aggregate";

const normalizer = new PlainTextNormalizer();

function normalizeText(
  value: string | null,
  field: string,
  maximum: number,
  required = false,
  multiline = false,
): { value: string | null; warning?: NormalizationWarning } {
  try {
    const result = normalizer.normalize(value, {
      field,
      maxCodePoints: maximum,
      required,
      multiline,
    });
    return {
      value: result.value,
      warning: result.warnings.length
        ? {
            field,
            message: "Unsafe or empty content was removed.",
          }
        : undefined,
    };
  } catch (error) {
    if (error instanceof PlainTextNormalizationError) {
      throw new ProfileValidationError(field, error.code);
    }
    throw error;
  }
}

export function normalizeProfileMutationText(input: unknown): {
  mutation: ProfileSectionMutation;
  warnings: NormalizationWarning[];
} {
  let parsed: ProfileSectionMutation;
  try {
    parsed = profileSectionMutationSchema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ProfileValidationError("request", "INVALID");
    }
    throw error;
  }
  const warnings: NormalizationWarning[] = [];
  const collect = (result: ReturnType<typeof normalizeText>) => {
    if (result.warning) warnings.push(result.warning);
    return result.value;
  };

  if (parsed.section === "basics") {
    return {
      mutation: {
        ...parsed,
        basics: {
          headline: collect(
            normalizeText(parsed.basics.headline, "basics.headline", 200),
          ),
          summary: collect(
            normalizeText(
              parsed.basics.summary,
              "basics.summary",
              5_000,
              false,
              true,
            ),
          ),
          phone: collect(
            normalizeText(parsed.basics.phone, "basics.phone", 32),
          ),
          location: collect(
            normalizeText(parsed.basics.location, "basics.location", 160),
          ),
        },
      },
      warnings,
    };
  }
  if (parsed.section === "about") {
    return {
      mutation: {
        ...parsed,
        about: {
          dateOfBirth: parsed.about.dateOfBirth,
          preferredName: collect(
            normalizeText(
              parsed.about.preferredName,
              "about.preferredName",
              120,
            ),
          ),
          interests: collect(
            normalizeText(parsed.about.interests, "about.interests", 500),
          ),
          bio: collect(
            normalizeText(parsed.about.bio, "about.bio", 1_000, false, true),
          ),
        },
      },
      warnings,
    };
  }
  if (parsed.section === "skills") {
    return {
      mutation: {
        ...parsed,
        skills: parsed.skills.map((skill, index) => ({
          ...skill,
          label:
            collect(
              normalizeText(skill.label, `skills.${index}.label`, 80, true),
            ) ?? "",
        })),
      },
      warnings,
    };
  }
  if (parsed.section === "experience") {
    return {
      mutation: {
        ...parsed,
        experience: parsed.experience.map((entry, index) => ({
          ...entry,
          title:
            collect(
              normalizeText(
                entry.title,
                `experience.${index}.title`,
                200,
                true,
              ),
            ) ?? "",
          company:
            collect(
              normalizeText(
                entry.company,
                `experience.${index}.company`,
                200,
                true,
              ),
            ) ?? "",
          description: collect(
            normalizeText(
              entry.description,
              `experience.${index}.description`,
              3_000,
              false,
              true,
            ),
          ),
        })),
      },
      warnings,
    };
  }
  if (parsed.section === "education") {
    return {
      mutation: {
        ...parsed,
        education: parsed.education.map((entry, index) => ({
          ...entry,
          institution:
            collect(
              normalizeText(
                entry.institution,
                `education.${index}.institution`,
                200,
                true,
              ),
            ) ?? "",
          degree:
            collect(
              normalizeText(
                entry.degree,
                `education.${index}.degree`,
                200,
                true,
              ),
            ) ?? "",
          field: collect(
            normalizeText(entry.field, `education.${index}.field`, 200),
          ),
        })),
      },
      warnings,
    };
  }
  return {
    mutation: {
      ...parsed,
      socialLinks: parsed.socialLinks.map((entry, index) => ({
        ...entry,
        url:
          collect(
            normalizeText(entry.url, `socialLinks.${index}.url`, 2_048, true),
          ) ?? "",
      })),
    },
    warnings,
  };
}

function validateNormalizedMutation(
  mutation: ProfileSectionMutation,
  today: string,
): ProfileSectionMutation {
  if (mutation.section === "basics") {
    for (const [field, value, maximum] of [
      ["basics.headline", mutation.basics.headline, 200],
      ["basics.summary", mutation.basics.summary, 5_000],
      ["basics.location", mutation.basics.location, 160],
    ] as const) {
      if (value !== null) assertCodePointLength(field, value, maximum);
    }
    mutation.basics.phone = validateProfilePhone(mutation.basics.phone);
  } else if (mutation.section === "about") {
    if (mutation.about.dateOfBirth !== null) {
      assertIsoDate("about.dateOfBirth", mutation.about.dateOfBirth);
      if (mutation.about.dateOfBirth > today) {
        throw new ProfileValidationError("about.dateOfBirth", "FUTURE");
      }
    }
    if (mutation.about.preferredName !== null) {
      assertCodePointLength(
        "about.preferredName",
        mutation.about.preferredName,
        120,
      );
    }
    if (mutation.about.interests !== null) {
      assertCodePointLength("about.interests", mutation.about.interests, 500);
    }
    if (mutation.about.bio !== null) {
      assertCodePointLength("about.bio", mutation.about.bio, 1_000);
    }
  } else if (mutation.section === "skills") {
    assertProfileCollectionCaps({
      skills: mutation.skills,
      experience: [],
      education: [],
      socialLinks: [],
    });
    validateUniqueSkills(mutation.skills.map(({ label }) => label));
    mutation.skills = mutation.skills.map((skill) => ({
      ...skill,
      label: normalizeSkillName(skill.label).displayName,
    }));
  } else if (mutation.section === "experience") {
    assertProfileCollectionCaps({
      skills: [],
      experience: mutation.experience,
      education: [],
      socialLinks: [],
    });
    mutation.experience.forEach((entry, index) =>
      validateExperienceEntry(entry, today, index),
    );
  } else if (mutation.section === "education") {
    assertProfileCollectionCaps({
      skills: [],
      experience: [],
      education: mutation.education,
      socialLinks: [],
    });
    mutation.education.forEach((entry, index) =>
      validateEducationEntry(entry, today, index),
    );
  } else {
    assertProfileCollectionCaps({
      skills: [],
      experience: [],
      education: [],
      socialLinks: mutation.socialLinks,
    });
    const normalized = validateUniqueSocialLinks(
      mutation.socialLinks.map(({ url }) => url),
    );
    mutation.socialLinks = mutation.socialLinks.map((entry, index) => ({
      ...entry,
      url: normalizeSocialUrl(normalized[index] ?? entry.url),
    }));
  }
  return mutation;
}

export class SaveProfileSectionService {
  constructor(
    private readonly commands = new PrismaProfileCommandRepository(),
    private readonly query = new GetProfileAggregateService(),
    private readonly clock: Clock = systemClock,
  ) {}

  async execute(
    userId: string,
    input: unknown,
  ): Promise<ProfileMutationOutcome> {
    const normalized = normalizeProfileMutationText(input);
    const today = this.clock.now().toISOString().slice(0, 10);
    const mutation = validateNormalizedMutation(normalized.mutation, today);
    const result = await this.commands.saveSection(userId, mutation);
    const profile = await this.query.execute(userId);
    return profileMutationOutcomeSchema.parse({
      profile,
      conflictApplied: result.conflictApplied,
      warnings: normalized.warnings,
      message: result.conflictApplied
        ? "Saved. Another session had a newer profile revision, so this valid update replaced it."
        : "Profile section saved.",
    });
  }
}
