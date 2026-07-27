"use client";

import Link from "next/link";
import { useState } from "react";
import { useAccountRecoveryCapability } from "@/features/identity/client/use-account-recovery-capability";
import { AuthStatus } from "./auth-status";

export function AccountRecoveryCancellation() {
  const capability = useAccountRecoveryCapability("cancellation");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function cancel() {
    if (busy || capability !== "authorized") return;
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/identity/account-recovery/cancel", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const result = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setStatus(
        result?.message ??
          "Recovery was cancelled. Sign in with your existing password and second factor.",
      );
    } catch {
      setStatus(
        "The account-recovery link is invalid, expired, or already used.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-form-content">
      <div className="auth-form">
        <div className="auth-form-heading">
          <p className="form-kicker">RECOVERY CANCELLATION</p>
          <h1>Cancel account recovery</h1>
          <p>
            Cancelling keeps your existing password and second factor, while
            previously revoked sessions remain signed out.
          </p>
        </div>
        {capability === "authorizing" ? (
          <AuthStatus status="Verifying this secure recovery link…" />
        ) : null}
        {capability === "authorized" && !status ? (
          <button type="button" onClick={cancel} disabled={busy}>
            {busy ? "Cancelling recovery…" : "Cancel account recovery"}
          </button>
        ) : null}
        <AuthStatus status={status} />
        <Link href="/login">Return to sign in</Link>
      </div>
    </section>
  );
}
