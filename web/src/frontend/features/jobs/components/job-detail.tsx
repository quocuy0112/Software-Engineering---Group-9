"use client";

import type { JobDetail } from "@/shared/contracts/jobs/discovery";
import { JobDetailView } from "./job-detail-redesign";

export { JobDetailPage, JobDetailView } from "./job-detail-redesign";

/**
 * Compatibility wrapper for older imports. The redesigned page is now the
 * single source of truth so legacy imports cannot reintroduce duplicate
 * actions, tabs, or inline report controls.
 */
export function LegacyJobDetailView({ job }: { job: JobDetail }) {
  return <JobDetailView job={job} />;
}
