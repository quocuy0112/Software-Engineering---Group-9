export function RatingRow({
  score,
  reviewCount,
}: {
  score: number;
  reviewCount?: number;
}) {
  return (
    <div
      className="sh-rating-row"
      aria-label={`${score.toFixed(1)} out of 5 rating`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9L12 3Z" />
      </svg>
      <strong>{score.toFixed(1)} / 5</strong>
      {reviewCount !== undefined ? <span>· {reviewCount} reviews</span> : null}
    </div>
  );
}
