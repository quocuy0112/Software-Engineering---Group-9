"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PASSWORD_RESET_GENERIC_ERROR } from "@/features/identity/schemas/password-recovery";
import { AuthStatus } from "./auth-status";

export function ResetPasswordForm() {
  const [token, setToken] = useState(() => {
    if (typeof window === "undefined") return "";
    const hash = window.location.hash.replace(/^#/, "");
    return new URLSearchParams(hash).get("token") ?? "";
  });
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    window.history.replaceState(null, "", window.location.pathname);
    return () => {
      setToken("");
      setPassword("");
      setConfirmation("");
    };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setStatus("");
    const sentToken = token;
    try {
      const response = await fetch("/api/identity/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: sentToken,
          newPassword: password,
          confirmPassword: confirmation,
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setStatus(result?.message ?? PASSWORD_RESET_GENERIC_ERROR);
      if (response.ok) setToken("");
    } catch {
      setStatus(PASSWORD_RESET_GENERIC_ERROR);
    } finally {
      setBusy(false);
      setPassword("");
      setConfirmation("");
    }
  }

  return (
    <section className="auth-form-content">
      <form className="auth-form" onSubmit={submit} noValidate aria-busy={busy}>
        <div className="auth-form-heading">
          <p className="form-kicker">SECURE YOUR ACCOUNT</p>
          <h1>Choose a new password</h1>
          <p>Use a strong, unique password you do not use anywhere else.</p>
        </div>
        <label htmlFor="reset-password">New password</label>
        <input
          id="reset-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <label htmlFor="reset-confirm-password">Confirm new password</label>
        <input
          id="reset-confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          required
        />
        <button
          type="submit"
          disabled={
            busy || !token || password.length < 12 || password !== confirmation
          }
        >
          {busy ? "Resetting…" : "Reset password"}
        </button>
        <AuthStatus
          status={status}
          tone={status === PASSWORD_RESET_GENERIC_ERROR ? "error" : "success"}
        />
        <Link href="/login">Back to sign in</Link>
      </form>
    </section>
  );
}
