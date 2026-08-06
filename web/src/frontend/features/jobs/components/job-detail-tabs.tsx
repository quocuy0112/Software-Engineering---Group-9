"use client";

import type { JobDetail } from "@/shared/contracts/jobs/discovery";
import { JobDetailSections } from "./job-detail-sections";
import { StickyMiniNav } from "./sticky-mini-nav";

/**
 * Compatibility export for older callers. Job Detail navigation is an
 * anchor bar; every section remains rendered in the document.
 */
export function JobDetailTabs({ job }: { job: JobDetail }) {
  return (
    <>
      <StickyMiniNav />
      <JobDetailSections job={job} />
    </>
  );
}
