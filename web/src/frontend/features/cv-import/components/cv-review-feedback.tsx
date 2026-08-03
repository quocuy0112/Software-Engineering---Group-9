"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import type { CvApiError } from "@/shared/contracts/cv-import/common";
import styles from "./cv-review-feedback.module.css";

type CvReviewFieldError = CvApiError["error"]["fieldErrors"][number];

export function CvReviewFeedback({
  message,
  error,
  fieldErrors,
  dirty,
}: {
  message: string | null;
  error: string | null;
  fieldErrors: readonly CvReviewFieldError[];
  dirty: boolean;
}) {
  useEffect(() => {
    if (!error) return;
    toast.error("Review could not be saved.", {
      id: "cv-review-save-error",
      description: error,
      duration: 8_000,
    });
  }, [error]);

  const fieldMessages = [
    ...new Set(fieldErrors.map((fieldError) => fieldError.message)),
  ];
  return (
    <div className={styles.root}>
      <p className={styles.status} role="status" aria-live="polite">
        {message ?? (dirty ? "Unsaved review changes." : "Review is saved.")}
      </p>
      {error ? (
        <div className={styles.error} role="alert" tabIndex={-1}>
          <strong>Review action failed</strong>
          <p>{error}</p>
          {fieldMessages.length ? (
            <ul>
              {fieldMessages.map((fieldMessage) => (
                <li key={fieldMessage}>{fieldMessage}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
