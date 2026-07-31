"use client";

import { useEffect, useRef, useState } from "react";
import { usePasswordChange } from "../client/use-password-change";

export function PasswordChangeForm({ csrfProof }: { csrfProof: string }) {
  const state = usePasswordChange(csrfProof);
  const [showPasswords, setShowPasswords] = useState(false);
  const feedbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.feedback) feedbackRef.current?.focus();
  }, [state.feedback]);

  const type = showPasswords ? "text" : "password";
  const errors = state.feedback?.fieldErrors;

  return (
    <section
      className="security-panel password-change-panel"
      aria-labelledby="password-change-title"
    >
      <div className="security-panel-heading">
        <span
          className="security-panel-icon security-panel-icon--mint"
          aria-hidden="true"
        >
          ↻
        </span>
        <div>
          <p className="panel-kicker">CREDENTIAL SECURITY</p>
          <h2 id="password-change-title">Change password</h2>
        </div>
      </div>
      <p className="security-panel-copy" id="password-change-policy">
        Use 12 to 128 Unicode characters. Spaces are allowed; uppercase,
        lowercase, digits, and symbols are not individually required.
      </p>
      <div
        ref={feedbackRef}
        className="password-change-feedback"
        role={
          state.feedback
            ? state.feedback.kind === "error"
              ? "alert"
              : "status"
            : undefined
        }
        aria-live="polite"
        aria-atomic="true"
        tabIndex={state.feedback ? -1 : undefined}
        data-feedback-kind={state.feedback?.kind}
      >
        {state.feedback ? (
          <>
            <strong>{state.feedback.message}</strong>
            {state.retryAfterSeconds > 0 ? (
              <span> Try again in {state.retryAfterSeconds} seconds.</span>
            ) : null}
            {errors ? (
              <ul>
                {Object.values(errors)
                  .flat()
                  .map((message) => (
                    <li key={message}>{message}</li>
                  ))}
              </ul>
            ) : null}
          </>
        ) : null}
      </div>
      <form
        className="password-change-form"
        onSubmit={(event) => {
          event.preventDefault();
          void state.submit();
        }}
      >
        <label htmlFor="password-change-current">Current password</label>
        <input
          id="password-change-current"
          type={type}
          autoComplete="current-password"
          value={state.values.currentPassword}
          aria-describedby="password-change-policy"
          onChange={(event) =>
            state.updateValue("currentPassword", event.target.value)
          }
        />

        <label htmlFor="password-change-new">New password</label>
        <input
          id="password-change-new"
          type={type}
          autoComplete="new-password"
          value={state.values.newPassword}
          aria-describedby="password-change-policy"
          aria-invalid={Boolean(errors?.newPassword)}
          onChange={(event) =>
            state.updateValue("newPassword", event.target.value)
          }
        />

        <label htmlFor="password-change-confirmation">
          Confirm new password
        </label>
        <input
          id="password-change-confirmation"
          type={type}
          autoComplete="new-password"
          value={state.values.newPasswordConfirmation}
          aria-describedby="password-change-policy"
          aria-invalid={Boolean(errors?.newPasswordConfirmation)}
          onChange={(event) =>
            state.updateValue("newPasswordConfirmation", event.target.value)
          }
        />

        <label className="password-visibility-control">
          <input
            type="checkbox"
            checked={showPasswords}
            onChange={(event) => setShowPasswords(event.target.checked)}
          />
          Show passwords
        </label>

        <button type="submit" disabled={state.submitting || state.locked}>
          {state.submitting
            ? "Changing password..."
            : state.locked
              ? `Try again in ${state.retryAfterSeconds} seconds`
              : "Change password"}
        </button>
      </form>
    </section>
  );
}
