"use client";

import { useEffect, useRef, useState } from "react";
import { CircleCheck, KeyRound } from "lucide-react";
import { PasswordField } from "@/frontend/features/authentication/components/password-field";
import { Modal } from "@/frontend/components/ui/modal";
import { usePasswordChange } from "../client/use-password-change";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";
import {
  UnsavedChangesIndicator,
  useUnsavedChangesGuard,
} from "../client/unsaved-changes";

export function PasswordChangeForm({
  csrfProof,
}: {
  csrfProof: string;
  /** Kept for former callers; the form now always opens for input. */
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
          protected: "Mật khẩu được bảo vệ",
          protectedCopy:
            "Cập nhật mật khẩu khi bạn cần làm mới quyền truy cập trên các thiết bị.",
          identityTitle: "Xác nhận danh tính",
          identityDescription:
            "Nhập mật khẩu hiện tại để hoàn tất việc đổi mật khẩu.",
          identityConfirm: "Xác nhận và đổi mật khẩu",
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
          protected: "Password protected",
          protectedCopy:
            "Update your password whenever you need to refresh access across devices.",
          identityTitle: "Confirm your identity",
          identityDescription:
            "Enter your current password to complete this password change.",
          identityConfirm: "Confirm and change password",
        };
  const state = usePasswordChange(csrfProof);
  const dirty = Object.values(state.values).some(Boolean);
  const [isCurrentPasswordPromptOpen, setIsCurrentPasswordPromptOpen] =
    useState(false);
  useUnsavedChangesGuard(dirty);
  const feedbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.feedback) feedbackRef.current?.focus();
  }, [state.feedback]);

  const errors = state.feedback?.fieldErrors;

  const requestPasswordChange = () => {
    if (!state.values.currentPassword) {
      setIsCurrentPasswordPromptOpen(true);
      return;
    }
    void state.submit();
  };

  const confirmPasswordChange = async () => {
    const changed = await state.submit();
    if (changed) setIsCurrentPasswordPromptOpen(false);
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
          <UnsavedChangesIndicator dirty={dirty} />
        </div>
      </div>
      <div className="security-password-protected">
        <span className="security-status-dot" aria-hidden="true" />
        <div>
          <strong>{copy.protected}</strong>
          <p>{copy.protectedCopy}</p>
        </div>
      </div>
      <p
        className="security-panel-copy security-password-policy"
        id="password-change-policy"
      >
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
          requestPasswordChange();
        }}
      >
        <PasswordField
          className="sh-input"
          id="password-change-new"
          label={copy.next}
          autoComplete="new-password"
          value={state.values.newPassword}
          aria-describedby="password-change-policy"
          aria-invalid={Boolean(errors?.newPassword)}
          onChange={(event) =>
            state.updateValue("newPassword", event.target.value)
          }
        />
        <PasswordField
          className="sh-input"
          id="password-change-confirmation"
          label={copy.confirm}
          autoComplete="new-password"
          value={state.values.newPasswordConfirmation}
          aria-describedby="password-change-policy"
          aria-invalid={Boolean(errors?.newPasswordConfirmation)}
          onChange={(event) =>
            state.updateValue("newPasswordConfirmation", event.target.value)
          }
        />

        <button
          className="security-primary-action"
          type="submit"
          disabled={state.submitting || state.locked}
        >
          <CircleCheck aria-hidden="true" />
          <span>
            {state.submitting
              ? copy.changing
              : state.locked
                ? copy.locked(state.retryAfterSeconds)
                : copy.change}
          </span>
        </button>
      </form>
      <Modal
        open={isCurrentPasswordPromptOpen}
        title={copy.identityTitle}
        description={copy.identityDescription}
        icon={<KeyRound size={20} />}
        busy={state.submitting}
        onClose={() => setIsCurrentPasswordPromptOpen(false)}
      >
        <form
          className="password-change-current-password-form"
          onSubmit={(event) => {
            event.preventDefault();
            void confirmPasswordChange();
          }}
        >
          <PasswordField
            className="sh-input"
            id="password-change-current"
            label={copy.current}
            autoComplete="current-password"
            data-autofocus
            value={state.values.currentPassword}
            aria-describedby="password-change-policy"
            aria-invalid={Boolean(errors?.currentPassword)}
            onChange={(event) =>
              state.updateValue("currentPassword", event.target.value)
            }
          />
          <button
            className="security-primary-action"
            type="submit"
            disabled={state.submitting || state.locked}
          >
            <CircleCheck aria-hidden="true" />
            <span>
              {state.submitting ? copy.changing : copy.identityConfirm}
            </span>
          </button>
        </form>
      </Modal>
    </section>
  );
}
