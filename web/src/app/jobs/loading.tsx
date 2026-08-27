import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { jobCopy } from "@/frontend/features/jobs/components/job-copy";

export default async function JobsLoading() {
  const context = await getWorkspaceContext();
  const copy = jobCopy(context?.initialLocale ?? "en");
  return (
    <div className="jobs-page job-redesign-page">
      <div
        className="job-panel job-feedback job-feedback-info job-loading-state"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-busy="true"
      >
        <span className="job-loading-bar" aria-hidden="true" />
        <span>
          <strong>{copy.loadingJobs}</strong>
          <small>{copy.loadingJobsDescription}</small>
        </span>
      </div>
      <div className="job-loading-cards" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
