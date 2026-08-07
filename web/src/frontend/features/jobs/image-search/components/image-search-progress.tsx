"use client";

export function ImageSearchProgress({
  progress,
  onCancel,
}: {
  progress: number;
  onCancel(): void;
}) {
  const message =
    progress <= 20
      ? "Uploading securely"
      : progress < 70
        ? "Scanning and reading text"
        : "Preparing editable filters";
  return (
    <div
      className="image-search-progress"
      aria-label="Processing job image"
      aria-live="polite"
      role="status"
    >
      <div className="image-search-progress-heading">
        <span className="image-search-progress-spinner" aria-hidden="true" />
        <span>
          <label htmlFor="image-search-progress">Processing job image</label>
          <small>{message}</small>
        </span>
        <strong>{progress}%</strong>
      </div>
      <progress id="image-search-progress" max={100} value={progress}>
        {progress}%
      </progress>
      <button type="button" onClick={onCancel}>
        Cancel image search
      </button>
    </div>
  );
}
