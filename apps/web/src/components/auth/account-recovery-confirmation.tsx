"use client";

import Link from "next/link";
import { useState } from "react";
import { useAccountRecoveryCapability } from "@/features/identity/client/use-account-recovery-capability";
import { AuthStatus } from "./auth-status";

export function AccountRecoveryConfirmation() {
  const capability = useAccountRecoveryCapability("confirmation");
  const [status, setStatus] = useState("");
  const [holdEndsAt, setHoldEndsAt] = useState("");
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (busy || capability !== "authorized") return;
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/identity/account-recovery/confirm", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const result = (await response.json().catch(() => null)) as {
        message?: string;
        holdEndsAt?: string;
      } | null;
      setStatus(
        result?.message ?? "The recovery request could not be confirmed.",
      );
      if (response.ok && result?.holdEndsAt) setHoldEndsAt(result.holdEndsAt);
    } catch {
      setStatus("The recovery request could not be confirmed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-form-content">
      <div className="auth-form">
        <div className="auth-form-heading">
          <p className="form-kicker">SECURITY HOLD</p>
          <h1>Recovery request received</h1>
          <p>
            We revoke existing access and start a 24-hour hold before any
            password or factor change.
          </p>
        </div>
        {capability === "authorizing" ? (
          <AuthStatus status="Verifying this secure recovery link…" />
        ) : null}
        {capability === "authorized" && !holdEndsAt ? (
          <button type="button" onClick={confirm} disabled={busy}>
            {busy ? "Starting security hold…" : "Start 24-hour security hold"}
          </button>
        ) : null}
        <AuthStatus status={status} />
        {holdEndsAt ? (
          <p>
            Hold ends at <time dateTime={holdEndsAt}>{holdEndsAt}</time>. Check
            your email for one-time cancellation and completion links.
          </p>
        ) : null}
        <p>
          Email-only recovery is lower assurance than using your password and
          second factor.
        </p>
        <Link href="/login">Return to sign in</Link>
      </div>
    </section>
  );
}
