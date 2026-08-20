export const recruiterRoutes = {
  analytics: "/recruiter/analytics",
  jobPostings: "/recruiter/job-postings",
  candidates: "/recruiter/candidates",
  pipeline: "/recruiter/pipeline",
  messages: "/recruiter/messages",
  analyticsForJob: (jobId: string) =>
    "/recruiter/analytics/" + encodeURIComponent(jobId),
  jobPostingCreate: "/recruiter/job-postings/create",
  candidateRanking: (jobId: string) =>
    `/recruiter/candidates/${encodeURIComponent(jobId)}`,
  pipelineForJob: (jobId: string) =>
    `/recruiter/pipeline?jobId=${encodeURIComponent(jobId)}`,
  jobPostingEdit: (jobId: string) =>
    `/recruiter/job-postings/${encodeURIComponent(jobId)}/edit`,
} as const;
