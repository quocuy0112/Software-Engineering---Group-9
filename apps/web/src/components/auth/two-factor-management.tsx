"use client";
import { useEffect, useState } from "react";
import { AuthStatus } from "./auth-status";
export function TwoFactorManagement() {
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
      }
    } finally {
      setBusy(false);
      setPassword("");
      setCode("");
    }
  }
  return (
    <section role="region" aria-labelledby="two-factor-management-title">
      <h2 id="two-factor-management-title">Two-factor management</h2>
      <p>Regenerating codes invalidates every older backup code.</p>
      <label htmlFor="management-password">Current password</label>
      <input
        id="management-password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <label htmlFor="management-code">Six-digit TOTP code</label>
      <input
        id="management-code"
        inputMode="numeric"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
      />
      <button
        type="button"
        disabled={busy || !proof || !password || code.length !== 6}
        onClick={() => {
          if (window.confirm("Regenerate backup codes? All older codes will stop working."))
            void submit("/api/identity/two-factor/backup-codes/regenerate");
        }}
      >
        Regenerate backup codes
      </button>
      <button
        type="button"
        disabled={busy || !proof || !password || code.length !== 6}
        onClick={() => {
          if (window.confirm("Disable two-factor authentication?"))
            void submit("/api/identity/two-factor/disable");
        }}
      >
        Disable two-factor authentication
      </button>
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
      <AuthStatus status={status} tone={status.includes("could not") ? "error" : "success"} />
    </section>
  );
}
