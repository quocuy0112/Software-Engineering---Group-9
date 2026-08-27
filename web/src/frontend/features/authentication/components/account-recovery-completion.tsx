"use client";

import Link from "next/link";
import { useState } from "react";
import { useAccountRecoveryCapability } from "@/frontend/features/authentication/client/use-account-recovery-capability";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { AuthStatus } from "./auth-status";
import { PasswordField } from "./password-field";
import { PasswordRequirementChecklist } from "./password-requirement-checklist";
import { authCopy, localizedAuthMessage } from "./auth-copy";

export function AccountRecoveryCompletion() {
  const locale = useWorkspaceLocale();
  const copy = authCopy(locale);
  const capability = useAccountRecoveryCapability("completion");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState<"error" | "success">("error");
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || capability !== "authorized") return;
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/identity/account-recovery/complete", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newPassword: password,
          confirmPassword: confirmation,
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setStatusTone(response.ok ? "success" : "error");
      setStatus(
        localizedAuthMessage(
          locale,
          result?.message,
          response.ok ? copy.recovery.completionSuccess : copy.recovery.completionError,
        ),
      );
      if (response.ok) setCompleted(true);
    } catch {
      setStatusTone("error");
      setStatus(copy.recovery.completionError);
    } finally {
      setBusy(false);
      setPassword("");
      setConfirmation("");
    }
  }

  if (completed) {
    return (
      <section className="auth-form-content">
        <div className="auth-form">
          <div className="auth-form-heading">
            <p className="form-kicker">{copy.recovery.completionKicker}</p>
            <h1>{copy.recovery.completedTitle}</h1>
          </div>
          <AuthStatus status={status} tone={statusTone} />
          <p>{copy.recovery.completedDescription}</p>
          <Link href="/login">{copy.recovery.goToSignIn}</Link>
        </div>
      </section>
    );
  }

  if (capability !== "authorized") {
    return (
      <section className="auth-form-content">
        <div className="auth-form">
          <div className="auth-form-heading">
            <p className="form-kicker">{copy.recovery.completionKicker}</p>
            <h1>{copy.recovery.verifyingTitle}</h1>
          </div>
          <AuthStatus status={copy.recovery.verifying} />
          <Link href="/account-recovery">{copy.recovery.requestNewLink}</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="auth-form-content">
      <form className="auth-form" onSubmit={submit} noValidate aria-busy={busy}>
        <div className="auth-form-heading">
          <p className="form-kicker">{copy.recovery.completionKicker}</p>
          <h1>{copy.recovery.completionTitle}</h1>
          <p>{copy.recovery.completionDescription}</p>
        </div>
        <PasswordField
          label={copy.resetPassword.newPassword}
          id="account-recovery-password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <PasswordRequirementChecklist value={password} />
        <PasswordField
          label={copy.resetPassword.confirmPassword}
          id="account-recovery-confirm-password"
          autoComplete="new-password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          required
        />
        <button
          type="submit"
          disabled={busy || password.length < 12 || password !== confirmation}
        >
          {busy ? copy.recovery.completing : copy.recovery.complete}
        </button>
        <AuthStatus
          status={status}
          tone={statusTone}
        />
        <Link href="/login">{copy.common.backToSignIn}</Link>
      </form>
    </section>
  );
}
