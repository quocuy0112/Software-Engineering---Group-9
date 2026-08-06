"use client";

export function ImageSearchProgress({
  progress,
  onCancel,
}: {
  progress: number;
  onCancel(): void;
}) {
  return (
    <div
      className="image-search-progress"
      aria-label="Processing job image"
      aria-live="polite"
      role="status"
    >
      <label htmlFor="image-search-progress">Processing job image</label>
      <progress id="image-search-progress" max={100} value={progress}>
        {progress}%
      </progress>
      <span>{progress}%</span>
      <button type="button" onClick={onCancel}>
        Cancel image search
      </button>
    </div>
  );
}
