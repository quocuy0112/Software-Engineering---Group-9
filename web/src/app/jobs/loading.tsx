export default function JobsLoading() {
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
          <strong>Loading job opportunities…</strong>
          <small>Preparing verified listings and your selected filters.</small>
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
