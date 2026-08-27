"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { AuthStatus } from "./auth-status";
import { useReplayableStatus } from "./use-status";
import { authCopy, type AuthCopy } from "./auth-copy";

const MAX_TWO_FACTOR_ATTEMPTS = 5;
const TWO_FACTOR_ATTEMPTS_WINDOW_SECONDS = 10 * 60;
const TWO_FACTOR_ATTEMPTS_STORAGE_KEY_PREFIX =
  "smarthire-two-factor-challenge-attempts:";
const TOTP_LENGTH = 6;

type AttemptState = {
  count: number;
  lockedUntil?: number;
};

function getStorageKey(factor: "totp" | "backup-code") {
  return `${TWO_FACTOR_ATTEMPTS_STORAGE_KEY_PREFIX}${factor}`;
}

function readAttemptState(factor: "totp" | "backup-code") {
  if (typeof window === "undefined") {
    return { count: 0 } as AttemptState;
  }

  const storageKey = getStorageKey(factor);
  const stored = window.localStorage.getItem(storageKey);
  if (!stored) {
    return { count: 0 } as AttemptState;
  }

  try {
    const parsed = JSON.parse(stored) as AttemptState;
    if (parsed.lockedUntil && parsed.lockedUntil > Date.now()) {
      return parsed;
    }

    if (parsed.lockedUntil && parsed.lockedUntil <= Date.now()) {
      window.localStorage.removeItem(storageKey);
    }

    return { count: parsed.count ?? 0 } as AttemptState;
  } catch {
    window.localStorage.removeItem(storageKey);
    return { count: 0 } as AttemptState;
  }
}

function writeAttemptState(
  factor: "totp" | "backup-code",
  nextCount: number,
  lockedUntil?: number,
) {
  if (typeof window === "undefined") return;

  const storageKey = getStorageKey(factor);
  if (nextCount <= 0) {
    window.localStorage.removeItem(storageKey);
    return;
  }

  window.localStorage.setItem(
    storageKey,
    JSON.stringify({ count: nextCount, lockedUntil }),
  );
}

function getLockedMessage(lockedUntil: number, copy: AuthCopy["twoFactor"]) {
  const minutes = Math.max(1, Math.ceil((lockedUntil - Date.now()) / 60000));
  return copy.locked(minutes);
}

export function TwoFactorChallenge() {
  const locale = useWorkspaceLocale();
  const copy = useMemo(() => authCopy(locale), [locale]);
  const router = useRouter(),
    backupCodeInput = useRef<HTMLInputElement>(null),
    totpInput = useRef<HTMLInputElement>(null),
    [factor, setFactor] = useState<"totp" | "backup-code">("totp"),
    [totp, setTotp] = useState(""),
    [backupCode, setBackupCode] = useState(""),
    { status, setStatus } = useReplayableStatus(""),
    [tone, setTone] = useState<"error" | "success">("error"),
    [busy, setBusy] = useState(false),
    [isLocked, setIsLocked] = useState(false);

  const code = factor === "totp" ? totp : backupCode;
  const activeTotpIndex = totp.length < TOTP_LENGTH ? totp.length : -1;
  const clearCode = () => {
    if (factor === "totp") setTotp("");
    else setBackupCode("");
  };
  const focusActiveCode = useCallback(() => {
    if (factor === "totp") totpInput.current?.focus();
    else backupCodeInput.current?.focus();
  }, [factor]);

  const updateTotp = (value: string) =>
    setTotp(value.replace(/\D/g, "").slice(0, TOTP_LENGTH));

  useEffect(() => {
    focusActiveCode();
    const timer = window.setTimeout(() => {
      const state = readAttemptState(factor);
      if (state.lockedUntil && state.lockedUntil > Date.now()) {
        setIsLocked(true);
        setTone("error");
        setStatus(getLockedMessage(state.lockedUntil, copy.twoFactor));
      } else {
        setIsLocked(false);
        setStatus("");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [copy.twoFactor, factor, focusActiveCode, setStatus]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    const state = readAttemptState(factor);
    if (state.lockedUntil && state.lockedUntil > Date.now()) {
      setIsLocked(true);
      setTone("error");
      setStatus(getLockedMessage(state.lockedUntil, copy.twoFactor));
      return;
    }

    setBusy(true);
    setStatus("");
    const sent = code;
    clearCode();
    try {
      const r = await fetch("/api/identity/two-factor/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ factor, code: sent }),
      });
      if (!r.ok) {
        const nextAttempts = (state.count ?? 0) + 1;
        const remainingAttempts = MAX_TWO_FACTOR_ATTEMPTS - nextAttempts;
        const lockedUntil =
          nextAttempts >= MAX_TWO_FACTOR_ATTEMPTS
            ? Date.now() + TWO_FACTOR_ATTEMPTS_WINDOW_SECONDS * 1000
            : undefined;

        writeAttemptState(factor, nextAttempts, lockedUntil);
        if (lockedUntil) {
          setIsLocked(true);
          setTone("error");
          setStatus(getLockedMessage(lockedUntil, copy.twoFactor));
        } else {
          setIsLocked(false);
          setTone("error");
          setStatus(
            factor === "totp"
              ? copy.twoFactor.invalidAuthenticator(remainingAttempts)
              : copy.twoFactor.invalidBackup(remainingAttempts),
          );
        }
        focusActiveCode();
        return;
      }
      writeAttemptState(factor, 0);
      setIsLocked(false);
      setTone("success");
      setStatus(copy.twoFactor.complete);
      router.replace("/dashboard");
    } catch {
      setTone("error");
      setStatus(copy.twoFactor.genericError);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="auth-form-content">
      <form onSubmit={submit} noValidate aria-busy={busy} className="auth-form">
        <div className="auth-form-heading">
          <p className="form-kicker">{copy.twoFactor.kicker}</p>
          <h1>{copy.twoFactor.title}</h1>
          <p>{copy.twoFactor.description}</p>
        </div>
        <div
          className="factor-mode-switcher"
          role="group"
          aria-label={copy.twoFactor.method}
        >
          <button
            type="button"
            onClick={() => {
              setFactor("totp");
              setTotp("");
            }}
            aria-pressed={factor === "totp"}
          >
            {copy.twoFactor.authenticator}
          </button>
          <button
            type="button"
            onClick={() => {
              setFactor("backup-code");
              setBackupCode("");
            }}
            aria-pressed={factor === "backup-code"}
          >
            {copy.twoFactor.backup}
          </button>
        </div>
        <div className="field">
          {factor === "totp" ? (
            <div
              className="totp-code-inputs"
              role="group"
              aria-label={copy.twoFactor.sixDigit}
              aria-describedby="two-factor-status"
            >
              <input
                ref={totpInput}
                id="totp-code"
                name="code"
                className="totp-native-input"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                enterKeyHint="done"
                maxLength={TOTP_LENGTH}
                value={totp}
                aria-label={copy.twoFactor.authenticationCode}
                onChange={(event) => updateTotp(event.currentTarget.value)}
                required
              />
              {Array.from({ length: TOTP_LENGTH }, (_, index) => (
                <span className="totp-code-cell" aria-hidden="true" key={index}>
                  {totp[index] ??
                    (index === activeTotpIndex ? (
                      <span className="totp-code-caret" aria-hidden="true">
                        |
                      </span>
                    ) : null)}
                </span>
              ))}
            </div>
          ) : (
            <input
              ref={backupCodeInput}
              id="backup-code"
              name="code"
              type="text"
              inputMode="text"
              autoComplete="one-time-code"
              maxLength={128}
              value={backupCode}
              aria-label={copy.twoFactor.backupCode}
              onChange={(event) =>
                setBackupCode(event.currentTarget.value.slice(0, 128))
              }
              aria-describedby="two-factor-status"
              required
            />
          )}
        </div>
        <button
          type="submit"
          disabled={
            busy ||
            isLocked ||
            (factor === "totp" ? code.length !== 6 : code.trim().length < 8)
          }
        >
          {busy ? copy.twoFactor.verifying : copy.twoFactor.verify}
        </button>
        <AuthStatus id="two-factor-status" status={status} tone={tone} />
        <Link href="/login">{copy.common.backToSignIn}</Link>
      </form>
    </section>
  );
}
