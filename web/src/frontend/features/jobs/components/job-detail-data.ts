import type { JobCard, JobDetail } from "@/shared/contracts/jobs/discovery";

type Benefit = {
  icon: string;
  label: string;
};

type StructuredDescription = {
  overview?: string;
  topReasonsToJoin?: string[];
  responsibilities?: string[];
  requirements?: string[];
  niceToHaveRequirements?: string[];
  benefits?: Benefit[];
};

type JobSignals = {
  categoryIds?: string[];
  categoryFamily?: string;
  skillTags?: string[];
  topReasons?: string[];
  niceToHaveRequirements?: string[];
  description?: string | StructuredDescription;
};

type JobLike = JobCard | JobDetail;

function signals(job: JobLike) {
  return job as JobLike & JobSignals;
}

function structuredDescription(job: JobLike): StructuredDescription | null {
  const value = signals(job).description;
  return value && typeof value === "object" ? value : null;
}

function unique(items: string[]) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

export function splitLines(value: string | null | undefined) {
  return unique(
    (value ?? "")
      .split(/\r?\n+/u)
      .map((item) => item.replace(/^[•*-]\s*/u, "").trim()),
  );
}

function humanize(value: string) {
  return value
    .replace(/[-_]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/\b\w/gu, (character) => character.toUpperCase());
}

export function jobSkills(job: JobLike) {
  const value = signals(job).skillTags;
  return unique(value?.length ? value : job.skills);
}

export function jobCategories(job: JobLike) {
  const value = signals(job);
  const categories = value.categoryIds?.length
    ? value.categoryIds
    : value.categoryFamily
      ? [value.categoryFamily]
      : job.company.industry
        ? [job.company.industry]
        : ["Role domain"];

  return unique(categories.map(humanize));
}

export function jobOverview(job: JobDetail) {
  const value = structuredDescription(job);
  return (
    value?.overview ??
    (typeof job.description === "string" ? job.description : "")
  );
}

export function jobResponsibilities(job: JobDetail) {
  const value = structuredDescription(job);
  return value?.responsibilities?.length
    ? value.responsibilities
    : splitLines(job.responsibilities);
}

export function jobRequirements(job: JobDetail) {
  const value = structuredDescription(job);
  return value?.requirements?.length
    ? value.requirements
    : splitLines(job.requirements);
}

export function jobNiceToHaveRequirements(job: JobDetail) {
  const value = signals(job);
  const structured = structuredDescription(job);
  const explicit =
    value.niceToHaveRequirements ?? structured?.niceToHaveRequirements;
  if (explicit?.length) return unique(explicit);

  return jobRequirements(job).filter((item) =>
    /\b(nice to have|preferred|bonus|plus)\b/iu.test(item),
  );
}

export function jobMustHaveRequirements(job: JobDetail) {
  const niceToHave = new Set(jobNiceToHaveRequirements(job));
  const requirements = jobRequirements(job).filter(
    (item) => !niceToHave.has(item),
  );
  return requirements.length ? requirements : jobRequirements(job);
}

export function jobBenefits(job: JobDetail): Benefit[] {
  const structured = structuredDescription(job);
  const benefitItems = "benefitItems" in job ? job.benefitItems : undefined;
  if (structured?.benefits?.length) return structured.benefits;
  if (benefitItems?.length) return benefitItems;

  return splitLines(job.benefits).map((label) => ({
    icon: "spark",
    label,
  }));
}

export function jobWhyHighlights(job: JobDetail | JobCard) {
  const value = signals(job);
  const structured = structuredDescription(job);
  const explicit = value.topReasons ?? structured?.topReasonsToJoin;
  if (explicit?.length) return unique(explicit).slice(0, 3);

  const benefits =
    "benefits" in job && job.benefits ? splitLines(job.benefits) : [];
  const benefitItems =
    "benefitItems" in job && job.benefitItems
      ? job.benefitItems.map((item) => item.label)
      : [];
  const highlights = unique([
    ...benefitItems,
    ...benefits,
    ...("benefitHighlights" in job ? (job.benefitHighlights ?? []) : []),
  ]);

  return highlights.slice(0, 3).length
    ? highlights.slice(0, 3)
    : [
        "Competitive compensation and clear role expectations",
        "Structured learning and growth opportunities",
        "A collaborative team culture built for momentum",
      ];
}

export function formatCategory(value: string) {
  return humanize(value);
}
