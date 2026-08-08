"use client";

import Link from "next/link";
import { JobsWorkspace } from "@/frontend/features/jobs/components/jobs-workspace";

export default function AppliedJobsError({ reset }: { reset: () => void }) {
  return (
    <JobsWorkspace activeTab="applied">
      <main className="jobs-page job-redesign-page">
        <section
          className="job-panel job-feedback job-feedback-danger applied-applications-error"
          role="alert"
        >
          <div>
            <h1>We couldn’t load your applications</h1>
            <p>
              Your application data is still safe. Try again or return to the
              job search.
            </p>
          </div>
          <div className="applied-applications-error-actions">
            <button
              className="job-primary-button"
              type="button"
              onClick={reset}
            >
              Try again
            </button>
            <Link className="job-secondary-link" href="/jobs">
              Find jobs
            </Link>
          </div>
        </section>
      </main>
    </JobsWorkspace>
  );
}
