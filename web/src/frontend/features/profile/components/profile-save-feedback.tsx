import type { ProfileEditorFeedback } from "../client/use-profile-editor";

export function ProfileSaveFeedback({
  feedback,
}: {
  feedback: ProfileEditorFeedback | null;
}) {
  return (
    <section
      className="professional-profile-feedback"
      aria-label="Save feedback"
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
              ? "Saved:"
              : feedback.kind === "warning"
                ? "Attention:"
                : "Could not save:"}
          </strong>{" "}
          {feedback.message}
        </p>
      ) : null}
    </section>
  );
}
