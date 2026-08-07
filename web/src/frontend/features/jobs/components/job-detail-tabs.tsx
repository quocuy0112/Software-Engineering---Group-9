import type { JobDetail } from "@/shared/contracts/jobs/discovery";
import { JobDetailSections } from "./job-detail-sections";

/**
 * Compatibility export for older callers. Job Detail navigation now uses the
 * accessible accordion items rendered by JobDetailSections.
 */
export function JobDetailTabs({ job }: { job: JobDetail }) {
  return <JobDetailSections job={job} />;
}
