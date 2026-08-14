import "server-only";

import type { CandidateProfileContract } from "@/shared/contracts/account/profile";
import {
  computeMatchScore,
  type CandidateJobProfile,
  type JobSimilarityInput,
} from "@/shared/utils/jobs/similarity";

const yearMilliseconds = 365.25 * 24 * 60 * 60 * 1000;

function experienceYears(profile: CandidateProfileContract, now: Date) {
  const starts = profile.experience
    .map((item) => Date.parse(item.startDate))
    .filter(Number.isFinite);
  if (!starts.length) return null;
  const ends = profile.experience
    .map((item) =>
      item.current || !item.endDate ? now.getTime() : Date.parse(item.endDate),
    )
    .filter(Number.isFinite);
  return Math.max(
    0,
    (Math.max(...ends) - Math.min(...starts)) / yearMilliseconds,
  );
}

export function hasCandidateJobSignals(profile: CandidateProfileContract) {
  return (
    !profile.empty &&
    (profile.skills.length > 0 ||
      profile.experience.length > 0 ||
      Boolean(profile.basics.location?.trim()))
  );
}

export function candidateProfileSignals(
  profile: CandidateProfileContract,
  now = new Date(),
): CandidateJobProfile {
  return {
    skillTags: profile.skills.map((skill) => skill.label),
    city: profile.basics.location ?? undefined,
    experienceMinYears: experienceYears(profile, now),
  };
}

export type CandidateJobMatch<T extends JobSimilarityInput> = {
  candidate: T;
  matchScore: number;
  matchBreakdown?: Readonly<{
    skills: number;
    experience: number;
    education: number;
  }>;
  matchingSkills: readonly string[];
  improvementAreas: readonly string[];
};

function normalizeBreakdown(values: readonly number[]) {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!total) return undefined;
  const skills = Math.round((values[0] / total) * 100);
  const experience = Math.round((values[1] / total) * 100);
  return {
    skills,
    experience,
    education: Math.max(0, 100 - skills - experience),
  };
}

function profileSignalBreakdown<T extends JobSimilarityInput>(
  profile: CandidateProfileContract,
  signals: CandidateJobProfile,
  candidate: T,
  matchingSkills: readonly string[],
) {
  const requiredSkills = candidate.skillTags?.length ?? 0;
  const skills = requiredSkills ? matchingSkills.length / requiredSkills : 0;
  const requiredExperience = candidate.experienceMinYears;
  const candidateExperience = signals.experienceMinYears;
  const experience =
    candidateExperience === null || candidateExperience === undefined
      ? 0
      : requiredExperience === null || requiredExperience === undefined
        ? 0.5
        : Math.min(1, candidateExperience / Math.max(1, requiredExperience));
  const education = candidate.education?.trim()
    ? profile.education.length
      ? 1
      : 0
    : 0;
  return normalizeBreakdown([skills, experience, education]);
}

const normalized = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .trim()
    .toLowerCase();

export function rankJobsForCandidate<T extends JobSimilarityInput>(
  profile: CandidateProfileContract,
  candidates: readonly T[],
  now = new Date(),
  limit = candidates.length,
): CandidateJobMatch<T>[] {
  if (!hasCandidateJobSignals(profile)) return [];
  const signals = candidateProfileSignals(profile, now);
  const profileSkills = new Set((signals.skillTags ?? []).map(normalized));
  return candidates
    .filter(
      (candidate) =>
        !candidate.status || candidate.status.toLowerCase() === "open",
    )
    .map((candidate, index) => {
      const skills = candidate.skillTags ?? [];
      const matchingSkills = skills.filter((skill) =>
        profileSkills.has(normalized(skill)),
      );
      return {
        candidate,
        matchScore: computeMatchScore(signals, candidate),
        matchBreakdown: profileSignalBreakdown(
          profile,
          signals,
          candidate,
          matchingSkills,
        ),
        matchingSkills,
        improvementAreas: skills
          .filter((skill) => !profileSkills.has(normalized(skill)))
          .slice(0, 3),
        index,
      };
    })
    .sort((left, right) => {
      if (right.matchScore !== left.matchScore)
        return right.matchScore - left.matchScore;
      const dateOrder = (right.candidate.postedAt ?? "").localeCompare(
        left.candidate.postedAt ?? "",
      );
      return dateOrder || left.index - right.index;
    })
    .slice(0, Math.max(0, limit))
    .map(
      ({
        candidate,
        matchScore,
        matchBreakdown,
        matchingSkills,
        improvementAreas,
      }) => ({
        candidate,
        matchScore,
        ...(matchBreakdown ? { matchBreakdown } : {}),
        matchingSkills,
        improvementAreas,
      }),
    );
}
