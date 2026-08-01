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
  return (
    <section
      className="professional-profile-feedback"
      aria-label={copy.label}
      aria-live="polite"
      aria-atomic="true"
    >
      {feedback ? (
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
      ) : null}
    </section>
  );
}
