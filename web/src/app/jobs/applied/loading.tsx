import { JobsWorkspace } from "@/frontend/features/jobs/components/jobs-workspace";

export default function AppliedJobsLoading() {
  return (
    <JobsWorkspace>
      <main className="jobs-page job-redesign-page" aria-busy="true">
        <div
          className="job-panel job-feedback job-feedback-info job-loading-state"
          role="status"
          aria-live="polite"
        >
          <span className="job-loading-bar" aria-hidden="true" />
          Loading your applications…
        </div>
        <div className="job-loading-cards" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </main>
    </JobsWorkspace>
  );
}
