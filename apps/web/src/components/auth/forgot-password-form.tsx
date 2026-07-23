"use client";

import Link from "next/link";
import { useState } from "react";
import { PASSWORD_RECOVERY_GENERIC_RESPONSE } from "@/features/identity/schemas/password-recovery";
import { AuthStatus } from "./auth-status";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/identity/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setStatus(result?.message ?? PASSWORD_RECOVERY_GENERIC_RESPONSE);
    } catch {
      setStatus(PASSWORD_RECOVERY_GENERIC_RESPONSE);
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
        <p>
          Enter your email and we’ll send reset instructions if the account is
          eligible.
        </p>
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
        <button type="submit" disabled={busy || email.trim().length === 0}>
          {busy ? "Sending…" : "Send reset instructions"}
        </button>
        <AuthStatus status={status} />
        <Link href="/login">Back to sign in</Link>
      </form>
    </section>
  );
}
