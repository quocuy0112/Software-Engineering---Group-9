"use client";
import { useEffect, useState } from "react";
import { AuthStatus } from "@/frontend/features/authentication/components/auth-status";
import { PasswordField } from "@/frontend/features/authentication/components/password-field";
import { useReplayableStatus } from "@/frontend/features/authentication/components/use-status";

const MAX_TWO_FACTOR_MANAGEMENT_ATTEMPTS = 5;
const TWO_FACTOR_MANAGEMENT_ATTEMPTS_WINDOW_SECONDS = 10 * 60;
const TWO_FACTOR_MANAGEMENT_STORAGE_KEY_PREFIX =
  "smarthire-two-factor-management-attempts:";

type AttemptState = {
  count: number;
  lockedUntil?: number;
};

// The attempt counter must be scoped to the signed-in account, otherwise one
// account's failed attempts lock out every other account that shares the
// browser. We key on the session's CSRF proof (unique per authenticated
// session) rather than a single shared constant. Until the proof has loaded
// we don't have a safe key to read/write yet, so treat state as untracked.
function getStorageKey(sessionProof: string) {
  return `${TWO_FACTOR_MANAGEMENT_STORAGE_KEY_PREFIX}${sessionProof}`;
}

function readAttemptState(sessionProof: string) {
  if (typeof window === "undefined" || !sessionProof)
    return { count: 0 } as AttemptState;
  const storageKey = getStorageKey(sessionProof);
  const stored = window.localStorage.getItem(storageKey);
  if (!stored) return { count: 0 } as AttemptState;

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
  sessionProof: string,
  nextCount: number,
  lockedUntil?: number,
) {
  if (typeof window === "undefined" || !sessionProof) return;
  const storageKey = getStorageKey(sessionProof);
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

export function TwoFactorManagement({
  onDisabled,
}: {
  onDisabled?: () => void;
}) {
  const [proof, setProof] = useState(""),
    [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [codes, setCodes] = useState<string[]>([]),
    { status, setStatus } = useReplayableStatus(""),
    [tone, setTone] = useState<"error" | "success">("success"),
    [busy, setBusy] = useState(false),
    [isLocked, setIsLocked] = useState(false);
  useEffect(() => {
    fetch("/api/identity/sessions", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((v) => {
        const sessionProof = v?.csrfProof ?? "";
        setProof(sessionProof);
        const state = readAttemptState(sessionProof);
        if (state.lockedUntil && state.lockedUntil > Date.now()) {
          setIsLocked(true);
          setTone("error");
          setStatus(getLockedMessage(state.lockedUntil));
        }
      });
    return () => {
      setCodes([]);
      setPassword("");
      setCode("");
    };
  }, [setStatus]);
  useEffect(() => {
    if (codes.length === 0) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [codes]);
  async function submit(path: string) {
    if (busy) return;

    const state = readAttemptState(proof);
    if (state.lockedUntil && state.lockedUntil > Date.now()) {
      setIsLocked(true);
      setTone("error");
      setStatus(getLockedMessage(state.lockedUntil));
      return;
    }

    setBusy(true);
    setStatus("");
    try {
      const r = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": proof },
        body: JSON.stringify({ currentPassword: password, code }),
      });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) {
        const nextAttempts = (state.count ?? 0) + 1;
        const remainingAttempts =
          MAX_TWO_FACTOR_MANAGEMENT_ATTEMPTS - nextAttempts;
        const lockedUntil =
          nextAttempts >= MAX_TWO_FACTOR_MANAGEMENT_ATTEMPTS
            ? Date.now() + TWO_FACTOR_MANAGEMENT_ATTEMPTS_WINDOW_SECONDS * 1000
            : undefined;

        writeAttemptState(proof, nextAttempts, lockedUntil);
        setTone("error");
        if (lockedUntil) {
          setIsLocked(true);
          setStatus(getLockedMessage(lockedUntil));
        } else {
          setIsLocked(false);
          setStatus(
            `That verification code is invalid. (${remainingAttempts} attempt${remainingAttempts === 1 ? "" : "s"} remaining)`,
          );
        }
        return;
      }
      writeAttemptState(proof, 0);
      setIsLocked(false);
      setTone("success");
      if (path.includes("regenerate")) {
        setCodes(b.backupCodes ?? []);
        setStatus("New backup codes generated. Older codes no longer work.");
      } else {
        setCodes([]);
        setStatus("Two-factor authentication disabled.");
        onDisabled?.();
      }
    } finally {
      setBusy(false);
      setPassword("");
      setCode("");
    }
  }
  return (
    <section
      className="security-panel security-panel--management"
      role="region"
      aria-labelledby="two-factor-management-title"
    >
      <div className="security-panel-heading">
        <span
          className="security-panel-icon security-panel-icon--mint"
          aria-hidden="true"
        >
          ◎
        </span>
        <div>
          <p className="panel-kicker">RECOVERY CONTROLS</p>
          <h2 id="two-factor-management-title">Two-factor management</h2>
        </div>
      </div>
      <p className="security-panel-copy">
        Regenerating codes invalidates every older backup code.
      </p>
      <PasswordField
        label="Current password"
        id="management-password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <div className="field">
        <label htmlFor="management-code">Six-digit TOTP code</label>
        <input
          id="management-code"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) =>
            setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
        />
      </div>
      <div className="security-actions">
        <button
          type="button"
          disabled={
            busy || isLocked || !proof || !password || code.length !== 6
          }
          onClick={() => {
            if (
              window.confirm(
                "Regenerate backup codes? All older codes will stop working.",
              )
            )
              void submit("/api/identity/two-factor/backup-codes/regenerate");
          }}
        >
          Regenerate backup codes
        </button>
        <button
          className="danger-action"
          type="button"
          disabled={
            busy || isLocked || !proof || !password || code.length !== 6
          }
          onClick={() => {
            if (window.confirm("Disable two-factor authentication?"))
              void submit("/api/identity/two-factor/disable");
          }}
        >
          Disable two-factor authentication
        </button>
      </div>
      {codes.length > 0 ? (
        <div role="alert" aria-live="polite">
          <h3>Save your ten new backup codes</h3>
          <ul>
            {codes.map((c) => (
              <li key={c}>
                <code>{c}</code>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setCodes([])}>
            I saved these codes
          </button>
        </div>
      ) : null}
      <AuthStatus status={status} tone={tone} />
    </section>
  );
}
