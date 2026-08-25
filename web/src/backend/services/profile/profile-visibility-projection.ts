import "server-only";
import type { CandidateProfileContract } from "@/shared/contracts/account/profile";
import {
  discoverableProfileSchema,
  type DiscoverableProfile,
} from "@/shared/contracts/profile-discovery";

export type ProfileVisibilityAudience = "candidate" | "recruiter";

/**
 * Builds a deliberately small, audience-specific profile projection.  This is
 * an allowlist: adding fields to CandidateProfile cannot make them visible
 * until they are explicitly added here and to the shared contract.
 */
export function projectVisibleProfile(input: {
  userId: string;
  displayName: string;
  image: string | null;
  profile: CandidateProfileContract;
  audience: ProfileVisibilityAudience;
}): DiscoverableProfile {
  const visibility = input.profile.visibility;
  const selected = new Set(
    visibility?.[
      input.audience === "candidate" ? "candidateSections" : "recruiterSections"
    ] ?? [],
  );
  const sections: DiscoverableProfile["sections"] = {};

  if (selected.has("headline")) sections.headline = input.profile.basics.headline;
  if (selected.has("summary")) sections.summary = input.profile.basics.summary;
  if (selected.has("location")) sections.location = input.profile.basics.location;
  if (selected.has("skills")) {
    sections.skills = input.profile.skills.map((skill) => skill.label);
  }
  if (selected.has("experience")) {
    sections.experience = input.profile.experience.map((entry) => ({
      title: entry.title,
      company: entry.company,
    }));
  }
  if (selected.has("education")) {
    sections.education = input.profile.education.map((entry) => ({
      institution: entry.institution,
      degree: entry.degree,
    }));
  }
  if (selected.has("links")) {
    sections.links = input.profile.socialLinks.map((entry) => entry.url);
  }

  return discoverableProfileSchema.parse({
    userId: input.userId,
    displayName: input.displayName,
    image: selected.has("avatar") ? input.image : null,
    sections,
  });
}
