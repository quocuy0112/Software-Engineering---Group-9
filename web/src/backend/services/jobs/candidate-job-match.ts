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
  return Math.max(0, (Math.max(...ends) - Math.min(...starts)) / yearMilliseconds);
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
  matchingSkills: readonly string[];
  improvementAreas: readonly string[];
};

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
      return {
        candidate,
        matchScore: computeMatchScore(signals, candidate),
        matchingSkills: skills.filter((skill) =>
          profileSkills.has(normalized(skill)),
        ),
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
    .map(({ candidate, matchScore, matchingSkills, improvementAreas }) => ({
      candidate,
      matchScore,
      matchingSkills,
      improvementAreas,
    }));
}
