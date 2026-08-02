"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  accountIdentityMutationOutcomeSchema,
  type AccountIdentity,
} from "@/shared/contracts/account/identity";
import {
  emailChangeQueuedSchema,
  emailChangeRequestBinding,
} from "@/shared/contracts/account/email-change";
import { accountErrorSchema } from "@/shared/contracts/account/common";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";
import { notifyAccountNameUpdated } from "./account-identity-events";
import { localizeAccountMessage } from "./localized-account-feedback";

export type AccountIdentityFeedback = {
  kind: "success" | "error";
  message: string;
};

async function json(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function requestKey(): string {
  return globalThis.crypto.randomUUID().replace(/[^A-Za-z0-9_-]/gu, "_");
}

export function useAccountIdentity(
  initialIdentity: AccountIdentity,
  csrfProof: string,
) {
  const locale = useWorkspaceLocale();
  const [identity, setIdentity] = useState(initialIdentity);
  const [feedback, setFeedback] = useState<AccountIdentityFeedback | null>(
    null,
  );
  const [savingName, setSavingName] = useState(false);
  const [requestingEmail, setRequestingEmail] = useState(false);
  const activeRequest = useRef<"name" | "email" | null>(null);
  const idempotency = useRef<{ binding: string; key: string } | null>(null);

  const fail = (message: string) => {
    setFeedback({ kind: "error", message });
    toast.error(message, { id: "account-identity-feedback" });
  };

  const saveName = async (name: string): Promise<boolean> => {
    if (activeRequest.current) return false;
    activeRequest.current = "name";
    setSavingName(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/account/identity", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfProof,
        },
        body: JSON.stringify({ name }),
      });
      const body = await json(response);
      if (!response.ok) {
        const parsed = accountErrorSchema.safeParse(body);
        fail(
          parsed.success
            ? localizeAccountMessage(
                locale,
                parsed.data.message,
                parsed.data.code,
              )
            : locale === "vi"
              ? "Không thể lưu thông tin tài khoản."
              : "The account identity could not be saved.",
        );
        return false;
      }
      const parsed = accountIdentityMutationOutcomeSchema.safeParse(body);
      if (!parsed.success) throw new Error("IDENTITY_RESPONSE_INVALID");
      setIdentity(parsed.data.identity);
      notifyAccountNameUpdated(parsed.data.identity.name);
      const message = localizeAccountMessage(locale, parsed.data.message);
      setFeedback({ kind: "success", message });
      toast.success(message, { id: "account-identity-feedback" });
      return true;
    } catch {
      fail(
        locale === "vi"
          ? "Không thể lưu thông tin tài khoản."
          : "The account identity could not be saved.",
      );
      return false;
    } finally {
      activeRequest.current = null;
      setSavingName(false);
    }
  };

  const requestEmailChange = async (
    newEmail: string,
    currentPassword: string,
  ): Promise<boolean> => {
    if (activeRequest.current) return false;
    let binding: string;
    try {
      binding = emailChangeRequestBinding(newEmail);
    } catch {
      fail(
        locale === "vi"
          ? "Hãy nhập địa chỉ email mới hợp lệ."
          : "Enter a valid proposed email address.",
      );
      return false;
    }
    if (!idempotency.current || idempotency.current.binding !== binding) {
      idempotency.current = { binding, key: requestKey() };
    }
    activeRequest.current = "email";
    setRequestingEmail(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/account/email-change/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfProof,
          "Idempotency-Key": idempotency.current.key,
        },
        body: JSON.stringify({ newEmail, currentPassword }),
      });
      const body = await json(response);
      if (!response.ok) {
        const parsed = accountErrorSchema.safeParse(body);
        fail(
          parsed.success
            ? localizeAccountMessage(
                locale,
                parsed.data.message,
                parsed.data.code,
              )
            : locale === "vi"
              ? "Không thể gửi yêu cầu xác minh. Hãy thử lại."
              : "The verification request could not be queued. Try again.",
        );
        return false;
      }
      const parsed = emailChangeQueuedSchema.safeParse(body);
      if (!parsed.success) throw new Error("EMAIL_CHANGE_RESPONSE_INVALID");
      setIdentity((current) => ({
        ...current,
        pendingEmailChange: {
          proposedEmail: newEmail.trim().normalize("NFKC"),
          expiresAt: parsed.data.expiresAt,
        },
      }));
      const message = localizeAccountMessage(locale, parsed.data.message);
      setFeedback({ kind: "success", message });
      toast.success(message, { id: "account-identity-feedback" });
      return true;
    } catch {
      fail(
        locale === "vi"
          ? "Không thể gửi yêu cầu xác minh. Hãy thử lại."
          : "The verification request could not be queued. Try again.",
      );
      return false;
    } finally {
      activeRequest.current = null;
      setRequestingEmail(false);
    }
  };

  return {
    identity,
    feedback,
    savingName,
    requestingEmail,
    saveName,
    requestEmailChange,
  };
}
