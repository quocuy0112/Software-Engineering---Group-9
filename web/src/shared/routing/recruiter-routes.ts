export const recruiterRoutes = {
  jobPostings: "/recruiter/job-postings",
  candidates: "/recruiter/candidates",
  jobPostingCreate: "/recruiter/job-postings/create",
  candidateRanking: (jobId: string) =>
    `/recruiter/candidates/${encodeURIComponent(jobId)}`,
  jobPostingEdit: (jobId: string) =>
    `/recruiter/job-postings/${encodeURIComponent(jobId)}/edit`,
} as const;
