export default function JobsLoading() {
  return (
    <div className="jobs-page">
      <div
        className="job-panel job-feedback job-feedback-info"
        role="status"
        aria-live="polite"
      >
        Loading job opportunities…
      </div>
    </div>
  );
}
