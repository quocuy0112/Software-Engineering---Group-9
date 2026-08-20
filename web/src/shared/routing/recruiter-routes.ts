export const recruiterRoutes = {
  jobPostings: "/recruiter/job-postings",
  candidates: "/recruiter/candidates",
  pipeline: "/recruiter/pipeline",
  messages: "/recruiter/messages",
  jobPostingCreate: "/recruiter/job-postings/create",
  candidateRanking: (jobId: string) =>
    `/recruiter/candidates/${encodeURIComponent(jobId)}`,
  pipelineForJob: (jobId: string) =>
    `/recruiter/pipeline?jobId=${encodeURIComponent(jobId)}`,
  jobPostingEdit: (jobId: string) =>
    `/recruiter/job-postings/${encodeURIComponent(jobId)}/edit`,
} as const;
