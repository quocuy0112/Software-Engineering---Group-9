"use client";

import { useEffect, useRef, useState } from "react";
import { PasswordVisibilityButton } from "@/frontend/components/ui/password-visibility-button";
import { usePasswordChange } from "../client/use-password-change";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";
import {
  UnsavedChangesIndicator,
  useUnsavedChangesGuard,
} from "../client/unsaved-changes";

export function PasswordChangeForm({ csrfProof }: { csrfProof: string }) {
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
  useUnsavedChangesGuard(dirty);
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
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6" />
          </svg>
        </span>
        <div>
          <p className="panel-kicker">{copy.kicker}</p>
          <h2 id="password-change-title">{copy.title}</h2>
          <UnsavedChangesIndicator dirty={dirty} />
        </div>
      </div>
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
            type={visibleFields.newPasswordConfirmation ? "text" : "password"}
            autoComplete="new-password"
            value={state.values.newPasswordConfirmation}
            aria-describedby="password-change-policy"
            aria-invalid={Boolean(errors?.newPasswordConfirmation)}
            onChange={(event) =>
              state.updateValue("newPasswordConfirmation", event.target.value)
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
    </section>
  );
}
