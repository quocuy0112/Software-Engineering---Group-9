"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  accountErrorSchema,
  type FieldErrors,
} from "@/shared/contracts/account/common";
import {
  passwordChangeClientBinding,
  passwordChangeOutcomeSchema,
  passwordChangeRequestSchema,
} from "@/shared/contracts/account/password-change";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";
import {
  localizeAccountMessage,
  localizeFieldErrors,
} from "./localized-account-feedback";

export type PasswordChangeValues = {
  currentPassword: string;
  newPassword: string;
  newPasswordConfirmation: string;
};

export type PasswordChangeFeedback = {
  kind: "success" | "error";
  message: string;
  fieldErrors?: FieldErrors;
};

const emptyValues: PasswordChangeValues = {
  currentPassword: "",
  newPassword: "",
  newPasswordConfirmation: "",
};

function requestKey(): string {
  return `password_change_${globalThis.crypto
    .randomUUID()
    .replace(/[^A-Za-z0-9_-]/gu, "_")}`;
}

async function responseJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

export function usePasswordChange(csrfProof: string) {
  const locale = useWorkspaceLocale();
  const [values, setValues] = useState<PasswordChangeValues>(emptyValues);
  const [feedback, setFeedback] = useState<PasswordChangeFeedback | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(0);
  const active = useRef(false);
  const idempotency = useRef<{ binding: string; key: string } | null>(null);

  useEffect(() => {
    if (!lockedUntil) return;
    const update = () => {
      const seconds = Math.max(
        0,
        Math.ceil((lockedUntil - Date.now()) / 1_000),
      );
      setRetryAfterSeconds(seconds);
      if (seconds === 0) setLockedUntil(null);
    };
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, [lockedUntil]);

  const updateValue = (field: keyof PasswordChangeValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const clear = () => {
    setValues(emptyValues);
    setFeedback(null);
    idempotency.current = null;
  };

  const fail = (
    message: string,
    fieldErrors?: FieldErrors,
    retrySeconds?: number,
  ) => {
    setFeedback({ kind: "error", message, fieldErrors });
    if (retrySeconds) {
      setRetryAfterSeconds(retrySeconds);
      setLockedUntil(Date.now() + retrySeconds * 1_000);
    }
    toast.error(message, { id: "password-change-feedback" });
  };

  const submit = async (): Promise<boolean> => {
    if (active.current || lockedUntil) return false;
    const parsed = passwordChangeRequestSchema.safeParse(values);
    if (!parsed.success) {
      const mismatch = parsed.error.issues.some(
        (issue) => issue.path[0] === "newPasswordConfirmation",
      );
      fail(
        mismatch
          ? locale === "vi"
            ? "Mật khẩu xác nhận phải trùng khớp."
            : "The new-password confirmation must match."
          : locale === "vi"
            ? "Mật khẩu mới phải có từ 12 đến 128 ký tự Unicode hợp lệ."
            : "Use 12 to 128 valid Unicode characters for the new password.",
      );
      return false;
    }
    const binding = passwordChangeClientBinding(parsed.data);
    if (!idempotency.current || idempotency.current.binding !== binding) {
      idempotency.current = { binding, key: requestKey() };
    }
    active.current = true;
    setSubmitting(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/account/password/change", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfProof,
          "Idempotency-Key": idempotency.current.key,
        },
        body: JSON.stringify(parsed.data),
      });
      const body = await responseJson(response);
      if (!response.ok) {
        const error = accountErrorSchema.safeParse(body);
        if (!error.success) {
          fail(
            locale === "vi"
              ? "Không thể hoàn tất việc đổi mật khẩu. Hãy thử lại."
              : "The password change could not be completed. Try again.",
          );
          return false;
        }
        fail(
          localizeAccountMessage(locale, error.data.message, error.data.code),
          localizeFieldErrors(locale, error.data.fieldErrors),
          error.data.retryAfterSeconds,
        );
        if (response.status !== 503) idempotency.current = null;
        return false;
      }
      const outcome = passwordChangeOutcomeSchema.safeParse(body);
      if (!outcome.success) throw new Error("PASSWORD_CHANGE_RESPONSE_INVALID");
      setValues(emptyValues);
      const message = localizeAccountMessage(locale, outcome.data.message);
      setFeedback({ kind: "success", message });
      idempotency.current = null;
      toast.success(message, {
        id: "password-change-feedback",
      });
      return true;
    } catch {
      fail(
        locale === "vi"
          ? "Không thể hoàn tất việc đổi mật khẩu. Hãy thử lại."
          : "The password change could not be completed. Try again.",
      );
      return false;
    } finally {
      active.current = false;
      setSubmitting(false);
    }
  };

  return {
    values,
    feedback,
    submitting,
    retryAfterSeconds,
    locked: lockedUntil !== null,
    updateValue,
    clear,
    submit,
  };
}
