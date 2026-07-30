"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  loginSchema,
  type LoginInput,
} from "@/shared/contracts/identity/login";
import { PasswordField } from "./password-field";
import { FormFeedback } from "./form-feedback";
import { useReplayableStatus } from "./use-status";

// Must stay in sync with `rateLimitPolicies.login` in policies.ts (5 minutes).
const LOGIN_LOCKOUT_WINDOW_MS = 5 * 60 * 1000;

type LoginAttemptState = {
  count: number;
  lockedUntil?: number;
};

function getStorageKey(email: string) {
  return `${LOGIN_FAILURE_STORAGE_KEY_PREFIX}${email.trim().toLowerCase()}`;
}

function readAttemptState(email: string) {
  if (typeof window === "undefined") return { count: 0 } as LoginAttemptState;
  const stored = window.localStorage.getItem(getStorageKey(email));
  if (!stored) return { count: 0 } as LoginAttemptState;
  try {
    const parsed = JSON.parse(stored) as LoginAttemptState;
    if (parsed.lockedUntil && parsed.lockedUntil > Date.now()) return parsed;
    if (parsed.lockedUntil && parsed.lockedUntil <= Date.now()) {
      window.localStorage.removeItem(getStorageKey(email));
      return { count: 0 };
    }
    return { count: parsed.count ?? 0 };
  } catch {
    window.localStorage.removeItem(getStorageKey(email));
    return { count: 0 } as LoginAttemptState;
  }
}

function writeAttemptState(email: string, count: number, lockedUntil?: number) {
  if (typeof window === "undefined") return;
  const key = getStorageKey(email);
  if (count <= 0) {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, JSON.stringify({ count, lockedUntil }));
}

function getLoginLockedMessage(lockedUntil: number) {
  const minutes = Math.max(1, Math.ceil((lockedUntil - Date.now()) / 60000));
  return `Your account has been temporarily locked after too many failed sign-in attempts. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_FAILURE_STORAGE_KEY_PREFIX = "smarthire-login-failed-attempts:";
const GENERIC_LOGIN_ERROR = "Email or password is incorrect.";

function currentTimestamp() {
  return Date.now();
}

export function LoginForm({ returnTo = "/dashboard" }: { returnTo?: string }) {
  const router = useRouter();
  const { status, setStatus } = useReplayableStatus("");
  const [isLocked, setIsLocked] = useState(false);
  const [isNavigating, startNavigation] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", returnTo },
  });
  const submit = handleSubmit(async (values) => {
    const state = readAttemptState(values.email);
    if (state.lockedUntil && state.lockedUntil > currentTimestamp()) {
      setIsLocked(true);
      setStatus(getLoginLockedMessage(state.lockedUntil));
      return;
    }

    setStatus("");
    const response = await fetch("/api/identity/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    const body = (await response.json().catch(() => null)) as {
      message?: string;
      requiresTwoFactor?: boolean;
      fields?: Record<string, string[]>;
    } | null;
    const message =
      response.status === 401
        ? GENERIC_LOGIN_ERROR
        : (body?.message ?? "Something went wrong. Please try again.");
    if (!response.ok) {
      for (const [field, messages] of Object.entries(body?.fields ?? {}))
        setError(field as keyof LoginInput, { message: messages[0] });

      const nextFailures = state.count + 1;
      const remaining = MAX_FAILED_LOGIN_ATTEMPTS - nextFailures;
      const lockedUntil =
        nextFailures >= MAX_FAILED_LOGIN_ATTEMPTS
          ? currentTimestamp() + LOGIN_LOCKOUT_WINDOW_MS
          : undefined;
      writeAttemptState(values.email, nextFailures, lockedUntil);

      if (lockedUntil) {
        setIsLocked(true);
        setStatus(getLoginLockedMessage(lockedUntil));
        return;
      }

      setStatus(
        `${message} (${remaining} attempt${remaining === 1 ? "" : "s"} remaining)`,
      );
      return;
    }

    writeAttemptState(values.email, 0);
    setIsLocked(false);
    if (body?.requiresTwoFactor) {
      startNavigation(() => router.replace("/two-factor"));
      return;
    }
    startNavigation(() => router.replace(returnTo));
  });
  return (
    <form
      className="auth-form"
      onSubmit={submit}
      noValidate
      aria-busy={isSubmitting || isNavigating}
    >
      <div className="auth-form-heading">
        <p className="form-kicker">WELCOME BACK</p>
        <h1 id="page-title">Sign in to SmartHire</h1>
        <p>Continue to your secure talent workspace.</p>
      </div>
      <div className="field">
        <label htmlFor="login-email">Email address</label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          {...register("email")}
        />
        {errors.email ? <p role="alert">{errors.email.message}</p> : null}
      </div>
      <PasswordField
        label="Password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register("password")}
      />
      <button type="submit" disabled={isSubmitting || isNavigating || isLocked}>
        {isSubmitting || isNavigating ? "Signing in…" : "Sign in"}
      </button>
      <FormFeedback status={status} />
    </form>
  );
}
