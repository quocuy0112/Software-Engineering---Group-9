"use client";

import Link from "next/link";
import { useState } from "react";
import { PASSWORD_RECOVERY_REQUEST_FAILED_ERROR } from "@/features/identity/schemas/password-recovery";
import { AuthStatus } from "./auth-status";
import { useReplayableStatus } from "./use-status";

// Must stay in sync with `rateLimitPolicies.passwordReset` in policies.ts (10 minutes).
const FORGOT_PASSWORD_LOCKOUT_WINDOW_MS = 10 * 60 * 1000;

type ForgotPasswordAttemptState = {
  count: number;
  lockedUntil?: number;
};

function readForgotPasswordAttemptState(email: string) {
  if (typeof window === "undefined") return { count: 0 } as ForgotPasswordAttemptState;
  const key = getAccountStorageKey(email);
  const stored = window.localStorage.getItem(key);
  if (!stored) return { count: 0 } as ForgotPasswordAttemptState;
  try {
    const parsed = JSON.parse(stored) as ForgotPasswordAttemptState;
    if (parsed.lockedUntil && parsed.lockedUntil > Date.now()) return parsed;
    if (parsed.lockedUntil && parsed.lockedUntil <= Date.now()) {
      window.localStorage.removeItem(key);
      return { count: 0 };
    }
    return { count: parsed.count ?? 0 };
  } catch {
    window.localStorage.removeItem(key);
    return { count: 0 } as ForgotPasswordAttemptState;
  }
}

function writeForgotPasswordAttemptState(email: string, count: number, lockedUntil?: number) {
  if (typeof window === "undefined") return;
  const key = getAccountStorageKey(email);
  if (count <= 0) {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, JSON.stringify({ count, lockedUntil }));
}

function getForgotPasswordLockedMessage(lockedUntil: number) {
  const minutes = Math.max(1, Math.ceil((lockedUntil - Date.now()) / 60000));
  return `Password-reset requests are temporarily limited. Please wait ${minutes} minute${minutes === 1 ? "" : "s"} before trying again.`;
}

const MAX_FORGOT_PASSWORD_ATTEMPTS = 3;
const FORGOT_PASSWORD_STORAGE_KEY_PREFIX = "smarthire-forgot-password-attempts:";
const FORGOT_PASSWORD_LOCKED_MESSAGE =
  "Password-reset requests are temporarily limited. Please wait before trying again.";

function getAccountStorageKey(email: string) {
  return `${FORGOT_PASSWORD_STORAGE_KEY_PREFIX}${email.trim().toLowerCase()}`;
}

function getStoredAttemptCount(email: string) {
  if (typeof window === "undefined") return 0;
  const stored = window.localStorage.getItem(getAccountStorageKey(email));
  if (!stored) return 0;
  const parsed = Number.parseInt(stored, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
<<<<<<< HEAD
  const { status, setStatus } = useReplayableStatus("");
=======
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState<"error" | "success">("error");
>>>>>>> 2cd4ef0d939f8bf7c58d7bfeed2399ef37d7ffc5
  const [busy, setBusy] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const state = readForgotPasswordAttemptState(normalizedEmail);
    if (busy || (state.lockedUntil && state.lockedUntil > Date.now())) {
      if (state.lockedUntil && state.lockedUntil > Date.now()) {
        setIsLocked(true);
        setStatus(getForgotPasswordLockedMessage(state.lockedUntil));
      }
      return;
    }
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
<<<<<<< HEAD
      const nextAttempts = state.count + 1;
      const remaining = MAX_FORGOT_PASSWORD_ATTEMPTS - nextAttempts;
      const lockedUntil =
        nextAttempts >= MAX_FORGOT_PASSWORD_ATTEMPTS
          ? Date.now() + FORGOT_PASSWORD_LOCKOUT_WINDOW_MS
          : undefined;
      writeForgotPasswordAttemptState(normalizedEmail, nextAttempts, lockedUntil);
      if (lockedUntil) {
        setIsLocked(true);
        setStatus(getForgotPasswordLockedMessage(lockedUntil));
      } else {
        setStatus(
          `${result?.message ?? PASSWORD_RECOVERY_GENERIC_RESPONSE} (${remaining} attempt${remaining === 1 ? "" : "s"} remaining)`,
        );
      }
=======
      setStatusTone(response.ok ? "success" : "error");
      setStatus(
        result?.message ?? PASSWORD_RECOVERY_REQUEST_FAILED_ERROR,
      );
>>>>>>> 2cd4ef0d939f8bf7c58d7bfeed2399ef37d7ffc5
    } catch {
      setStatusTone("error");
      setStatus(PASSWORD_RECOVERY_REQUEST_FAILED_ERROR);
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
        <AuthStatus
          id="forgot-password-status"
          status={status}
          tone={statusTone}
        />
        <Link href="/account-recovery">
          Lost your password and access to two-factor authentication?
        </Link>
        <Link href="/login">Back to sign in</Link>
      </form>
    </section>
  );
}