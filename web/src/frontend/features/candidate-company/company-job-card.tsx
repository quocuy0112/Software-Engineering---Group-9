import type { JobCard } from "@/shared/contracts/jobs/discovery";
import { JobCardView } from "@/frontend/features/jobs/components/job-card";

export function CompanyJobCard({ job }: { job: JobCard }) {
  return <JobCardView job={job} />;
}
