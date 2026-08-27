"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { AuthStatus } from "./auth-status";
import { PasswordField } from "./password-field";
import { PasswordRequirementChecklist } from "./password-requirement-checklist";
import { useReplayableStatus } from "./use-status";
import { authCopy, localizedAuthMessage } from "./auth-copy";

export function ResetPasswordForm() {
  const router = useRouter();
  const locale = useWorkspaceLocale();
  const copy = authCopy(locale);
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
      setStatus(copy.resetPassword.mismatch);
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
        setStatus(
          localizedAuthMessage(locale, result?.message, copy.resetPassword.error),
        );
        return;
      }

      setStatusTone("success");
      setStatus(
        localizedAuthMessage(locale, result?.message, copy.resetPassword.success),
      );
      setToken("");
      setPassword("");
      setConfirmation("");
      setCompleted(true);
    } catch {
      setStatusTone("error");
      setStatus(copy.resetPassword.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-form-content">
      <form className="auth-form" onSubmit={submit} noValidate aria-busy={busy}>
        <div className="auth-form-heading">
          <p className="form-kicker">{copy.resetPassword.kicker}</p>
          <h1>{copy.resetPassword.title}</h1>
          <p>{copy.resetPassword.description}</p>
        </div>
        <PasswordField
          label={copy.resetPassword.newPassword}
          id="reset-password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <PasswordRequirementChecklist value={password} />
        <PasswordField
          label={copy.resetPassword.confirmPassword}
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
            ? copy.resetPassword.redirecting
            : busy
              ? copy.resetPassword.resetting
              : copy.resetPassword.reset}
        </button>
        <AuthStatus
          id="reset-password-status"
          status={status}
          tone={statusTone}
        />
        <Link href="/login">{copy.common.backToSignIn}</Link>
      </form>
    </section>
  );
}
