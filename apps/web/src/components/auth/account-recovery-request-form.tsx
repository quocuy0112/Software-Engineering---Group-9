"use client";

import Link from "next/link";
import { useState } from "react";
import { ACCOUNT_RECOVERY_REQUEST_FAILED_ERROR } from "@/features/identity/schemas/password-recovery";
import { AuthStatus } from "./auth-status";

export function AccountRecoveryRequestForm({
  initialStatus = "",
}: {
  initialStatus?: string;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [statusTone, setStatusTone] = useState<"error" | "success">("error");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/identity/account-recovery/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setStatusTone(response.ok ? "success" : "error");
      setStatus(result?.message ?? ACCOUNT_RECOVERY_REQUEST_FAILED_ERROR);
    } catch {
      setStatusTone("error");
      setStatus(ACCOUNT_RECOVERY_REQUEST_FAILED_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-form-content">
      <form className="auth-form" onSubmit={submit} noValidate aria-busy={busy}>
        <div className="auth-form-heading">
          <p className="form-kicker">ACCOUNT RECOVERY</p>
          <h1>Lost access to every factor?</h1>
          <p>
            Use this separate, lower-assurance process only if you lost your
            password, TOTP access, and every backup code.
          </p>
        </div>
        <label htmlFor="account-recovery-email">Email address</label>
        <input
          id="account-recovery-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <button type="submit" disabled={busy || !email.trim()}>
          {busy ? "Sending…" : "Send recovery instructions"}
        </button>
        <AuthStatus
          id="account-recovery-status"
          status={status}
          tone={statusTone}
        />
        <p>
          Email-only recovery is lower assurance than using your password and
          second factor.
        </p>
        <Link href="/login">Back to sign in</Link>
      </form>
    </section>
  );
}
