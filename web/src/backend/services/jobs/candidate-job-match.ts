import "server-only";

import type { CandidateProfileContract } from "@/shared/contracts/account/profile";
import {
  computeMatchScoreDetails,
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
      Boolean(profile.basics.headline?.trim()) ||
      Boolean(profile.basics.location?.trim()))
  );
}

export function candidateProfileSignals(
  profile: CandidateProfileContract,
  now = new Date(),
): CandidateJobProfile {
  const currentRole = profile.experience.find((item) => item.current)?.title;
  const latestRole = profile.experience.at(-1)?.title;
  return {
    skillTags: profile.skills.map((skill) => skill.label),
    city: profile.basics.location ?? undefined,
    experienceMinYears: experienceYears(profile, now),
    title: profile.basics.headline?.trim() || currentRole || latestRole,
  };
}

export type CandidateJobMatch<T extends JobSimilarityInput> = {
  candidate: T;
  matchScore: number;
  matchBreakdown?: Readonly<{
    roleAndSkills: number;
    preferences: number;
    experience: number;
    unmatched: number;
  }>;
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
      const matchingSkills = skills.filter((skill) =>
        profileSkills.has(normalized(skill)),
      );
      const details = computeMatchScoreDetails(signals, candidate);
      return {
        candidate,
        matchScore: details.score,
        matchBreakdown: {
          ...details.breakdown,
          unmatched: 100 - details.score,
        },
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
