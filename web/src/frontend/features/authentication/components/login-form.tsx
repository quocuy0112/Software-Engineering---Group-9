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
import Link from "next/link";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import {
  authCopy,
  localizedAuthFieldError,
  localizedAuthMessage,
  type AuthCopy,
} from "./auth-copy";

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

function getLoginLockedMessage(
  lockedUntil: number,
  copy: AuthCopy["login"],
) {
  const minutes = Math.max(1, Math.ceil((lockedUntil - Date.now()) / 60000));
  return copy.locked(minutes);
}

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_FAILURE_STORAGE_KEY_PREFIX = "smarthire-login-failed-attempts:";

function currentTimestamp() {
  return Date.now();
}

export function LoginForm({ returnTo = "/dashboard" }: { returnTo?: string }) {
  const router = useRouter();
  const locale = useWorkspaceLocale();
  const copy = authCopy(locale);
  const { status, setStatus } = useReplayableStatus("");
  const [isLocked, setIsLocked] = useState(false);
  const [suspended, setSuspended] = useState(false);
  const [suspendedSupportPath, setSuspendedSupportPath] = useState(
    "/support/account-security",
  );
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
      setStatus(getLoginLockedMessage(state.lockedUntil, copy.login));
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
      code?: string;
      supportPath?: string;
      requiresTwoFactor?: boolean;
      fields?: Record<string, string[]>;
    } | null;
    const message =
      response.status === 401
        ? copy.login.genericError
        : localizedAuthMessage(
            locale,
            body?.message,
            copy.login.unexpectedError,
          );
    if (!response.ok) {
      if (response.status === 423 && body?.code === "ACCOUNT_SUSPENDED") {
        setSuspended(true);
        setSuspendedSupportPath(
          body.supportPath ?? "/support/account-security",
        );
        setStatus(
          localizedAuthMessage(locale, body.message, copy.login.suspended),
        );
        return;
      }
      setSuspended(false);
      for (const [field, messages] of Object.entries(body?.fields ?? {}))
        setError(field as keyof LoginInput, {
          message:
            localizedAuthFieldError(locale, field, messages[0]) ??
            copy.login.unexpectedError,
        });

      const nextFailures = state.count + 1;
      const remaining = MAX_FAILED_LOGIN_ATTEMPTS - nextFailures;
      const lockedUntil =
        nextFailures >= MAX_FAILED_LOGIN_ATTEMPTS
          ? currentTimestamp() + LOGIN_LOCKOUT_WINDOW_MS
          : undefined;
      writeAttemptState(values.email, nextFailures, lockedUntil);

      if (lockedUntil) {
        setIsLocked(true);
        setStatus(getLoginLockedMessage(lockedUntil, copy.login));
        return;
      }

      setStatus(copy.login.attemptsRemaining(message, remaining));
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
        <p className="form-kicker">{copy.login.kicker}</p>
        <h1 id="page-title">{copy.login.title}</h1>
        <p>{copy.login.description}</p>
      </div>
      <div className="field">
        <label htmlFor="login-email">{copy.common.emailAddress}</label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={copy.common.emailPlaceholder}
          aria-invalid={Boolean(errors.email)}
          {...register("email")}
        />
        {errors.email ? (
          <p role="alert">
            {localizedAuthFieldError(locale, "email", errors.email.message)}
          </p>
        ) : null}
      </div>
      <PasswordField
        label={copy.login.password}
        autoComplete="current-password"
        hint={copy.login.passwordHint}
        error={localizedAuthFieldError(
          locale,
          "password",
          errors.password?.message,
        )}
        {...register("password")}
      />
      <Link className="auth-forgot-link" href="/forgot-password">
        {copy.login.forgotPassword}
      </Link>
      <button type="submit" disabled={isSubmitting || isNavigating || isLocked}>
        {isSubmitting || isNavigating ? copy.login.signingIn : copy.login.signIn}
      </button>
      <FormFeedback status={status} />
      {suspended && (
        <p role="status">
          <a href={suspendedSupportPath}>{copy.login.contactSupport}</a>
        </p>
      )}
    </form>
  );
}
