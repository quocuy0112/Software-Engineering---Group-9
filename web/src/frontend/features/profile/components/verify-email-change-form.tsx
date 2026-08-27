"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { emailChangeVerificationOutcomeSchema } from "@/shared/contracts/account/email-change";
import { accountErrorSchema } from "@/shared/contracts/account/common";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";
import { localizeAccountMessage } from "../client/localized-account-feedback";

type VerificationState =
  | { kind: "ready" }
  | { kind: "submitting" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function VerifyEmailChangeForm() {
  const locale = useWorkspaceLocale();
  const copy =
    locale === "vi"
      ? {
          eyebrow: "THAY ĐỔI EMAIL AN TOÀN",
          title: "Xác nhận thay đổi email",
          description:
            "Việc xác nhận được thực hiện rõ ràng. Giá trị liên kết riêng tư đã được xóa khỏi thanh địa chỉ trước khi trang hiển thị thao tác.",
          confirming: "Đang xác nhận thay đổi email...",
          confirm: "Xác nhận thay đổi email",
          requestNew: "Yêu cầu email xác minh mới",
        }
      : {
          eyebrow: "SECURE EMAIL CHANGE",
          title: "Confirm email change",
          description:
            "Confirmation is explicit. The private link value was removed from the address bar before this page rendered its action.",
          confirming: "Confirming email change...",
          confirm: "Confirm email change",
          requestNew: "Request a new verification email",
        };
  const [state, setState] = useState<VerificationState>({ kind: "ready" });
  const proof = useRef<string | null>(null);
  const fragmentRead = useRef(false);
  const feedback = useRef<HTMLParagraphElement>(null);
  const submitted = useRef(false);

  useEffect(() => {
    if (fragmentRead.current) return;
    fragmentRead.current = true;
    const fragment = window.location.hash;
    let candidate: string | null = null;
    if (fragment.startsWith("#proof=")) {
      try {
        candidate = decodeURIComponent(fragment.slice("#proof=".length));
      } catch {
        candidate = null;
      }
    }
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
    proof.current = candidate;
  }, []);

  useEffect(() => {
    if (state.kind === "error") feedback.current?.focus();
  }, [state]);

  const verify = async () => {
    if (submitted.current || state.kind === "submitting") return;
    if (!proof.current) {
      setState({
        kind: "error",
        message: localizeAccountMessage(
          locale,
          "This verification link cannot be used.",
          "EMAIL_CHANGE_PROOF_INVALID",
        ),
      });
      return;
    }
    submitted.current = true;
    setState({ kind: "submitting" });
    try {
      const response = await fetch("/api/account/email-change/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proof: proof.current }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const parsed = accountErrorSchema.safeParse(body);
        setState({
          kind: "error",
          message: parsed.success
            ? localizeAccountMessage(
                locale,
                parsed.data.message,
                parsed.data.code,
              )
            : localizeAccountMessage(
                locale,
                "This verification link cannot be used.",
                "EMAIL_CHANGE_PROOF_INVALID",
              ),
        });
        return;
      }
      const parsed = emailChangeVerificationOutcomeSchema.safeParse(body);
      if (!parsed.success) throw new Error("EMAIL_CHANGE_RESPONSE_INVALID");
      setState({
        kind: "success",
        message: localizeAccountMessage(locale, parsed.data.message),
      });
    } catch {
      setState({
        kind: "error",
        message: localizeAccountMessage(
          locale,
          "This verification link cannot be used.",
          "EMAIL_CHANGE_PROOF_INVALID",
        ),
      });
    } finally {
      submitted.current = false;
    }
  };

  return (
    <div className="verify-email-change">
      <header className="auth-form-heading">
        <p className="auth-eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>
      </header>
      {state.kind === "success" ? (
        <p role="status" className="verify-email-change-success">
          {state.message}
        </p>
      ) : (
        <>
          {state.kind === "error" ? (
            <p
              ref={feedback}
              role="alert"
              tabIndex={-1}
              className="verify-email-change-error"
            >
              {state.message}
            </p>
          ) : null}
          <button
            type="button"
            disabled={state.kind === "submitting"}
            onClick={verify}
          >
            {state.kind === "submitting" ? copy.confirming : copy.confirm}
          </button>
          {state.kind === "error" ? (
            <Link href="/profile/account">{copy.requestNew}</Link>
          ) : null}
        </>
      )}
    </div>
  );
}
