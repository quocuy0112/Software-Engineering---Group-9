"use client";

import { useEffect, useRef, useState } from "react";
import { KeyRound } from "lucide-react";
import { PasswordVisibilityButton } from "@/frontend/components/ui/password-visibility-button";
import { usePasswordChange } from "../client/use-password-change";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";
import {
  UnsavedChangesIndicator,
  useUnsavedChangesGuard,
} from "../client/unsaved-changes";

export function PasswordChangeForm({
  csrfProof,
  initiallyEditing = true,
}: {
  csrfProof: string;
  initiallyEditing?: boolean;
}) {
  const locale = useWorkspaceLocale();
  const copy =
    locale === "vi"
      ? {
          kicker: "BẢO MẬT MẬT KHẨU",
          title: "Đổi mật khẩu",
          policy:
            "Sử dụng từ 12 đến 128 ký tự Unicode. Có thể dùng khoảng trắng; không bắt buộc riêng chữ hoa, chữ thường, chữ số hay ký hiệu.",
          retry: (seconds: number) => ` Thử lại sau ${seconds} giây.`,
          current: "Mật khẩu hiện tại",
          next: "Mật khẩu mới",
          confirm: "Xác nhận mật khẩu mới",
          show: "Hiện mật khẩu",
          hide: "Ẩn mật khẩu",
          changing: "Đang đổi mật khẩu...",
          locked: (seconds: number) => `Thử lại sau ${seconds} giây`,
          change: "Đổi mật khẩu",
        }
      : {
          kicker: "CREDENTIAL SECURITY",
          title: "Change password",
          policy:
            "Use 12 to 128 Unicode characters. Spaces are allowed; uppercase, lowercase, digits, and symbols are not individually required.",
          retry: (seconds: number) => ` Try again in ${seconds} seconds.`,
          current: "Current password",
          next: "New password",
          confirm: "Confirm new password",
          show: "Show passwords",
          hide: "Hide passwords",
          changing: "Changing password...",
          locked: (seconds: number) => `Try again in ${seconds} seconds`,
          change: "Change password",
        };
  const state = usePasswordChange(csrfProof);
  const dirty = Object.values(state.values).some(Boolean);
  const [isEditing, setIsEditing] = useState(initiallyEditing);
  useUnsavedChangesGuard(dirty && isEditing);
  const [visibleFields, setVisibleFields] = useState({
    currentPassword: false,
    newPassword: false,
    newPasswordConfirmation: false,
  });
  const feedbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.feedback) feedbackRef.current?.focus();
  }, [state.feedback]);

  const errors = state.feedback?.fieldErrors;

  const toggleVisibility = (
    field: "currentPassword" | "newPassword" | "newPasswordConfirmation",
  ) => {
    setVisibleFields((current) => ({
      ...current,
      [field]: !current[field],
    }));
  };

  return (
    <section
      className="security-panel password-change-panel"
      aria-labelledby="password-change-title"
    >
      <div className="security-panel-heading">
        <span className="security-panel-icon" aria-hidden="true">
          <KeyRound size={20} />
        </span>
        <div>
          <p className="panel-kicker">{copy.kicker}</p>
          <h2 id="password-change-title">{copy.title}</h2>
          {isEditing ? <UnsavedChangesIndicator dirty={dirty} /> : null}
        </div>
      </div>
      {!isEditing ? (
        <div className="security-readonly-summary">
          <div className="security-readonly-status">
            <span className="security-status-dot" aria-hidden="true" />
            <div>
              <strong>Password protected</strong>
              <p>Update your password whenever you need to refresh access.</p>
            </div>
          </div>
          <button
            className="profile-section-edit-button"
            type="button"
            onClick={() => setIsEditing(true)}
          >
            Change password
          </button>
        </div>
      ) : (
        <>
          <p className="security-panel-copy" id="password-change-policy">
            {copy.policy}
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
                  <span>{copy.retry(state.retryAfterSeconds)}</span>
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
            <label htmlFor="password-change-current">{copy.current}</label>
            <div className="password-control">
              <input
                className="sh-input"
                id="password-change-current"
                type={visibleFields.currentPassword ? "text" : "password"}
                autoComplete="current-password"
                value={state.values.currentPassword}
                aria-describedby="password-change-policy"
                aria-invalid={Boolean(errors?.currentPassword)}
                onChange={(event) =>
                  state.updateValue("currentPassword", event.target.value)
                }
              />
              <PasswordVisibilityButton
                controls="password-change-current"
                label={`${visibleFields.currentPassword ? copy.hide : copy.show}: ${copy.current}`}
                visible={visibleFields.currentPassword}
                onClick={() => toggleVisibility("currentPassword")}
              />
            </div>

            <label htmlFor="password-change-new">{copy.next}</label>
            <div className="password-control">
              <input
                className="sh-input"
                id="password-change-new"
                type={visibleFields.newPassword ? "text" : "password"}
                autoComplete="new-password"
                value={state.values.newPassword}
                aria-describedby="password-change-policy"
                aria-invalid={Boolean(errors?.newPassword)}
                onChange={(event) =>
                  state.updateValue("newPassword", event.target.value)
                }
              />
              <PasswordVisibilityButton
                controls="password-change-new"
                label={`${visibleFields.newPassword ? copy.hide : copy.show}: ${copy.next}`}
                visible={visibleFields.newPassword}
                onClick={() => toggleVisibility("newPassword")}
              />
            </div>

            <label htmlFor="password-change-confirmation">{copy.confirm}</label>
            <div className="password-control">
              <input
                className="sh-input"
                id="password-change-confirmation"
                type={
                  visibleFields.newPasswordConfirmation ? "text" : "password"
                }
                autoComplete="new-password"
                value={state.values.newPasswordConfirmation}
                aria-describedby="password-change-policy"
                aria-invalid={Boolean(errors?.newPasswordConfirmation)}
                onChange={(event) =>
                  state.updateValue(
                    "newPasswordConfirmation",
                    event.target.value,
                  )
                }
              />
              <PasswordVisibilityButton
                controls="password-change-confirmation"
                label={`${visibleFields.newPasswordConfirmation ? copy.hide : copy.show}: ${copy.confirm}`}
                visible={visibleFields.newPasswordConfirmation}
                onClick={() => toggleVisibility("newPasswordConfirmation")}
              />
            </div>

            <button type="submit" disabled={state.submitting || state.locked}>
              {state.submitting
                ? copy.changing
                : state.locked
                  ? copy.locked(state.retryAfterSeconds)
                  : copy.change}
            </button>
          </form>
          <button
            className="profile-section-secondary-button security-cancel-button"
            type="button"
            onClick={() => {
              state.clear();
              setIsEditing(false);
            }}
          >
            Cancel
          </button>
        </>
      )}
    </section>
  );
}
