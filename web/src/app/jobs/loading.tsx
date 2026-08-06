export default function JobsLoading() {
  return (
    <div className="jobs-page job-redesign-page">
      <div
        className="job-panel job-feedback job-feedback-info job-loading-state"
        role="status"
        aria-live="polite"
      >
        <span className="job-loading-bar" aria-hidden="true" />
        Loading job opportunities…
      </div>
      <div className="job-loading-cards" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
