"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import type { CvApiError } from "@/shared/contracts/cv-import/common";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";
import { cvCopy } from "../i18n/cv-import-copy";
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
  const locale = useWorkspaceLocale();
  const copy = cvCopy(locale).review;
  useEffect(() => {
    if (!error) return;
    toast.error(
      locale === "vi"
        ? "Không thể lưu bản xem xét."
        : "Review could not be saved.",
      {
        id: "cv-review-save-error",
        description: error,
        duration: 8_000,
      },
    );
  }, [error, locale]);

  const fieldMessages = [
    ...new Set(fieldErrors.map((fieldError) => fieldError.message)),
  ];
  return (
    <div className={styles.root}>
      <p className={styles.status} role="status" aria-live="polite">
        {message ?? (dirty ? copy.unsaved : copy.reviewSaved)}
      </p>
      {error ? (
        <div className={styles.error} role="alert" tabIndex={-1}>
          <strong>{copy.actionFailed}</strong>
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
