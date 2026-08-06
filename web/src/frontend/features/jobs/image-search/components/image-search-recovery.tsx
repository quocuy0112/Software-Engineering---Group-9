"use client";

export function ImageSearchRecovery({
  error,
  fallbackText,
  onRetry,
  onManual,
}: {
  error: string | null;
  fallbackText: string | null;
  onRetry(): void;
  onManual(text?: string): void;
}) {
  if (fallbackText)
    return (
      <div role="status" className="image-search-recovery">
        <h3>Use recognized text manually</h3>
        <textarea
          readOnly
          value={fallbackText}
          aria-label="Recognized job poster text"
        />
        <button type="button" onClick={() => onManual(fallbackText)}>
          Use as keyword search
        </button>
        <button type="button" onClick={onRetry}>
          Try another image
        </button>
      </div>
    );
  if (!error) return null;
  return (
    <div role="alert" className="image-search-recovery">
      <p>{error}</p>
      <p>Ordinary text search is still available.</p>
      <button type="button" onClick={onRetry}>
        Try another image
      </button>
      <button type="button" onClick={() => onManual()}>
        Search manually
      </button>
    </div>
  );
}
