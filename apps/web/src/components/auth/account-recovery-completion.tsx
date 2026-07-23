"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthStatus } from "./auth-status";
import { PasswordField } from "./password-field";

export function AccountRecoveryCompletion() {
  const [proof, setProof] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get(
      "proof",
    );
    window.history.replaceState(null, "", window.location.pathname);
    void Promise.resolve().then(() => {
      setProof(value ?? "");
      if (!value) {
        setStatus(
          "This account-recovery link is invalid, expired, or already used.",
        );
      }
    });
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !proof) return;
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/identity/account-recovery/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completionProof: proof,
          newPassword: password,
          confirmPassword: confirmation,
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setStatus(result?.message ?? "Recovery could not be completed.");
      if (response.ok) {
        setCompleted(true);
        setProof("");
      }
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
          disabled={
            busy || !proof || password.length < 12 || password !== confirmation
          }
        >
          {busy ? "Completing…" : "Complete recovery"}
        </button>
        <AuthStatus status={status} tone={status.includes("could not") ? "error" : "success"} />
        <Link href="/login">Back to sign in</Link>
      </form>
    </section>
  );
}
