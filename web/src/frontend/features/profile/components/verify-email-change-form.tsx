"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { emailChangeVerificationOutcomeSchema } from "@/shared/contracts/account/email-change";
import { accountErrorSchema } from "@/shared/contracts/account/common";

type VerificationState =
  | { kind: "ready" }
  | { kind: "submitting" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function VerifyEmailChangeForm() {
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
        message: "This verification link cannot be used.",
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
            ? parsed.data.message
            : "This verification link cannot be used.",
        });
        return;
      }
      const parsed = emailChangeVerificationOutcomeSchema.safeParse(body);
      if (!parsed.success) throw new Error("EMAIL_CHANGE_RESPONSE_INVALID");
      setState({ kind: "success", message: parsed.data.message });
    } catch {
      setState({
        kind: "error",
        message: "This verification link cannot be used.",
      });
    } finally {
      submitted.current = false;
    }
  };

  return (
    <div className="verify-email-change">
      <header className="auth-form-heading">
        <p className="auth-eyebrow">SECURE EMAIL CHANGE</p>
        <h1>Confirm email change</h1>
        <p>
          Confirmation is explicit. The private link value was removed from the
          address bar before this page rendered its action.
        </p>
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
            {state.kind === "submitting"
              ? "Confirming email change..."
              : "Confirm email change"}
          </button>
          {state.kind === "error" ? (
            <Link href="/profile/account">
              Request a new verification email
            </Link>
          ) : null}
        </>
      )}
    </div>
  );
}
