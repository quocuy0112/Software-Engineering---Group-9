export type JobSimilarityInput = {
  id: string;
  status?: "open" | "closed" | "expired" | string;
  categoryIds?: string[];
  categoryFamily?: string;
  skillTags?: string[];
  city?: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  experienceMinYears?: number | null;
  postedAt?: string;
};

export type CandidateJobProfile = {
  categoryIds?: string[];
  categoryFamily?: string;
  skillTags?: string[];
  city?: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  experienceMinYears?: number | null;
};

const weights = {
  category: 0.4,
  skills: 0.25,
  location: 0.15,
  salary: 0.1,
  experience: 0.1,
} as const;

function normalized(value: string | undefined | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function normalizedSet(values: string[] | undefined) {
  return new Set((values ?? []).map(normalized).filter(Boolean));
}

function categorySimilarity(
  current: JobSimilarityInput | CandidateJobProfile,
  candidate: JobSimilarityInput | CandidateJobProfile,
) {
  const currentCategories = normalizedSet(current.categoryIds);
  const candidateCategories = normalizedSet(candidate.categoryIds);
  const hasSharedCategory = [...currentCategories].some((value) =>
    candidateCategories.has(value),
  );
  if (hasSharedCategory) return 1;
  if (
    normalized(current.categoryFamily) &&
    normalized(current.categoryFamily) === normalized(candidate.categoryFamily)
  )
    return 0.75;
  return 0;
}

function skillSimilarity(
  current: JobSimilarityInput | CandidateJobProfile,
  candidate: JobSimilarityInput | CandidateJobProfile,
) {
  const currentSkills = normalizedSet(current.skillTags);
  const candidateSkills = normalizedSet(candidate.skillTags);
  if (!currentSkills.size || !candidateSkills.size) return 0;
  const overlap = [...currentSkills].filter((skill) =>
    candidateSkills.has(skill),
  ).length;
  return overlap / Math.max(currentSkills.size, candidateSkills.size);
}

function locationSimilarity(
  current: JobSimilarityInput | CandidateJobProfile,
  candidate: JobSimilarityInput | CandidateJobProfile,
) {
  const currentCity = normalized(current.city);
  const candidateCity = normalized(candidate.city);
  return currentCity && currentCity === candidateCity ? 1 : 0;
}

function midpoint(
  min: number | null | undefined,
  max: number | null | undefined,
) {
  if (typeof min !== "number" || typeof max !== "number") return null;
  return (min + max) / 2;
}

function salarySimilarity(
  current: JobSimilarityInput | CandidateJobProfile,
  candidate: JobSimilarityInput | CandidateJobProfile,
) {
  const currentMidpoint = midpoint(current.salaryMin, current.salaryMax);
  const candidateMidpoint = midpoint(candidate.salaryMin, candidate.salaryMax);
  if (!currentMidpoint || !candidateMidpoint) return 0;
  const difference =
    Math.abs(currentMidpoint - candidateMidpoint) /
    Math.max(currentMidpoint, candidateMidpoint);
  return difference <= 0.3 ? 1 - difference / 0.3 : 0;
}

function experienceSimilarity(
  current: JobSimilarityInput | CandidateJobProfile,
  candidate: JobSimilarityInput | CandidateJobProfile,
) {
  if (
    typeof current.experienceMinYears !== "number" ||
    typeof candidate.experienceMinYears !== "number"
  )
    return 0;
  const difference = Math.abs(
    current.experienceMinYears - candidate.experienceMinYears,
  );
  return difference <= 2 ? 1 - difference / 2 : 0;
}

export function computeMatchScore(
  current: JobSimilarityInput | CandidateJobProfile,
  candidate: JobSimilarityInput | CandidateJobProfile,
) {
  const score =
    categorySimilarity(current, candidate) * weights.category +
    skillSimilarity(current, candidate) * weights.skills +
    locationSimilarity(current, candidate) * weights.location +
    salarySimilarity(current, candidate) * weights.salary +
    experienceSimilarity(current, candidate) * weights.experience;
  return Math.round(score * 100);
}

export function computeRelatedJobs<T extends JobSimilarityInput>(
  current: JobSimilarityInput,
  candidates: readonly T[],
  limit = 6,
) {
  return candidates
    .filter(
      (candidate) =>
        candidate.id !== current.id &&
        (!candidate.status || candidate.status.toLowerCase() === "open"),
    )
    .map((candidate, index) => ({
      candidate,
      matchScore: computeMatchScore(current, candidate),
      index,
    }))
    .sort((left, right) => {
      if (right.matchScore !== left.matchScore)
        return right.matchScore - left.matchScore;
      const rightDate = right.candidate.postedAt ?? "";
      const leftDate = left.candidate.postedAt ?? "";
      return rightDate.localeCompare(leftDate) || left.index - right.index;
    })
    .slice(0, Math.max(0, limit))
    .map(({ candidate, matchScore }) => ({ ...candidate, matchScore }));
}
