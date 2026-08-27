"use client";

import Link from "next/link";
import { JobsWorkspace } from "@/frontend/features/jobs/components/jobs-workspace";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { jobCopy } from "@/frontend/features/jobs/components/job-copy";

export default function AppliedJobsError({ reset }: { reset: () => void }) {
  const copy = jobCopy(useWorkspaceLocale());
  return (
    <JobsWorkspace>
      <main className="jobs-page job-redesign-page">
        <section
          className="job-panel job-feedback job-feedback-danger applied-applications-error"
          role="alert"
        >
          <div>
            <h1>{copy.applicationsLoadError}</h1>
            <p>{copy.applicationsLoadErrorDescription}</p>
          </div>
          <div className="applied-applications-error-actions">
            <button
              className="job-primary-button"
              type="button"
              onClick={reset}
            >
              {copy.tryAgain}
            </button>
            <Link className="job-secondary-link" href="/jobs">
              {copy.findJobsLabel}
            </Link>
          </div>
        </section>
      </main>
    </JobsWorkspace>
  );
}
