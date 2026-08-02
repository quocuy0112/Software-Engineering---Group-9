"use client";

import type { ProfileEditorFeedback } from "../client/use-profile-editor";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";

export function ProfileSaveFeedback({
  feedback,
}: {
  feedback: ProfileEditorFeedback | null;
}) {
  const locale = useWorkspaceLocale();
  const copy =
    locale === "vi"
      ? {
          label: "Phản hồi lưu dữ liệu",
          success: "Đã lưu:",
          warning: "Cần chú ý:",
          error: "Không thể lưu:",
        }
      : {
          label: "Save feedback",
          success: "Saved:",
          warning: "Attention:",
          error: "Could not save:",
        };
  const fieldErrors = feedback?.fieldErrors
    ? [...new Set(Object.values(feedback.fieldErrors).flat())]
    : [];

  if (!feedback) return null;

  return (
    <section
      className="professional-profile-feedback"
      aria-label={copy.label}
      aria-live={feedback.kind === "error" ? "assertive" : "polite"}
      aria-atomic="true"
    >
      <p
        role={feedback.kind === "error" ? "alert" : "status"}
        tabIndex={feedback.kind === "error" ? -1 : undefined}
        data-feedback-kind={feedback.kind}
      >
        <strong>
          {feedback.kind === "success"
            ? copy.success
            : feedback.kind === "warning"
              ? copy.warning
              : copy.error}
        </strong>{" "}
        {feedback.message}
      </p>
      {fieldErrors.length > 0 ? (
        <ul>
          {fieldErrors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
