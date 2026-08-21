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
  education?: string | null;
  industry?: string;
  companyId?: string;
  title?: string;
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
  industry?: string;
  companyId?: string;
  title?: string;
};

const weights = {
  category: 0.35,
  skills: 0.25,
  title: 0.1,
  location: 0.15,
  salary: 0.05,
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

function industrySimilarity(
  current: JobSimilarityInput | CandidateJobProfile,
  candidate: JobSimilarityInput | CandidateJobProfile,
) {
  const currentIndustry = normalized(current.industry);
  const candidateIndustry = normalized(candidate.industry);
  if (!currentIndustry || !candidateIndustry) return 0;
  if (currentIndustry === candidateIndustry) return 1;

  const currentTokens = normalizedSet(currentIndustry.split(" "));
  const candidateTokens = normalizedSet(candidateIndustry.split(" "));
  const overlap = [...currentTokens].filter((token) =>
    candidateTokens.has(token),
  ).length;
  return overlap / Math.max(currentTokens.size, candidateTokens.size);
}

function titleSimilarity(
  current: JobSimilarityInput | CandidateJobProfile,
  candidate: JobSimilarityInput | CandidateJobProfile,
) {
  const currentTitle = normalized(current.title);
  const candidateTitle = normalized(candidate.title);
  if (!currentTitle || !candidateTitle) return 0;

  const currentTokens = normalizedSet(currentTitle.split(" "));
  const candidateTokens = normalizedSet(candidateTitle.split(" "));
  const overlap = [...currentTokens].filter((token) =>
    candidateTokens.has(token),
  ).length;
  return overlap / Math.max(currentTokens.size, candidateTokens.size);
}

function companyDiversity(
  current: JobSimilarityInput | CandidateJobProfile,
  candidate: JobSimilarityInput | CandidateJobProfile,
) {
  if (!current.companyId || !candidate.companyId) return 0.5;
  return current.companyId === candidate.companyId ? 0 : 1;
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
  if (!currentCity || !candidateCity) return 0;
  if (currentCity === candidateCity) return 1;

  // A profile often records just a province while a job post includes a
  // district and city. Compare meaningful place tokens so these two forms do
  // not look unrelated, while avoiding generic administrative words.
  const ignoredTokens = new Set([
    "city",
    "district",
    "province",
    "ward",
    "commune",
    "town",
    "thanh",
    "pho",
    "quan",
    "huyen",
    "thi",
    "xa",
    "tp",
  ]);
  const tokens = (value: string) =>
    new Set(
      value
        .split(" ")
        .filter((token) => token.length > 1 && !ignoredTokens.has(token)),
    );
  const currentTokens = tokens(currentCity);
  const candidateTokens = tokens(candidateCity);
  if (!currentTokens.size || !candidateTokens.size) return 0;
  const overlap = [...currentTokens].filter((token) =>
    candidateTokens.has(token),
  ).length;
  return overlap / Math.max(currentTokens.size, candidateTokens.size);
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

export type MatchScoreBreakdown = Readonly<{
  roleAndSkills: number;
  preferences: number;
  experience: number;
}>;

export type MatchScoreDetails = Readonly<{
  score: number;
  breakdown: MatchScoreBreakdown;
}>;

function roundedContributionPoints(
  values: Readonly<Record<keyof MatchScoreBreakdown, number>>,
  score: number,
): MatchScoreBreakdown {
  const keys = Object.keys(values) as (keyof MatchScoreBreakdown)[];
  const points = keys.map((key) => ({
    key,
    raw: values[key] * 100,
  }));
  const rounded = new Map(
    points.map((item) => [item.key, Math.floor(item.raw)]),
  );
  let remaining =
    score - [...rounded.values()].reduce((sum, value) => sum + value, 0);
  for (const item of [...points].sort(
    (left, right) =>
      right.raw - Math.floor(right.raw) - (left.raw - Math.floor(left.raw)),
  )) {
    if (remaining <= 0) break;
    rounded.set(item.key, (rounded.get(item.key) ?? 0) + 1);
    remaining -= 1;
  }
  return {
    roleAndSkills: rounded.get("roleAndSkills") ?? 0,
    preferences: rounded.get("preferences") ?? 0,
    experience: rounded.get("experience") ?? 0,
  };
}

export function computeMatchScoreDetails(
  current: JobSimilarityInput | CandidateJobProfile,
  candidate: JobSimilarityInput | CandidateJobProfile,
): MatchScoreDetails {
  const roleAndSkills =
    categorySimilarity(current, candidate) * weights.category +
    skillSimilarity(current, candidate) * weights.skills +
    titleSimilarity(current, candidate) * weights.title;
  const preferences =
    locationSimilarity(current, candidate) * weights.location +
    salarySimilarity(current, candidate) * weights.salary;
  const experience =
    experienceSimilarity(current, candidate) * weights.experience;
  const score = Math.round((roleAndSkills + preferences + experience) * 100);
  return {
    score,
    breakdown: roundedContributionPoints(
      { roleAndSkills, preferences, experience },
      score,
    ),
  };
}

export function computeMatchScore(
  current: JobSimilarityInput | CandidateJobProfile,
  candidate: JobSimilarityInput | CandidateJobProfile,
) {
  return computeMatchScoreDetails(current, candidate).score;
}

const discoveryWeights = {
  category: 0.3,
  industry: 0.25,
  salary: 0.15,
  experience: 0.1,
  title: 0.05,
  skills: 0.05,
  location: 0.05,
  companyDiversity: 0.05,
} as const;

function computeDiscoveryMatchScore(
  current: JobSimilarityInput,
  candidate: JobSimilarityInput,
) {
  const score =
    categorySimilarity(current, candidate) * discoveryWeights.category +
    industrySimilarity(current, candidate) * discoveryWeights.industry +
    salarySimilarity(current, candidate) * discoveryWeights.salary +
    experienceSimilarity(current, candidate) * discoveryWeights.experience +
    titleSimilarity(current, candidate) * discoveryWeights.title +
    skillSimilarity(current, candidate) * discoveryWeights.skills +
    locationSimilarity(current, candidate) * discoveryWeights.location +
    companyDiversity(current, candidate) * discoveryWeights.companyDiversity;
  return Math.round(score * 100);
}

export function computeDiscoveryJobs<T extends JobSimilarityInput>(
  current: JobSimilarityInput,
  candidates: readonly T[],
  excludedIds: ReadonlySet<string> = new Set<string>(),
  limit = 5,
) {
  return candidates
    .filter(
      (candidate) =>
        candidate.id !== current.id &&
        !excludedIds.has(candidate.id) &&
        (!candidate.status || candidate.status.toLowerCase() === "open"),
    )
    .map((candidate, index) => ({
      candidate,
      matchScore: computeDiscoveryMatchScore(current, candidate),
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
