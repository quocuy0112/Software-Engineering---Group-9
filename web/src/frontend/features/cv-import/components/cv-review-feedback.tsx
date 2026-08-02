import styles from "./cv-review-feedback.module.css";

export function CvReviewFeedback({
  message,
  error,
  dirty,
}: {
  message: string | null;
  error: string | null;
  dirty: boolean;
}) {
  return (
    <div className={styles.root}>
      <p className={styles.status} role="status" aria-live="polite">
        {message ?? (dirty ? "Unsaved review changes." : "Review is saved.")}
      </p>
      {error ? (
        <div className={styles.error} role="alert" tabIndex={-1}>
          <strong>Review action failed</strong>
          <p>{error}</p>
        </div>
      ) : null}
    </div>
  );
}
