export const recruiterJobPostingTabs = [
  "active",
  "draft",
  "pending_approval",
  "closed",
] as const;

export type RecruiterJobPostingTab = (typeof recruiterJobPostingTabs)[number];

export function parseRecruiterJobPostingTab(
  value: string | string[] | undefined,
): RecruiterJobPostingTab {
  const candidate = Array.isArray(value) ? value[0] : value;
  return recruiterJobPostingTabs.includes(candidate as RecruiterJobPostingTab)
    ? (candidate as RecruiterJobPostingTab)
    : "active";
}

export const recruiterRoutes = {
  analytics: "/recruiter/analytics",
  jobPostings: "/recruiter/job-postings",
  candidates: "/recruiter/candidates",
  pipeline: "/recruiter/pipeline",
  messages: "/recruiter/messages",
  analyticsForJob: (jobId: string) =>
    "/recruiter/analytics/" + encodeURIComponent(jobId),
  jobPostingCreate: "/recruiter/job-postings/create",
  jobPostingCreateForCompany: (companyId: string) =>
    `/recruiter/job-postings/create?companyId=${encodeURIComponent(companyId)}`,
  candidateRanking: (jobId: string) =>
    `/recruiter/candidates/${encodeURIComponent(jobId)}`,
  pipelineForJob: (jobId: string) =>
    `/recruiter/pipeline?jobId=${encodeURIComponent(jobId)}`,
  jobPostingEdit: (jobId: string) =>
    `/recruiter/job-postings/${encodeURIComponent(jobId)}/edit`,
  jobPostingsForTab: (tab: RecruiterJobPostingTab) =>
    tab === "active"
      ? "/recruiter/job-postings"
      : `/recruiter/job-postings?tab=${encodeURIComponent(tab)}`,
} as const;
