"use client";
import { useEffect, useState } from "react";
import { AuthStatus } from "@/frontend/features/authentication/components/auth-status";
import { PasswordField } from "@/frontend/features/authentication/components/password-field";
import { useReplayableStatus } from "@/frontend/features/authentication/components/use-status";
import { Button } from "@/frontend/components/ui/button";
import { Modal } from "@/frontend/components/ui/modal";

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
    [isLocked, setIsLocked] = useState(false),
    [lockedUntil, setLockedUntil] = useState<number | null>(null),
    [confirmAction, setConfirmAction] = useState<
      "regenerate" | "disable" | null
    >(null);
  useEffect(() => {
    fetch("/api/identity/sessions", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((v) => {
        const sessionProof = v?.csrfProof ?? "";
        setProof(sessionProof);
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
  useEffect(() => {
    if (!lockedUntil) return;
    const timer = window.setTimeout(
      () => {
        setLockedUntil(null);
        setIsLocked(false);
      },
      Math.max(0, lockedUntil - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [lockedUntil]);
  async function submit(path: string) {
    if (busy) return;

    if (lockedUntil && lockedUntil > Date.now()) {
      setIsLocked(true);
      setTone("error");
      setStatus(getLockedMessage(lockedUntil));
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
        setTone("error");
        if (r.status === 429) {
          const supplied = Number.parseInt(
            r.headers.get("Retry-After") ?? "",
            10,
          );
          const retryAfterSeconds =
            Number.isSafeInteger(supplied) && supplied > 0 ? supplied : 60;
          const until = Date.now() + retryAfterSeconds * 1_000;
          setLockedUntil(until);
          setIsLocked(true);
          setStatus(getLockedMessage(until));
        } else if (r.status === 401) {
          setIsLocked(false);
          setStatus("The password or verification code is invalid.");
        } else if (r.status === 403) {
          setIsLocked(false);
          setStatus("Your security proof is no longer valid. Reload the page.");
        } else {
          setIsLocked(false);
          setStatus(
            typeof b.message === "string"
              ? b.message
              : "Two-factor management is temporarily unavailable. Please try again.",
          );
        }
        return;
      }
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
    } catch {
      setTone("error");
      setStatus(
        "Two-factor management is temporarily unavailable. Please try again.",
      );
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
          className="security-panel-icon security-panel-icon--success"
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
      <div className="security-management-fields">
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
      </div>
      <div className="security-actions">
        <button
          type="button"
          disabled={
            busy || isLocked || !proof || !password || code.length !== 6
          }
          onClick={() => setConfirmAction("regenerate")}
        >
          Regenerate backup codes
        </button>
        <button
          className="danger-action"
          type="button"
          disabled={
            busy || isLocked || !proof || !password || code.length !== 6
          }
          onClick={() => setConfirmAction("disable")}
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
      <Modal
        open={confirmAction !== null}
        title={
          confirmAction === "disable"
            ? "Disable two-factor authentication?"
            : "Replace backup codes?"
        }
        description={
          confirmAction === "disable"
            ? "Your account will no longer require an authenticator code when signing in."
            : "All existing backup codes will stop working immediately."
        }
        tone={confirmAction === "disable" ? "destructive" : "standard"}
        busy={busy}
        onClose={() => setConfirmAction(null)}
      >
        <div className="sh-modal-actions">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => setConfirmAction(null)}
          >
            Cancel
          </Button>
          <Button
            data-autofocus
            variant={confirmAction === "disable" ? "danger" : "primary"}
            disabled={busy}
            onClick={() => {
              const path =
                confirmAction === "disable"
                  ? "/api/identity/two-factor/disable"
                  : "/api/identity/two-factor/backup-codes/regenerate";
              void submit(path).then(() => setConfirmAction(null));
            }}
          >
            {busy
              ? "Working…"
              : confirmAction === "disable"
                ? "Disable 2FA"
                : "Regenerate codes"}
          </Button>
        </div>
      </Modal>
    </section>
  );
}
