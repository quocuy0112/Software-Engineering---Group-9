"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TWO_FACTOR_GENERIC_ERROR } from "@/shared/contracts/identity/two-factor";
import { AuthStatus } from "./auth-status";
import { useReplayableStatus } from "./use-status";

const MAX_TWO_FACTOR_ATTEMPTS = 5;
const TWO_FACTOR_ATTEMPTS_WINDOW_SECONDS = 10 * 60;
const TWO_FACTOR_ATTEMPTS_STORAGE_KEY_PREFIX =
  "smarthire-two-factor-challenge-attempts:";

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

function getLockedMessage(lockedUntil: number) {
  const minutes = Math.max(1, Math.ceil((lockedUntil - Date.now()) / 60000));
  return `Too many failed attempts. This verification flow is temporarily locked. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

export function TwoFactorChallenge() {
  const router = useRouter(),
    input = useRef<HTMLInputElement>(null),
    [factor, setFactor] = useState<"totp" | "backup-code">("totp"),
    [code, setCode] = useState(""),
    { status, setStatus } = useReplayableStatus(""),
    [tone, setTone] = useState<"error" | "success">("error"),
    [busy, setBusy] = useState(false),
    [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    input.current?.focus();
    const timer = window.setTimeout(() => {
      const state = readAttemptState(factor);
      if (state.lockedUntil && state.lockedUntil > Date.now()) {
        setIsLocked(true);
        setTone("error");
        setStatus(getLockedMessage(state.lockedUntil));
      } else {
        setIsLocked(false);
        setStatus("");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [factor, setStatus]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    const state = readAttemptState(factor);
    if (state.lockedUntil && state.lockedUntil > Date.now()) {
      setIsLocked(true);
      setTone("error");
      setStatus(getLockedMessage(state.lockedUntil));
      return;
    }

    setBusy(true);
    setStatus("");
    const sent = code;
    setCode("");
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
          setStatus(getLockedMessage(lockedUntil));
        } else {
          setIsLocked(false);
          setTone("error");
          setStatus(
            factor === "totp"
              ? `That authentication code is invalid. (${remainingAttempts} attempt${remainingAttempts === 1 ? "" : "s"} remaining)`
              : `That backup code is invalid. (${remainingAttempts} attempt${remainingAttempts === 1 ? "" : "s"} remaining)`,
          );
        }
        input.current?.focus();
        return;
      }
      writeAttemptState(factor, 0);
      setIsLocked(false);
      setTone("success");
      setStatus("Verification complete.");
      router.replace("/dashboard");
    } catch {
      setTone("error");
      setStatus(TWO_FACTOR_GENERIC_ERROR);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="auth-form-content">
      <form onSubmit={submit} noValidate aria-busy={busy} className="auth-form">
        <div className="auth-form-heading">
          <p className="form-kicker">VERIFY YOUR IDENTITY</p>
          <h1>Two-factor verification</h1>
          <p>Use your authenticator or one backup code.</p>
        </div>
        <div
          className="factor-mode-switcher"
          role="group"
          aria-label="Verification method"
        >
          <button
            type="button"
            onClick={() => {
              setFactor("totp");
              setCode("");
            }}
            aria-pressed={factor === "totp"}
          >
            Authenticator code
          </button>
          <button
            type="button"
            onClick={() => {
              setFactor("backup-code");
              setCode("");
            }}
            aria-pressed={factor === "backup-code"}
          >
            Backup code
          </button>
        </div>
        <div className="field">
          <label htmlFor="totp-code">
            {factor === "totp" ? "Authentication code" : "Backup code"}
          </label>
          <input
            ref={input}
            id="totp-code"
            name="code"
            type="text"
            inputMode={factor === "totp" ? "numeric" : "text"}
            autoComplete="one-time-code"
            maxLength={factor === "totp" ? 6 : 128}
            value={code}
            onChange={(e) =>
              setCode(
                factor === "totp"
                  ? e.target.value.replace(/\D/g, "").slice(0, 6)
                  : e.target.value.slice(0, 128),
              )
            }
            aria-describedby="two-factor-status"
            required
          />
        </div>
        <button
          type="submit"
          disabled={
            busy ||
            isLocked ||
            (factor === "totp" ? code.length !== 6 : code.trim().length < 8)
          }
        >
          {busy ? "Verifying…" : "Verify"}
        </button>
        <AuthStatus id="two-factor-status" status={status} tone={tone} />
        <Link href="/login">Back to sign in</Link>
      </form>
    </section>
  );
}
