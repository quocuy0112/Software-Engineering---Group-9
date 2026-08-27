type JobSearchEmptyStateAction = Readonly<{
  label: string;
  onClick: () => void;
}>;

export function JobSearchEmptyState({
  headingId,
  title,
  description,
  action,
}: Readonly<{
  headingId: string;
  title: string;
  description: string;
  action?: JobSearchEmptyStateAction;
}>) {
  return (
    <div
      className="job-panel job-search-empty-state"
      role="status"
      aria-labelledby={headingId}
      aria-atomic="true"
    >
      <span className="job-empty-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M4 7.5h16v11H4zM8 7.5V5.8A1.8 1.8 0 0 1 9.8 4h4.4A1.8 1.8 0 0 1 16 5.8v1.7M4 12h16" />
        </svg>
      </span>
      <h2 id={headingId}>{title}</h2>
      <p>{description}</p>
      {action ? (
        <div className="job-search-empty-actions">
          <button
            className="job-secondary-link job-search-empty-action"
            type="button"
            onClick={action.onClick}
          >
            <svg
              className="job-empty-action-icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M20 11a8 8 0 1 0 1.6 4.8" />
              <path d="M20 4v7h-7" />
            </svg>
            <span>{action.label}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
