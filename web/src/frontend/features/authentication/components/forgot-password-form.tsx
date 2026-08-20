"use client";

import Link from "next/link";
import { useState } from "react";
import {
  PASSWORD_RECOVERY_SUCCESS_RESPONSE,
  PASSWORD_RECOVERY_REQUEST_FAILED_ERROR,
} from "@/shared/contracts/identity/password-recovery";
import { AuthStatus } from "./auth-status";
import { useReplayableStatus } from "./use-status";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const { status, setStatus } = useReplayableStatus("");
  const [statusTone, setStatusTone] = useState<"error" | "success">("error");
  const [busy, setBusy] = useState(false);
  const hasValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/identity/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const result = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setStatusTone(response.ok ? "success" : "error");
      setStatus(
        result?.message ??
          (response.ok
            ? PASSWORD_RECOVERY_SUCCESS_RESPONSE
            : PASSWORD_RECOVERY_REQUEST_FAILED_ERROR),
      );
    } catch {
      setStatusTone("error");
      setStatus(PASSWORD_RECOVERY_REQUEST_FAILED_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-form-content">
      <form className="auth-form" onSubmit={submit} noValidate aria-busy={busy}>
        <div className="auth-form-heading">
          <p className="form-kicker">ACCOUNT RECOVERY</p>
          <h1>Forgot your password?</h1>
          <p>
            Enter your email and we’ll send reset instructions if the account is
            eligible.
          </p>
        </div>
        <div className="field">
          <label htmlFor="forgot-email">Email address</label>
          <input
            id="forgot-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <button type="submit" disabled={busy || !hasValidEmail}>
          {busy ? "Sending…" : "Send reset instructions"}
        </button>
        <AuthStatus
          id="forgot-password-status"
          status={status}
          tone={statusTone}
        />
        <Link className="auth-recovery-link" href="/account-recovery">
          Lost your password and access to two-factor authentication?
        </Link>
      </form>
    </section>
  );
}
