"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TWO_FACTOR_GENERIC_ERROR } from "@/features/identity/schemas/two-factor";
import { AuthStatus } from "./auth-status";
export function TwoFactorChallenge() {
  const router = useRouter(),
    input = useRef<HTMLInputElement>(null),
    [factor, setFactor] = useState<"totp" | "backup-code">("totp"),
    [code, setCode] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    input.current?.focus();
    return () => setCode("");
  }, [factor]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
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
        setStatus(TWO_FACTOR_GENERIC_ERROR);
        input.current?.focus();
        return;
      }
      setStatus("Verification complete.");
      router.replace("/dashboard");
    } catch {
      setStatus(TWO_FACTOR_GENERIC_ERROR);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-shell">
      <form onSubmit={submit} noValidate aria-busy={busy} className="auth-card">
        <h1>Two-factor verification</h1>
        <p>Use your authenticator or one backup code.</p>
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
            (factor === "totp" ? code.length !== 6 : code.trim().length < 8)
          }
        >
          {busy ? "Verifying…" : "Verify"}
        </button>
        <AuthStatus id="two-factor-status" status={status} tone="error" />
        <a href="/login">Back to sign in</a>
      </form>
      <style jsx>{`
        .auth-shell {
          width: 100%;
          max-width: 28rem;
          margin: auto;
          padding: 1rem;
          overflow-x: hidden;
        }
        .auth-card {
          min-width: 0;
        }
        .factor-mode-switcher {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .factor-mode-switcher button {
          flex: 1 1 10rem;
        }
        .field input {
          box-sizing: border-box;
          width: 100%;
          font-size: 1rem;
        }
        @media (prefers-reduced-motion: reduce) {
          * {
            scroll-behavior: auto !important;
            transition: none !important;
          }
        }
      `}</style>
    </main>
  );
}
