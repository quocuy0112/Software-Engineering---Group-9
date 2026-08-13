import type { CandidateProfileContract } from "@/shared/contracts/account/profile";
import type { JobCard } from "@/shared/contracts/jobs/discovery";
import type { RecruiterHeaderStatus } from "@/shared/contracts/recruiter-header-status";
import type {
  EmployerSpotlight,
  HomeJob,
  HomePageModel,
  HomeViewer,
  SmartMatchInsight,
} from "@/frontend/features/home/home-page-model";

export const approvedRecruiterStatus: RecruiterHeaderStatus = {
  state: "APPROVED",
  destinationKind: "RECRUITER_WORKSPACE",
  href: "https://recruiter.example.test",
  observedAt: "2026-08-12T00:00:00.000Z",
};

export function candidateProfile(
  overrides: Partial<CandidateProfileContract> = {},
): CandidateProfileContract {
  return {
    revision: 1,
    empty: false,
    basics: { headline: null, summary: null, phone: null, location: "Hà Nội" },
    skills: [{ id: "skill-1", label: "TypeScript" }],
    experience: [],
    education: [],
    socialLinks: [],
    ...overrides,
  };
}

export const insufficientCandidateProfile = () =>
  candidateProfile({
    empty: true,
    basics: { headline: null, summary: null, phone: null, location: null },
    skills: [],
  });

export function jobCard(overrides: Partial<JobCard> = {}): JobCard {
  return {
    id: "job-1",
    slug: "frontend-intern",
    title: "Frontend Intern",
    company: {
      slug: "cong-ty-viet",
      displayName: "Công ty Việt",
      logoUrl: null,
      websiteUrl: null,
      publicDescription: "Đội ngũ sản phẩm tại Việt Nam.",
      publicLocation: "TP. Hồ Chí Minh",
    },
    location: "Hà Nội",
    employmentType: "INTERNSHIP",
    experienceLevel: "ENTRY",
    workArrangement: "HYBRID",
    salary: null,
    summary: "Cơ hội thực tập phát triển giao diện.",
    skills: ["TypeScript", "React", "CSS"],
    publishedAt: "2026-08-12T00:00:00.000Z",
    applicationDeadline: null,
    actions: {
      authenticated: true,
      saved: false,
      applied: false,
      canSave: true,
      canReport: true,
      canApply: true,
    },
    ...overrides,
  };
}

export function homeJob(overrides: Partial<HomeJob> = {}): HomeJob {
  return {
    id: "job-1",
    slug: "frontend-intern",
    title: "Frontend Intern",
    companyName: "Công ty Việt",
    companySlug: "cong-ty-viet",
    companyLogoUrl: null,
    companyDescription: "Đội ngũ sản phẩm tại Việt Nam.",
    location: "Hà Nội",
    workArrangement: "HYBRID",
    employmentType: "INTERNSHIP",
    skills: ["TypeScript", "React", "CSS"],
    saved: false,
    canSave: true,
    ...overrides,
  };
}

export function companySpotlight(
  overrides: Partial<EmployerSpotlight> = {},
): EmployerSpotlight {
  return {
    slug: "cong-ty-viet",
    name: "Công ty Việt",
    logoUrl: null,
    publicSummary: "Thông tin giới thiệu công khai.",
    publicLocation: "TP. Hồ Chí Minh",
    industry: "Công nghệ",
    size: "51-200",
    openPositionCount: 4,
    destination: { kind: "displayOnly" },
    ...overrides,
  };
}

export const personalMatch = (
  overrides: Partial<Extract<SmartMatchInsight, { kind: "personal" }>> = {},
): Extract<SmartMatchInsight, { kind: "personal" }> => ({
  kind: "personal",
  jobSlug: "frontend-intern",
  jobTitle: "Frontend Intern",
  score: 75,
  matchingSkills: ["TypeScript"],
  improvementAreas: ["React", "CSS"],
  limitations: ["profileSignals", "estimate"],
  ...overrides,
});

export const illustrativeMatch: SmartMatchInsight = {
  kind: "illustrative",
  score: 82,
};

export function homeModel({
  viewer = { kind: "guest" },
  match = illustrativeMatch,
  jobs = [homeJob()],
  companies = [companySpotlight()],
}: {
  viewer?: HomeViewer;
  match?: SmartMatchInsight;
  jobs?: readonly HomeJob[];
  companies?: readonly EmployerSpotlight[];
} = {}): HomePageModel {
  return {
    viewer,
    initialLocale: "en",
    jobs: jobs.length ? { status: "ready", items: jobs } : { status: "empty", items: [] },
    spotlights: companies.length ? { status: "ready", items: companies } : { status: "empty", items: [] },
    smartMatch: match,
  };
}

export const candidateViewer: Extract<HomeViewer, { kind: "candidate" }> = {
  kind: "candidate",
  displayName: "Nguyễn An",
  avatarUrl: null,
  csrfProof: "csrf-proof",
  recruiterStatus: null,
};

export const employerViewer: Extract<HomeViewer, { kind: "employer" }> = {
  kind: "employer",
  displayName: "Trần Minh",
  avatarUrl: null,
  csrfProof: "csrf-proof",
  recruiterStatus: approvedRecruiterStatus,
};
