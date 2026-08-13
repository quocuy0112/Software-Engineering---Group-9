import {
  employmentTypeSchema,
  experienceLevelSchema,
  jobSearchQuerySchema,
  workArrangementSchema,
} from "@/shared/contracts/jobs/discovery";

export const homeWorkArrangements = workArrangementSchema.options;
export const homeEmploymentTypes = employmentTypeSchema.options;
export const homeExperienceLevels = experienceLevelSchema.options;

export type HomeSearchDraft = {
  keyword: string;
  location: string;
  workArrangement: string;
  employmentType: string;
  experienceLevel: string;
  skills: string;
};

export const emptyHomeSearchDraft: HomeSearchDraft = {
  keyword: "",
  location: "",
  workArrangement: "",
  employmentType: "",
  experienceLevel: "",
  skills: "",
};

const unique = (values: readonly string[]) => [...new Set(values)];

export function buildHomeJobSearch(draft: HomeSearchDraft) {
  const skills = unique(
    draft.skills
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const parsed = jobSearchQuerySchema.parse({
    q: draft.keyword.trim(),
    location: draft.location.trim(),
    workArrangement: draft.workArrangement ? [draft.workArrangement] : [],
    employmentType: draft.employmentType ? [draft.employmentType] : [],
    experienceLevel: draft.experienceLevel ? [draft.experienceLevel] : [],
    skills,
  });
  const params = new URLSearchParams();
  if (parsed.q) params.set("q", parsed.q);
  if (parsed.location) params.set("location", parsed.location);
  for (const value of parsed.workArrangement)
    params.append("workArrangement", value);
  for (const value of parsed.employmentType)
    params.append("employmentType", value);
  for (const value of parsed.experienceLevel)
    params.append("experienceLevel", value);
  for (const value of parsed.skills) params.append("skills", value);
  return params;
}
