import type { CandidateProfileContract } from "@/shared/contracts/account/profile";

export type ProfileCompletionSection =
  | "avatar"
  | "basics"
  | "skills"
  | "experience"
  | "education"
  | "socialLinks";

export type ProfileCompletionItem = {
  key: ProfileCompletionSection;
  targetId: string;
  complete: boolean;
};

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function hasProfessionalLink(value: string) {
  try {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

/**
 * The dashboard and profile use this exact model. The weights preserve the
 * existing dashboard behaviour: basic details 25, photo 15, skills 20,
 * experience 20, education 10, and professional links 10.
 */
export function getProfileCompletion(
  profile: CandidateProfileContract,
  avatar: string | boolean | null | undefined,
) {
  const headlineLength = profile.basics.headline?.trim().length ?? 0;
  const summaryLength = profile.basics.summary?.trim().length ?? 0;
  const detailedExperience = profile.experience.some(
    (entry) => (entry.description?.trim().length ?? 0) >= 80,
  );
  const items: ProfileCompletionItem[] = [
    {
      key: "avatar",
      targetId: "profile-avatar-section",
      complete: Boolean(avatar),
    },
    {
      key: "basics",
      targetId: "profile-basics-section",
      complete: headlineLength >= 20 && summaryLength >= 120,
    },
    {
      key: "skills",
      targetId: "profile-skills-section",
      complete: profile.skills.some((skill) => hasText(skill.label)),
    },
    {
      key: "experience",
      targetId: "profile-experience-section",
      complete: profile.experience.some(
        (entry) => hasText(entry.title) && hasText(entry.company),
      ),
    },
    {
      key: "education",
      targetId: "profile-education-section",
      complete: profile.education.some(
        (entry) => hasText(entry.institution) && hasText(entry.degree),
      ),
    },
    {
      key: "socialLinks",
      targetId: "profile-social-section",
      complete: profile.socialLinks.some((link) =>
        hasProfessionalLink(link.url),
      ),
    },
  ];

  const completed = items.filter((item) => item.complete).length;
  const percentage = Math.round(
    (headlineLength >= 20 ? 10 : headlineLength > 0 ? 5 : 0) +
      (summaryLength >= 120 ? 15 : summaryLength > 0 ? 7 : 0) +
      (avatar ? 15 : 0) +
      Math.min(profile.skills.length / 3, 1) * 20 +
      (items.find((item) => item.key === "experience")?.complete ? 15 : 0) +
      (detailedExperience ? 5 : 0) +
      (items.find((item) => item.key === "education")?.complete ? 10 : 0) +
      (items.find((item) => item.key === "socialLinks")?.complete ? 10 : 0),
  );

  return { items, completed, percentage };
}

export function computeProfileCompleteness(
  profile: CandidateProfileContract,
  avatar: string | boolean | null | undefined,
) {
  return getProfileCompletion(profile, avatar).percentage;
}
