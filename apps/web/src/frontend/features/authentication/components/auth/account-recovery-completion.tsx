"use client";

import Link from "next/link";
import { useState } from "react";
import { useAccountRecoveryCapability } from "@/frontend/features/identity/client/use-account-recovery-capability";
import { AuthStatus } from "./auth-status";
import { PasswordField } from "./password-field";

export function AccountRecoveryCompletion() {
  const capability = useAccountRecoveryCapability("completion");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState("");
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
      setStatus(result?.message ?? "Recovery could not be completed.");
      if (response.ok) setCompleted(true);
    } catch {
      setStatus("Recovery could not be completed.");
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
            <p className="form-kicker">RECOVERY COMPLETE</p>
            <h1>Sign in again</h1>
          </div>
          <AuthStatus status={status} />
          <p>Re-enroll two-factor authentication after your next login.</p>
          <Link href="/login">Go to sign in</Link>
        </div>
      </section>
    );
  }

  if (capability !== "authorized") {
    return (
      <section className="auth-form-content">
        <div className="auth-form">
          <div className="auth-form-heading">
            <p className="form-kicker">COMPLETE RECOVERY</p>
            <h1>Verifying secure link</h1>
          </div>
          <AuthStatus status="Verifying this secure recovery link…" />
          <Link href="/account-recovery">Request a new recovery link</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="auth-form-content">
      <form className="auth-form" onSubmit={submit} noValidate aria-busy={busy}>
        <div className="auth-form-heading">
          <p className="form-kicker">COMPLETE RECOVERY</p>
          <h1>Choose a new password</h1>
          <p>
            This step is available only after the 24-hour security hold. Your
            old TOTP and backup codes will be disabled here.
          </p>
        </div>
        <PasswordField
          label="New password"
          id="account-recovery-password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <PasswordField
          label="Confirm new password"
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
          {busy ? "Completing…" : "Complete recovery"}
        </button>
        <AuthStatus
          status={status}
          tone={status.includes("could not") ? "error" : "success"}
        />
        <Link href="/login">Back to sign in</Link>
      </form>
    </section>
  );
}
