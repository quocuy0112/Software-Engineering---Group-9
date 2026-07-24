"use client";
import { useEffect, useState } from "react";
import { AuthStatus } from "./auth-status";
import { PasswordField } from "./password-field";
export function TwoFactorManagement({
  onDisabled,
}: {
  onDisabled?: () => void;
}) {
  const [proof, setProof] = useState(""),
    [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [codes, setCodes] = useState<string[]>([]),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch("/api/identity/sessions", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((v) => setProof(v?.csrfProof ?? ""));
    return () => {
      setCodes([]);
      setPassword("");
      setCode("");
    };
  }, []);
  useEffect(() => {
    if (codes.length === 0) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [codes]);
  async function submit(path: string) {
    if (busy) return;
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
        setStatus("Verification could not be completed.");
        return;
      }
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
          disabled={busy || !proof || !password || code.length !== 6}
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
          disabled={busy || !proof || !password || code.length !== 6}
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
      <AuthStatus
        status={status}
        tone={status.includes("could not") ? "error" : "success"}
      />
    </section>
  );
}
