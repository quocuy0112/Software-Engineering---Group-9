"use client";

import Link from "next/link";
import { useState } from "react";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { AuthStatus } from "./auth-status";
import { useReplayableStatus } from "./use-status";
import { authCopy, localizedAuthMessage } from "./auth-copy";

export function ForgotPasswordForm() {
  const locale = useWorkspaceLocale();
  const copy = authCopy(locale);
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
        localizedAuthMessage(
          locale,
          result?.message,
          response.ok ? copy.forgotPassword.success : copy.forgotPassword.error,
        ),
      );
    } catch {
      setStatusTone("error");
      setStatus(copy.forgotPassword.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-form-content">
      <form className="auth-form" onSubmit={submit} noValidate aria-busy={busy}>
        <div className="auth-form-heading">
          <p className="form-kicker">{copy.forgotPassword.kicker}</p>
          <h1>{copy.forgotPassword.title}</h1>
          <p>{copy.forgotPassword.description}</p>
        </div>
        <div className="field">
          <label htmlFor="forgot-email">{copy.common.emailAddress}</label>
          <input
            id="forgot-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={copy.common.emailPlaceholder}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <button type="submit" disabled={busy || !hasValidEmail}>
          {busy ? copy.forgotPassword.sending : copy.forgotPassword.send}
        </button>
        <AuthStatus
          id="forgot-password-status"
          status={status}
          tone={statusTone}
        />
        <Link className="auth-recovery-link" href="/account-recovery">
          {copy.forgotPassword.lostAccess}
        </Link>
      </form>
    </section>
  );
}
