"use client";

import Link from "next/link";
import { useState } from "react";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { AuthStatus } from "./auth-status";
import { authCopy, localizedAuthMessage } from "./auth-copy";

export function AccountRecoveryRequestForm({
  initialStatus,
}: {
  initialStatus?: "invalid-link";
}) {
  const locale = useWorkspaceLocale();
  const copy = authCopy(locale);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(() =>
    initialStatus
      ? copy.recovery.invalidLink
      : "",
  );
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
      setStatus(
        localizedAuthMessage(
          locale,
          result?.message,
          response.ok ? copy.recovery.requestSuccess : copy.recovery.requestError,
        ),
      );
    } catch {
      setStatusTone("error");
      setStatus(copy.recovery.requestError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-form-content">
      <form className="auth-form" onSubmit={submit} noValidate aria-busy={busy}>
        <div className="auth-form-heading">
          <p className="form-kicker">{copy.recovery.requestKicker}</p>
          <h1>{copy.recovery.requestTitle}</h1>
          <p>{copy.recovery.requestDescription}</p>
        </div>
        <label htmlFor="account-recovery-email">
          {copy.common.emailAddress}
        </label>
        <input
          id="account-recovery-email"
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
        <button type="submit" disabled={busy || !email.trim()}>
          {busy ? copy.recovery.sending : copy.recovery.sendInstructions}
        </button>
        <AuthStatus
          id="account-recovery-status"
          status={status}
          tone={statusTone}
        />
        <p>
          {copy.recovery.lowerAssurance}
        </p>
        <Link href="/login">{copy.common.backToSignIn}</Link>
      </form>
    </section>
  );
}
