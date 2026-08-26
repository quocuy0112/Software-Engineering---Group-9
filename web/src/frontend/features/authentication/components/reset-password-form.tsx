"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  PASSWORD_CONFIRMATION_MISMATCH_ERROR,
  PASSWORD_RESET_GENERIC_ERROR,
  PASSWORD_RESET_SUCCESS_RESPONSE,
} from "@/shared/contracts/identity/password-recovery";
import { AuthStatus } from "./auth-status";
import { PasswordField } from "./password-field";
import { PasswordRequirementChecklist } from "./password-requirement-checklist";
import { useReplayableStatus } from "./use-status";

export function ResetPasswordForm() {
  const router = useRouter();
  const [token, setToken] = useState(() => {
    if (typeof window === "undefined") return "";
    const hash = window.location.hash.replace(/^#/, "");
    return new URLSearchParams(hash).get("token") ?? "";
  });
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const { status, setStatus } = useReplayableStatus("");
  const [statusTone, setStatusTone] = useState<"error" | "success">("error");
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  useEffect(() => {
    if (!completed) return;
    const redirectTimer = window.setTimeout(() => {
      router.replace("/login");
    }, 750);
    return () => window.clearTimeout(redirectTimer);
  }, [completed, router]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || completed) return;
    if (password !== confirmation) {
      setStatusTone("error");
      setStatus(PASSWORD_CONFIRMATION_MISMATCH_ERROR);
      return;
    }

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
      if (!response.ok) {
        setStatusTone("error");
        setStatus(result?.message ?? PASSWORD_RESET_GENERIC_ERROR);
        return;
      }

      setStatusTone("success");
      setStatus(result?.message ?? PASSWORD_RESET_SUCCESS_RESPONSE);
      setToken("");
      setPassword("");
      setConfirmation("");
      setCompleted(true);
    } catch {
      setStatusTone("error");
      setStatus(PASSWORD_RESET_GENERIC_ERROR);
    } finally {
      setBusy(false);
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
        <PasswordField
          label="New password"
          id="reset-password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <PasswordRequirementChecklist value={password} />
        <PasswordField
          label="Confirm new password"
          id="reset-confirm-password"
          autoComplete="new-password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          required
        />
        <button
          type="submit"
          disabled={busy || completed || !token || password.length < 12}
        >
          {completed
            ? "Redirecting to sign in…"
            : busy
              ? "Resetting…"
              : "Reset password"}
        </button>
        <AuthStatus
          id="reset-password-status"
          status={status}
          tone={statusTone}
        />
        <Link href="/login">Back to sign in</Link>
      </form>
    </section>
  );
}
