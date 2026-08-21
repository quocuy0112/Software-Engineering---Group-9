import "server-only";

import { z } from "zod";
import type { JobCard } from "@/shared/contracts/jobs/discovery";
import type { JobPreferences } from "@/shared/contracts/jobs/preferences";
import type {
  JobPositionOption,
  SuggestedWorkspaceJob,
} from "@/shared/contracts/jobs/workspace";
import type { UserJobState } from "@/shared/contracts/jobs/catalog";
import { normalizeSalaryAmount } from "@/shared/utils/jobs/job-display";
import { PrismaApplicationTrackingRepository } from "@/backend/repositories/jobs/prisma-application-tracking-repository";
import { configuredJsonJobCatalogueRepository } from "@/backend/repositories/jobs/job-catalogue-repository-factory";
import { readUserJobState } from "./user-job-state-store";
import { readMockAppliedJobIds } from "./recruiter-job-posting-data";
import { prisma } from "@/backend/database/prisma";
import { jobReviewSnapshotSchema } from "@/shared/contracts/recruiter-job-posting";
import { MAX_APPLICATION_ATTEMPTS_MESSAGE } from "@/shared/contracts/jobs/actions";

const workspaceJobsRepository =
  configuredJsonJobCatalogueRepository("jobs.json");
const workspaceCompaniesRepository =
  configuredJsonJobCatalogueRepository("companies.json");

const sourceCompanySchema = z
  .object({
    id: z.string().min(1),
    slug: z.string().min(1),
    name: z.string().min(1),
    logo: z.string().nullable(),
    size: z.string().min(1),
    industry: z.string().min(1),
    address: z.string().min(1),
    website: z.string().nullable(),
    description: z.string().nullable(),
    rating: z
      .object({
        score: z.number().nonnegative(),
        reviewCount: z.number().int().nonnegative(),
      })
      .optional(),
    jobCount: z.number().int().nonnegative().optional(),
  })
  .passthrough();

const sourceJobSchema = z
  .object({
    id: z.string().min(1),
    slug: z.string().min(1),
    companyId: z.string().min(1),
    title: z.string().min(1),
    shortPitch: z.string().min(1),
    industry: z.string().min(1),
    subIndustry: z.string().min(1),
    categoryIds: z.array(z.string().min(1)),
    categoryFamily: z.string().min(1),
    skillTags: z.array(z.string().min(1)),
    location: z.object({
      city: z.string().min(1),
      district: z.string().nullable(),
      isNationwideRemote: z.boolean(),
    }),
    salary: z.object({
      min: z.number().nonnegative(),
      max: z.number().nonnegative(),
      currency: z.string().regex(/^[A-Z]{3}$/u),
      period: z.enum(["hour", "month", "year"]),
      isNegotiable: z.boolean(),
    }),
    education: z.string().optional(),
    numberOfHires: z.number().int().positive().optional(),
    age: z.string().optional(),
    experience: z.object({
      minYears: z.number().int().nonnegative(),
      label: z.string().min(1),
    }),
    level: z.string().min(1),
    employmentType: z.string().min(1),
    workArrangement: z.string().min(1),
    workOnSaturday: z.boolean(),
    status: z.enum([
      "draft",
      "pending_approval",
      "rejected",
      "active",
      "closed",
      "open",
      "closing_soon",
      "filled",
      "expired",
    ]),
    isUrgent: z.boolean(),
    isVerified: z.boolean(),
    postedAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    applyDeadline: z.string().datetime().nullable(),
    description: z.object({
      responsibilities: z.array(z.string()),
      requirements: z.array(z.string()),
      benefits: z.array(z.object({ icon: z.string(), label: z.string() })),
    }),
  })
  .passthrough();

type SourceCompany = z.infer<typeof sourceCompanySchema>;
type SourceJob = z.infer<typeof sourceJobSchema>;

type JobCatalog = {
  jobs: SourceJob[];
  companies: Map<string, SourceCompany>;
};

let catalogPromise: Promise<JobCatalog> | undefined;

async function readCatalog(): Promise<JobCatalog> {
  catalogPromise ??= Promise.all([
    workspaceJobsRepository.read(),
    workspaceCompaniesRepository.read(),
  ]).then(async ([jobValues, companyValues]) => {
    const jobs = z.array(sourceJobSchema).parse(jobValues) as SourceJob[];
    const companies = z
      .array(sourceCompanySchema)
      .parse(companyValues) as SourceCompany[];
    const normalizedJobs = jobs.map((job) => ({
      ...job,
      status:
        job.status === "open" || job.status === "closing_soon"
          ? "active"
          : job.status === "filled" || job.status === "expired"
            ? "closed"
            : job.status,
    }));
    const aggregates = await prisma.jobPostReviewAggregate.findMany({
      where: { jobId: { in: normalizedJobs.map((job) => job.id) } },
      include: {
        approvedVersion: { select: { snapshot: true } },
        publicJobPosting: {
          select: {
            status: true,
            publishedAt: true,
            updatedAt: true,
            applicationDeadline: true,
            _count: { select: { applications: true } },
          },
        },
        company: {
          select: {
            verificationState: true,
            verifiedAt: true,
            verificationInactiveAt: true,
          },
        },
      },
    });
    const managedByJobId = new Map(
      aggregates.map((aggregate) => [aggregate.jobId, aggregate]),
    );
    const observedAt = new Date();
    const selectedJobs = normalizedJobs.flatMap((job) => {
      const managed = managedByJobId.get(job.id);
      if (!managed) return [job];
      const snapshot = jobReviewSnapshotSchema.safeParse(
        managed.approvedVersion?.snapshot,
      );
      const projection = managed.publicJobPosting;
      const active =
        snapshot.success &&
        projection?.status === "ACTIVE" &&
        projection.publishedAt !== null &&
        managed.closedAt === null &&
        managed.company.verificationState === "ACTIVE" &&
        managed.company.verifiedAt !== null &&
        managed.company.verificationInactiveAt === null &&
        (!projection.applicationDeadline ||
          projection.applicationDeadline > observedAt);
      if (!active || !snapshot.success || !projection?.publishedAt) return [];
      const projected = sourceJobSchema.safeParse({
        ...snapshot.data,
        status: "active",
        approvalComment: null,
        isVerified: true,
        postedAt: projection.publishedAt.toISOString(),
        updatedAt: projection.updatedAt.toISOString(),
        stats: {
          viewCount: 0,
          applicantCount: projection._count.applications,
        },
      });
      return projected.success ? [projected.data] : [];
    });
    return {
      jobs: selectedJobs,
      companies: new Map(companies.map((company) => [company.id, company])),
    };
  });
  return catalogPromise;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[đĐ]/gu, "d")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

function locationLabel(job: SourceJob) {
  if (job.location.isNationwideRemote) return "Remote · " + job.location.city;
  return [job.location.district, job.location.city].filter(Boolean).join(", ");
}

function isOpenForApplications(job: SourceJob, now: Date) {
  return (
    job.status === "active" &&
    (!job.applyDeadline || new Date(job.applyDeadline) > now)
  );
}

function experienceLevel(job: SourceJob): JobCard["experienceLevel"] {
  if (job.level === "manager" || job.level === "director") return "MANAGER";
  if (job.level === "team_lead") return "LEAD";
  if (job.experience.minYears >= 5 || job.level === "senior") return "SENIOR";
  if (job.experience.minYears >= 3) return "MID";
  if (job.experience.minYears >= 1 || job.level === "staff") return "JUNIOR";
  return "ENTRY";
}

function employmentType(job: SourceJob): JobCard["employmentType"] {
  return job.employmentType.toUpperCase() as JobCard["employmentType"];
}

function workArrangement(job: SourceJob): JobCard["workArrangement"] {
  return job.workArrangement.toUpperCase() as JobCard["workArrangement"];
}

function projectedCompany(company: SourceCompany | undefined) {
  return {
    slug: company?.slug ?? "smarthire-employer",
    displayName: company?.name ?? "SmartHire employer",
    logoUrl: company?.logo ?? null,
    websiteUrl: company?.website ?? null,
    publicDescription: company?.description ?? null,
    publicLocation: company?.address ?? null,
    size: company?.size,
    industry: company?.industry,
    address: company?.address,
  };
}

export function projectWorkspaceJob(
  job: SourceJob,
  company: SourceCompany | undefined,
  state: UserJobState,
  now = new Date(),
  matchScore?: number,
  appliedJobIds: ReadonlySet<string> = new Set(),
  applicationLimitJobIds: ReadonlySet<string> = new Set(),
): JobCard {
  const applied = appliedJobIds.has(job.id);
  const applicationLimitReached = applicationLimitJobIds.has(job.id);
  const card: JobCard = {
    id: job.id,
    slug: job.slug,
    title: job.title,
    company: projectedCompany(company),
    location: locationLabel(job),
    employmentType: employmentType(job),
    experienceLevel: experienceLevel(job),
    workArrangement: workArrangement(job),
    salary: {
      minimum: normalizeSalaryAmount(job.salary.min),
      maximum: normalizeSalaryAmount(job.salary.max),
      currency: job.salary.currency,
      period: job.salary.period.toUpperCase() as NonNullable<
        JobCard["salary"]
      >["period"],
      isNegotiable: job.salary.isNegotiable,
    },
    summary: job.shortPitch,
    education: job.education,
    numberOfHires: job.numberOfHires,
    age: job.age,
    skills: job.skillTags,
    requirementHighlights: job.description.requirements.slice(0, 4),
    benefitHighlights: job.description.benefits
      .map((benefit) => benefit.label)
      .slice(0, 4),
    benefitItems: job.description.benefits,
    publishedAt: job.postedAt,
    updatedAt: job.updatedAt,
    applicationDeadline: job.applyDeadline,
    isUrgent: job.isUrgent,
    workOnSaturday: job.workOnSaturday,
    isVerified: job.isVerified,
    categoryIds: job.categoryIds,
    categoryFamily: job.categoryFamily,
    experienceMinYears: job.experience.minYears,
    actions: {
      authenticated: true,
      saved: state.savedJobIds.includes(job.id),
      applied,
      canSave: true,
      canReport: true,
      canApply:
        isOpenForApplications(job, now) && !applied && !applicationLimitReached,
      applicationLimitReached,
      applicationLimitMessage: applicationLimitReached
        ? MAX_APPLICATION_ATTEMPTS_MESSAGE
        : undefined,
    },
  };
  if (matchScore === undefined) return card;
  return { ...card, matchScore };
}

export type JobWorkspaceSnapshot = {
  state: UserJobState;
  jobs: SourceJob[];
  companies: Map<string, SourceCompany>;
  savedJobs: JobCard[];
  appliedJobIds: string[];
  applicationLimitJobIds: string[];
  positionOptions: JobPositionOption[];
  skillOptions: string[];
};

function taxonomy(jobs: SourceJob[]) {
  const positions = new Map<string, JobPositionOption>();
  const skills = new Set<string>();
  for (const job of jobs) {
    for (const id of job.categoryIds) {
      positions.set(
        id,
        positions.get(id) ?? {
          id,
          label: job.subIndustry,
          family: job.categoryFamily,
        },
      );
    }
    job.skillTags.forEach((skill) => skills.add(skill));
  }
  return {
    positionOptions: [...positions.values()].sort((a, b) =>
      a.label.localeCompare(b.label),
    ),
    skillOptions: [...skills].sort((a, b) => a.localeCompare(b)),
  };
}

export async function readJobWorkspaceSnapshot(
  candidateUserId: string,
  now = new Date(),
): Promise<JobWorkspaceSnapshot> {
  const [
    catalog,
    state,
    prismaAppliedJobIds,
    prismaApplicationLimitJobIds,
    mockAppliedJobIds,
  ] = await Promise.all([
    readCatalog(),
    readUserJobState(candidateUserId),
    new PrismaApplicationTrackingRepository().listAppliedJobIds(
      candidateUserId,
    ),
    new PrismaApplicationTrackingRepository().listApplicationLimitJobIds(
      candidateUserId,
    ),
    readMockAppliedJobIds(candidateUserId),
  ]);
  const appliedJobIds = [
    ...new Set([...prismaAppliedJobIds, ...mockAppliedJobIds]),
  ];
  const appliedIds = new Set(appliedJobIds);
  const applicationLimitJobIds = [...new Set(prismaApplicationLimitJobIds)];
  const applicationLimitIds = new Set(applicationLimitJobIds);
  const cardById = new Map(
    catalog.jobs.map((job) => [
      job.id,
      projectWorkspaceJob(
        job,
        catalog.companies.get(job.companyId),
        state,
        now,
        undefined,
        appliedIds,
        applicationLimitIds,
      ),
    ]),
  );
  const { positionOptions, skillOptions } = taxonomy(catalog.jobs);
  return {
    state,
    jobs: catalog.jobs,
    companies: catalog.companies,
    savedJobs: state.savedJobIds.flatMap((jobId) => {
      const job = cardById.get(jobId);
      return job ? [job] : [];
    }),
    appliedJobIds,
    applicationLimitJobIds,
    positionOptions,
    skillOptions,
  };
}

function experienceMatches(
  minimumYears: number,
  preference: JobPreferences["experienceLevel"],
) {
  switch (preference) {
    case "no_experience":
      return minimumYears === 0;
    case "under_1_year":
      return minimumYears <= 1;
    case "1_3_years":
      return minimumYears >= 1 && minimumYears <= 3;
    case "3_5_years":
      return minimumYears >= 3 && minimumYears <= 5;
    case "5_plus_years":
      return minimumYears >= 5;
  }
}

function positionMatches(job: SourceJob, preferences: JobPreferences) {
  const taxonomyMatch = preferences.professionalPositions.some(
    (position) =>
      job.categoryIds.includes(position) || job.categoryFamily === position,
  );
  const customMatch = preferences.customPositions.some((position) => {
    const query = normalize(position);
    return (
      normalize(job.title).includes(query) ||
      normalize(job.subIndustry).includes(query)
    );
  });
  return taxonomyMatch || customMatch;
}

function skillsMatch(job: SourceJob, preferences: JobPreferences) {
  const jobSkills = new Set(job.skillTags.map(normalize));
  return preferences.skills.some((skill) => jobSkills.has(normalize(skill)));
}

function locationMatches(job: SourceJob, preferences: JobPreferences) {
  if (job.location.isNationwideRemote) return true;
  return preferences.workLocations.includes(job.location.city);
}

export function isJobPreferencesConfigured(preferences: JobPreferences) {
  return Boolean(
    preferences.professionalPositions.length ||
    preferences.customPositions.length ||
    preferences.skills.length ||
    preferences.desiredSalaryMin ||
    preferences.workLocations.length ||
    preferences.openToRelocation ||
    preferences.experienceLevel !== "no_experience",
  );
}

export function suggestedJobsForSnapshot(
  snapshot: JobWorkspaceSnapshot,
  now = new Date(),
): SuggestedWorkspaceJob[] {
  const { state } = snapshot;
  const preferences = state.jobPreferences;
  if (!isJobPreferencesConfigured(preferences)) return [];

  const hiddenIds = new Set(state.hiddenJobIds);
  const appliedIds = new Set(snapshot.appliedJobIds);
  const applicationLimitIds = new Set(snapshot.applicationLimitJobIds);
  const positionConfigured = Boolean(
    preferences.professionalPositions.length ||
    preferences.customPositions.length,
  );
  const skillsConfigured = preferences.skills.length > 0;
  const experienceConfigured = true;
  const salaryConfigured = preferences.desiredSalaryMin > 0;
  const locationConfigured =
    preferences.workLocations.length > 0 && !preferences.openToRelocation;

  return snapshot.jobs
    .filter(
      (job) =>
        isOpenForApplications(job, now) &&
        !hiddenIds.has(job.id) &&
        !appliedIds.has(job.id),
    )
    .map((job) => {
      const positionMatched = positionMatches(job, preferences);
      const skillMatched = skillsMatch(job, preferences);
      const experienceMatched = experienceMatches(
        job.experience.minYears,
        preferences.experienceLevel,
      );
      const salaryMatched = job.salary.max >= preferences.desiredSalaryMin;
      const locationMatched = locationMatches(job, preferences);
      const criteria = [
        positionConfigured
          ? {
              matched: positionMatched,
              label: "Desired position",
            }
          : null,
        skillsConfigured ? { matched: skillMatched, label: "Skills" } : null,
        experienceConfigured
          ? { matched: experienceMatched, label: "Experience" }
          : null,
        salaryConfigured ? { matched: salaryMatched, label: "Salary" } : null,
        locationConfigured
          ? { matched: locationMatched, label: "Location" }
          : null,
      ].filter(
        (criterion): criterion is { matched: boolean; label: string } =>
          criterion !== null,
      );
      return {
        job,
        positionMatched,
        skillMatched,
        criteria,
      };
    })
    .filter(({ positionMatched, skillMatched, criteria }) => {
      const hasRelevanceSignal =
        (positionConfigured && positionMatched) ||
        (skillsConfigured && skillMatched);
      const hardFiltersMatch = criteria
        .filter((criterion) =>
          ["Experience", "Salary", "Location"].includes(criterion.label),
        )
        .every((criterion) => criterion.matched);
      return (
        hardFiltersMatch &&
        (positionConfigured || skillsConfigured
          ? hasRelevanceSignal
          : criteria.some((criterion) => criterion.matched))
      );
    })
    .map(({ job, criteria }) => {
      const matchedCriteria = criteria
        .filter((criterion) => criterion.matched)
        .map((criterion) => criterion.label);
      const matchScore = Math.round(
        (matchedCriteria.length / Math.max(1, criteria.length)) * 100,
      );
      return {
        ...projectWorkspaceJob(
          job,
          snapshot.companies.get(job.companyId),
          state,
          now,
          matchScore,
          appliedIds,
          applicationLimitIds,
        ),
        matchedCriteria,
      };
    })
    .sort((left, right) => {
      if (right.matchedCriteria.length !== left.matchedCriteria.length) {
        return right.matchedCriteria.length - left.matchedCriteria.length;
      }
      return (
        right.publishedAt.localeCompare(left.publishedAt) ||
        left.id.localeCompare(right.id)
      );
    });
}
