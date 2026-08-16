import "server-only";
import { normalizeJobReviewSnapshot } from "./job-post-review-policy";

const employmentTypes = {
  full_time: "FULL_TIME",
  part_time: "PART_TIME",
  contract: "CONTRACT",
  internship: "INTERNSHIP",
  temporary: "TEMPORARY",
} as const;
const experienceLevels = {
  intern: "ENTRY",
  staff: "MID",
  entry: "ENTRY",
  junior: "JUNIOR",
  mid: "MID",
  senior: "SENIOR",
  team_lead: "LEAD",
  lead: "LEAD",
  manager: "MANAGER",
  executive: "MANAGER",
  director: "MANAGER",
} as const;
const workArrangements = {
  onsite: "ONSITE",
  hybrid: "HYBRID",
  remote: "REMOTE",
} as const;
const salaryPeriods = {
  hour: "HOUR",
  month: "MONTH",
  year: "YEAR",
} as const;

function mapped<T extends string>(
  mapping: Record<string, T>,
  value: string,
): T {
  const result = mapping[value.trim().toLowerCase()];
  if (!result) throw new Error("UNPUBLISHABLE_JOB_MAPPING");
  return result;
}

function normalizedSearch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase();
}

export function projectJobReviewSnapshot(value: unknown) {
  const snapshot = normalizeJobReviewSnapshot(value);
  const skills = Array.from(
    new Map(
      snapshot.skillTags.map((displayName, position) => {
        const normalizedName = normalizedSearch(displayName.trim());
        return [normalizedName, { displayName, normalizedName, position }];
      }),
    ).values(),
  );
  const location = snapshot.location.isNationwideRemote
    ? `Remote · ${snapshot.location.city}`
    : [snapshot.location.district, snapshot.location.city]
        .filter(Boolean)
        .join(", ");
  const searchDocumentNormalized = normalizedSearch(
    [
      snapshot.title,
      snapshot.shortPitch,
      location,
      snapshot.industry,
      snapshot.subIndustry,
      ...snapshot.skillTags,
    ].join(" "),
  );
  return {
    companyId: snapshot.companyId,
    slug: snapshot.slug,
    title: snapshot.title,
    normalizedTitle: normalizedSearch(snapshot.title),
    summary: snapshot.shortPitch,
    description: snapshot.description.overview,
    responsibilities: snapshot.description.responsibilities.join("\n"),
    requirements: snapshot.description.requirements.join("\n"),
    benefits:
      snapshot.description.benefits.map((item) => item.label).join("\n") ||
      null,
    education: snapshot.education || null,
    numberOfHires: snapshot.numberOfHires,
    age: snapshot.age || null,
    location,
    normalizedLocation: normalizedSearch(location),
    employmentType: mapped(employmentTypes, snapshot.employmentType),
    experienceLevel: mapped(experienceLevels, snapshot.level),
    workArrangement: mapped(workArrangements, snapshot.workArrangement),
    salaryMin: snapshot.salary.min,
    salaryMax: snapshot.salary.max,
    salaryCurrency: snapshot.salary.currency,
    salaryPeriod: mapped(salaryPeriods, snapshot.salary.period),
    applicationDeadline: snapshot.applyDeadline
      ? new Date(snapshot.applyDeadline)
      : null,
    searchDocumentNormalized,
    skills,
  };
}
